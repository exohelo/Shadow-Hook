// ═══════════════════════════════════════════════════════════════════════════
// vendor-invite — MINT A DOCK PASS
//
// Deploy over your existing function:
//     supabase functions deploy vendor-invite
// (put this file at supabase/functions/vendor-invite/index.ts first)
//
// WHY IT'S BEING REPLACED. The deck sends { email, ambassador_id, temp_password }
// when the Keymaster crowns somebody, and { email, vendor_id, temp_password }
// when a bench gets a pass. The version currently deployed only ever looks for
// vendor_id, so a crown comes back "bad vendor id" and no ambassador can ever
// be minted a login. This one understands both.
//
// WHAT IT DOES
//   1. checks the caller is allowed to mint this particular pass
//   2. creates the auth account, or LINKS one that already exists — an existing
//      password is never touched, which is what lets a casual keep their app
//      login and pick up a crown on the same account
//   3. writes the one membership row that opens the deck
//
// WHO MAY MINT
//   · the Keymaster — anything
//   · an ambassador — a pass for a vendor THEY recruited, and nothing else
//   · anyone else — refused
//
// Needs no secrets of its own: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// injected into every edge function by the platform.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const fail = (msg: string, status = 400) => reply({ ok: false, error: msg }, status);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("post only", 405);

  const URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("bad body"); }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.temp_password ?? "");
  const vendorId = body.vendor_id ? String(body.vendor_id) : null;
  const ambId = body.ambassador_id ? String(body.ambassador_id) : null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("a real email");
  if (password.length < 8) return fail("temp password needs 8+ characters");
  if (!vendorId && !ambId) return fail("no vendor or ambassador to mint for");
  if (vendorId && ambId) return fail("one at a time — a vendor or a crown, not both");

  // ── who is asking? ───────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return fail("sign in first", 401);

  const asCaller = createClient(URL, ANON, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: { user: caller } } = await asCaller.auth.getUser();
  if (!caller) return fail("sign in first", 401);

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

  // Keymaster?
  const { data: prof } = await admin
    .from("profiles").select("is_keymaster").eq("id", caller.id).maybeSingle();
  const isKm = !!prof?.is_keymaster;

  if (!isKm) {
    // only other road in: an ambassador minting for a vendor they recruited
    if (ambId) return fail("only the Keymaster hands out crowns", 403);

    const { data: mine } = await admin
      .from("ambassador_members").select("ambassador_id").eq("user_id", caller.id).maybeSingle();
    if (!mine?.ambassador_id) return fail("not yours to mint", 403);

    const { data: v } = await admin
      .from("vendors").select("id, ambassador_id").eq("id", vendorId!).maybeSingle();
    if (!v) return fail("that bench isn’t on the rolls");
    if (v.ambassador_id !== mine.ambassador_id) return fail("that vendor isn’t one of your recruits", 403);
  } else if (ambId) {
    const { data: a } = await admin.from("ambassadors").select("id").eq("id", ambId).maybeSingle();
    if (!a) return fail("that crown isn’t on the rolls");
  } else {
    const { data: v } = await admin.from("vendors").select("id").eq("id", vendorId!).maybeSingle();
    if (!v) return fail("that bench isn’t on the rolls");
  }

  // ── the account: make one, or take the one that's already there ──────────
  let uid: string | null = null;
  let linkedExisting = false;

  const made = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (made.data?.user) {
    uid = made.data.user.id;
  } else {
    const msg = String(made.error?.message ?? "").toLowerCase();
    const dupe = msg.includes("already") || msg.includes("registered") ||
                 msg.includes("exists") || made.error?.status === 422;
    if (!dupe) return fail(made.error?.message || "the mint jammed making the account", 500);

    // already an Order account — link it as-is, never touch their password
    linkedExisting = true;
    let page = 1;
    while (page <= 20 && !uid) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) return fail(error.message, 500);
      const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
      if (hit) uid = hit.id;
      if (data.users.length < 200) break;
      page++;
    }
    if (!uid) return fail("that email already exists but couldn’t be found — check Authentication → Users", 500);
  }

  // ── the row that opens the deck ──────────────────────────────────────────
  const table = ambId ? "ambassador_members" : "vendor_members";
  const row: Record<string, unknown> = ambId
    ? { user_id: uid, ambassador_id: ambId }
    : { user_id: uid, vendor_id: vendorId };

  // the email column is useful (the deck shows who signs in) but is not on
  // every install — write it if it takes, drop it and carry on if it doesn't
  let ins = await admin.from(table).insert({ ...row, email });
  if (ins.error && /column|schema cache|email/i.test(ins.error.message || "")) {
    ins = await admin.from(table).insert(row);
  }
  if (ins.error) {
    const dupe = /duplicate|unique/i.test(ins.error.message || "");
    if (!dupe) return fail(ins.error.message, 500);
    // already had the pass — that's a success, not a failure
  }

  return reply({ ok: true, linked_existing: linkedExisting, user_id: uid });
});
