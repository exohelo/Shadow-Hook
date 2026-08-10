/* ═══════════════════════════════════════════════════════════════════════
   SHADOW HOOK — armory-cards
   "Paying with Visa ···· 4242" — the four digits and nothing else.

   The till needs to show a returning buyer the card they used last time
   WITHOUT the Order ever holding a card number. So it asks Stripe, every
   time, for the brand / last four / expiry of whatever that customer has
   saved. Nothing here is stored on the docks and nothing here can charge
   anybody: a payment method id is useless without the secret key.

   Signed in only. A masked hand checking out anonymously has no customer
   and gets an empty list, which is the honest answer.

   Deploy:  supabase functions deploy armory-cards
   Secrets: STRIPE_SECRET_KEY (already set for armory-checkout)

   POST (no body needed) with the buyer's session in Authorization.
   Reply: { cards: [{ id, brand, last4, exp_month, exp_year, is_default }] }
   ═══════════════════════════════════════════════════════════════════════ */
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
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
  if (!STRIPE_KEY)              return reply(500, { error: "Stripe key not configured" });

  const admin = createClient(SB_URL, SB_SERVICE);

  // ── who's asking ──────────────────────────────────────────────────────
  let userId: string | null = null;
  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (jwt && jwt.split(".").length === 3) {
      const u = await admin.auth.getUser(jwt);
      userId = u?.data?.user?.id ?? null;
    }
  } catch (_) { /* anonymous */ }

  // Not signed in, or signed in with nothing saved: an empty list, not an error.
  // The till renders "add a card" either way and nothing breaks.
  if (!userId) return reply(200, { cards: [] });

  const prof = await admin.from("profiles").select("stripe_customer_id").eq("id", userId).maybeSingle();
  const customerId = prof.data?.stripe_customer_id ?? null;
  if (!customerId) return reply(200, { cards: [] });

  try {
    const stripe = new Stripe(STRIPE_KEY);

    // Which one Stripe would reach for by default, so the till can pre-select it.
    let defaultPm: string | null = null;
    try {
      const c = await stripe.customers.retrieve(customerId);
      if (c && !(c as { deleted?: boolean }).deleted) {
        const d = (c as Stripe.Customer).invoice_settings?.default_payment_method;
        defaultPm = typeof d === "string" ? d : d?.id ?? null;
      }
    } catch (_) { /* a forgotten customer just means no default */ }

    const list = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 10 });

    const cards = (list.data ?? []).map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? "card",
      last4: pm.card?.last4 ?? "",
      exp_month: pm.card?.exp_month ?? null,
      exp_year: pm.card?.exp_year ?? null,
      is_default: pm.id === defaultPm,
    }));
    // Newest first unless Stripe has a default, which leads.
    cards.sort((a, b) => Number(b.is_default) - Number(a.is_default));

    return reply(200, { cards });
  } catch (e) {
    // A card list is decoration. It must never be the reason somebody can't buy.
    console.error("armory-cards:", e);
    return reply(200, { cards: [] });
  }
});
