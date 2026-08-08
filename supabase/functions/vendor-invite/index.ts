/* ═══════════════════════════════════════════════════════════════════════
   SHADOW HOOK — vendor-invite
   The Keymaster mints a dock pass. Given an email + vendor, this either
   CREATES a fresh login (with the temp password the Keymaster hands over)
   or LINKS an existing account (a vendor who's already a member keeps
   their own password — it is never touched) — then writes vendor_members.

   Only a caller whose profile carries is_keymaster may use it.

   Deploy:  supabase functions deploy vendor-invite

   POST body: { email, vendor_id, temp_password? }
   Reply:     { ok, linked_existing, user_id }  or  { error }
   ═══════════════════════════════════════════════════════════════════════ */
import { createClient } from "npm:@supabase/supabase-js@2";

const SB_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ORIGIN     = Deno.env.get("ARMORY_ALLOWED_ORIGIN") ?? "*";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST")    return reply(405, { error: "POST only" });

  const admin = createClient(SB_URL, SB_SERVICE);

  // ── the caller must be the Keymaster ────────────────────────────────
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt || jwt.split(".").length !== 3) return reply(401, { error: "sign in first" });
  const caller = await admin.auth.getUser(jwt);
  const callerId = caller?.data?.user?.id;
  if (!callerId) return reply(401, { error: "bad session" });
  const { data: prof } = await admin.from("profiles").select("is_keymaster").eq("id", callerId).maybeSingle();
  if (!prof?.is_keymaster) return reply(403, { error: "the Keymaster's key doesn't fit your hand" });

  // ── the pass being minted ───────────────────────────────────────────
  let body: any;
  try { body = await req.json(); } catch { return reply(400, { error: "bad JSON" }); }
  const email    = String(body?.email ?? "").trim().toLowerCase();
  const vendorId = String(body?.vendor_id ?? "").trim();
  const tempPw   = String(body?.temp_password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: "that's not an email" });
  if (!/^[0-9a-f-]{36}$/i.test(vendorId))        return reply(400, { error: "bad vendor id" });

  const { data: vendor, error: verr } = await admin.from("vendors")
    .select("id,name").eq("id", vendorId).maybeSingle();
  if (verr || !vendor) return reply(404, { error: "no such vendor" });

  // ── existing account? link it, never touch its password ─────────────
  let userId: string | null = null;
  let linkedExisting = false;
  try {
    const { data } = await admin.rpc("shk_user_id_by_email", { e: email });
    if (data) { userId = data as string; linkedExisting = true; }
  } catch (_) { /* fall through to create */ }

  if (!userId) {
    if (tempPw.length < 8) return reply(400, { error: "temp password needs 8+ characters" });
    const created = await admin.auth.admin.createUser({
      email, password: tempPw, email_confirm: true,
      user_metadata: { shadowhook_vendor: vendor.name },
    });
    if (created.error || !created.data?.user) {
      return reply(500, { error: "could not create the login: " + (created.error?.message ?? "?") });
    }
    userId = created.data.user.id;
  }

  // ── the pass itself ────────────────────────────────────────────────
  const { error: merr } = await admin.from("vendor_members")
    .upsert({ user_id: userId, vendor_id: vendorId, email }, { onConflict: "user_id" });
  if (merr) return reply(500, { error: "could not write the pass: " + merr.message });

  return reply(200, { ok: true, linked_existing: linkedExisting, user_id: userId });
});
