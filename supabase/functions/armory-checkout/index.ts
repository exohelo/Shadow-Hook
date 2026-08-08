/* ═══════════════════════════════════════════════════════════════════════
   SHADOW HOOK — armory-checkout
   The till. The app posts a cart; this function prices it FROM THE DATABASE
   (never from the client), writes the order + lines, opens a Stripe Checkout
   Session and hands back the pay URL. stripe-webhook marks it paid.

   Deploy:   supabase functions deploy armory-checkout
   Secrets:  supabase secrets set STRIPE_SECRET_KEY=sk_live_...
             supabase secrets set ARMORY_SHIPPING_USD=0        (optional flat shipping)
             supabase secrets set ARMORY_ALLOWED_ORIGIN=https://www.theshadowhook.com   (optional; default *)

   POST body: {
     items:  [{ id, color, size, qty }],          // color/size are display strings
     buyer:  { name, email },                     // email gets the Stripe receipt
     return_url: "https://www.theshadowhook.com/" // where Stripe sends them back
   }
   Reply: { url, code }  or  { error }
   ═══════════════════════════════════════════════════════════════════════ */
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SB_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SHIP_USD   = Math.max(0, Number(Deno.env.get("ARMORY_SHIPPING_USD") ?? "0") || 0);
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
  if (!STRIPE_KEY)              return reply(500, { error: "Stripe key not configured — set STRIPE_SECRET_KEY" });

  let body: any;
  try { body = await req.json(); } catch { return reply(400, { error: "bad JSON" }); }

  // ── the cart, sanity-checked ────────────────────────────────────────
  const items = Array.isArray(body?.items) ? body.items.slice(0, 40) : [];
  if (!items.length) return reply(400, { error: "empty cart" });
  for (const it of items) {
    it.id    = String(it?.id ?? "").slice(0, 80);
    it.color = it?.color == null ? null : String(it.color).slice(0, 60);
    it.size  = it?.size  == null ? null : String(it.size).slice(0, 40);
    it.qty   = Math.floor(Number(it?.qty));
    if (!it.id || !Number.isFinite(it.qty) || it.qty < 1 || it.qty > 20) {
      return reply(400, { error: "bad cart line" });
    }
  }
  const buyerName  = String(body?.buyer?.name  ?? "").slice(0, 120).trim();
  const buyerEmail = String(body?.buyer?.email ?? "").slice(0, 160).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) return reply(400, { error: "a real email is needed for the receipt" });

  let returnUrl = String(body?.return_url ?? "").slice(0, 400);
  if (!/^https?:\/\//i.test(returnUrl)) returnUrl = ORIGIN !== "*" ? ORIGIN : "";
  if (!returnUrl) return reply(400, { error: "no return_url" });
  returnUrl = returnUrl.split("#")[0].split("?")[0];

  const admin = createClient(SB_URL, SB_SERVICE);

  // buyer's account, when they're signed in (optional — masked hands can still buy)
  let userId: string | null = null;
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (jwt && jwt.split(".").length === 3) {
      const u = await admin.auth.getUser(jwt);
      userId = u?.data?.user?.id ?? null;
    }
  } catch (_) { /* fine — anonymous buyer */ }

  // ── price it from the shelf, not from the client ────────────────────
  const ids = [...new Set(items.map((i: any) => i.id))];
  const { data: prods, error: perr } = await admin.from("products")
    .select("id,name,brand,usd,cost,status,vendor_id").in("id", ids);
  if (perr) return reply(500, { error: "catalog read failed: " + perr.message });

  const shelf = new Map((prods ?? []).map((p: any) => [String(p.id), p]));
  const lines: any[] = [];
  for (const it of items) {
    const p = shelf.get(it.id);
    if (!p)                       return reply(409, { error: `"${it.id}" just left the floor — refresh the Armory` });
    if (p.status !== "live")      return reply(409, { error: `${p.name} isn't on sale yet` });
    const usd = Number(p.usd);
    if (!Number.isFinite(usd) || usd <= 0) return reply(409, { error: `${p.name} has no price posted` });
    const cost = Number(p.cost);
    lines.push({
      product_id: String(p.id),
      vendor_id:  p.vendor_id ?? null,
      name:  String(p.name ?? p.id).slice(0, 200),
      brand: p.brand == null ? null : String(p.brand).slice(0, 120),
      color: it.color, size: it.size, qty: it.qty,
      unit_usd:  Math.round(usd * 100) / 100,
      unit_cost: Number.isFinite(cost) && cost > 0 ? Math.round(cost * 100) / 100 : 0,
    });
  }

  const subtotal = Math.round(lines.reduce((s, l) => s + l.unit_usd * 100 * l.qty, 0)) / 100;
  const shipping = lines.length ? SHIP_USD : 0;
  const total    = Math.round((subtotal + shipping) * 100) / 100;

  // ── write the order (pending) + its lines ───────────────────────────
  const { data: order, error: oerr } = await admin.from("orders").insert({
    user_id: userId, buyer_name: buyerName || null, buyer_email: buyerEmail,
    subtotal_usd: subtotal, shipping_usd: shipping, total_usd: total,
    payment_status: "pending",
  }).select("id,code").single();
  if (oerr || !order) return reply(500, { error: "could not open the order: " + (oerr?.message ?? "?") });

  const { error: ierr } = await admin.from("order_items")
    .insert(lines.map((l) => ({ ...l, order_id: order.id })));
  if (ierr) {
    await admin.from("orders").delete().eq("id", order.id);
    return reply(500, { error: "could not write the lines: " + ierr.message });
  }

  // ── open the till ───────────────────────────────────────────────────
  try {
    const stripe = new Stripe(STRIPE_KEY);
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = lines.map((l) => ({
      quantity: l.qty,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(l.unit_usd * 100),
        product_data: {
          name: l.name,
          description: [l.color, l.size].filter(Boolean).join(" · ") || undefined,
        },
      },
    }));
    if (shipping > 0) line_items.push({
      quantity: 1,
      price_data: { currency: "usd", unit_amount: Math.round(shipping * 100), product_data: { name: "Shipping" } },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      customer_email: buyerEmail,
      client_reference_id: order.id,
      metadata: { order_id: order.id, order_code: order.code },
      payment_intent_data: { metadata: { order_id: order.id, order_code: order.code } },
      shipping_address_collection: { allowed_countries: ["US"] },
      phone_number_collection: { enabled: true },
      success_url: `${returnUrl}?armory_paid=1&code=${encodeURIComponent(order.code)}`,
      cancel_url:  `${returnUrl}?armory_cancel=1`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,  // 1 hour to pay
    });

    await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return reply(200, { url: session.url, code: order.code });
  } catch (e) {
    await admin.from("orders").update({ payment_status: "cancelled", note: "stripe session failed" }).eq("id", order.id);
    return reply(502, { error: "Stripe refused the session: " + (e as Error).message });
  }
});
