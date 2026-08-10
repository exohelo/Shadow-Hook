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
     items:   [{ id, color, size, qty }],          // color/size are display strings
     buyer:   { name, email },                     // email gets the Stripe receipt
     ship_to: { name, line1, line2, city, state, postal_code, country },  // OPTIONAL
     return_url: "https://www.theshadowhook.com/" // where Stripe sends them back
   }
   Reply: { url, code }  or  { error }

   ── v2, and why ─────────────────────────────────────────────────────────
   ADDRESS. If the app sends ship_to, Stripe is told the address instead of
   asking for it, and the order carries it from the moment it's written. If it
   doesn't, we fall back to Stripe collecting it exactly as before — so this
   version is safe to deploy BEFORE the page that uses it, and an old cached
   page keeps working.

   SAVED CARDS. A signed-in buyer gets a Stripe Customer (kept on
   profiles.stripe_customer_id) and the card is saved to it, so the next
   checkout offers it back. The card itself never comes near this database —
   all that is stored is Stripe's handle for the customer.
   ═══════════════════════════════════════════════════════════════════════ */
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SB_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
/* freight is per-product now (products.ship_usd) — one package per vendor
   per order, the buyer pays each vendor-group's highest S&H once */
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

  /* ── where it lands ──────────────────────────────────────────────────
     Optional on purpose: absent means "let Stripe ask", which is what every
     order before today did. Present means the buyer already chose it in the
     app and must not be asked twice. Half an address is worse than none, so
     an incomplete one is refused rather than quietly shipped. */
  const cut = (v: unknown, n: number) => String(v ?? "").slice(0, n).trim();
  let shipTo: Record<string, string> | null = null;
  if (body?.ship_to && typeof body.ship_to === "object") {
    const a = body.ship_to;
    const s2 = {
      name:        cut(a.name, 120),
      line1:       cut(a.line1, 200),
      line2:       cut(a.line2, 200),
      city:        cut(a.city, 100),
      state:       cut(a.state, 60),
      postal_code: cut(a.postal_code, 20),
      country:     (cut(a.country, 2) || "US").toUpperCase(),
    };
    const missing = (["name", "line1", "city", "state", "postal_code"] as const).filter((k) => !s2[k]);
    if (missing.length) return reply(400, { error: `the address is missing its ${missing.join(", ")}` });
    if (s2.country !== "US") return reply(400, { error: "the Armory only posts inside the US for now" });
    shipTo = s2;
  }

  /* the delivery instruction and the gift flag, both straight off the till */
  const shipNote = cut(body?.note, 140) || null;
  const isGift   = body?.gift === true;

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
    .select("id,name,brand,usd,cost,status,vendor_id,ship_usd").in("id", ids);
  if (perr) return reply(500, { error: "catalog read failed: " + perr.message });

  const shelf = new Map((prods ?? []).map((p: any) => [String(p.id), p]));

  // the recruiters: which ambassador (and at what rate, TODAY) rides each vendor.
  // Snapshotted onto the line so later rate changes never rewrite history.
  const vids = [...new Set((prods ?? []).map((p: any) => p.vendor_id).filter(Boolean))];
  const ambOf = new Map<string, { id: string; rate: number }>();
  if (vids.length) {
    const { data: vrows } = await admin.from("vendors").select("id,ambassador_id").in("id", vids);
    const aids = [...new Set((vrows ?? []).map((v: any) => v.ambassador_id).filter(Boolean))];
    if (aids.length) {
      const { data: arows } = await admin.from("ambassadors")
        .select("id,rate,active").in("id", aids);
      const rateOf = new Map((arows ?? []).filter((a: any) => a.active)
        .map((a: any) => [a.id, Number(a.rate) || 0]));
      for (const v of vrows ?? []) {
        if (v.ambassador_id && rateOf.has(v.ambassador_id)) {
          ambOf.set(String(v.id), { id: v.ambassador_id, rate: rateOf.get(v.ambassador_id)! });
        }
      }
    }
  }
  const lines: any[] = [];
  for (const it of items) {
    const p = shelf.get(it.id);
    if (!p)                       return reply(409, { error: `"${it.id}" just left the floor — refresh the Armory` });
    if (p.status !== "live")      return reply(409, { error: `${p.name} isn't on sale yet` });
    const usd = Number(p.usd);
    if (!Number.isFinite(usd) || usd <= 0) return reply(409, { error: `${p.name} has no price posted` });
    const cost = Number(p.cost);
    const shipRaw = Number(p.ship_usd);
    lines.push({
      product_id: String(p.id),
      vendor_id:  p.vendor_id ?? null,
      name:  String(p.name ?? p.id).slice(0, 200),
      brand: p.brand == null ? null : String(p.brand).slice(0, 120),
      color: it.color, size: it.size, qty: it.qty,
      unit_usd:  Math.round(usd * 100) / 100,
      unit_cost: Number.isFinite(cost) && cost > 0 ? Math.round(cost * 100) / 100 : 0,
      ship_usd:  0,   // assigned below — one package per vendor
      amb_id:    p.vendor_id && ambOf.has(String(p.vendor_id)) ? ambOf.get(String(p.vendor_id))!.id : null,
      amb_rate:  p.vendor_id && ambOf.has(String(p.vendor_id)) ? ambOf.get(String(p.vendor_id))!.rate : null,
      _ship:     Number.isFinite(shipRaw) && shipRaw > 0 ? Math.round(shipRaw * 100) / 100 : 0,
    });
  }

  // ── freight: one package per vendor — charge that group's highest S&H once,
  //    carried on the line that asked it (so the ledger credits the shipper) ──
  const groups = new Map<string, typeof lines>();
  for (const l of lines) {
    const k = l.vendor_id ?? "__house__";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(l);
  }
  let shipping = 0;
  for (const grp of groups.values()) {
    let top = grp[0], max = 0;
    for (const l of grp) if (l._ship > max) { max = l._ship; top = l; }
    if (max > 0) { top.ship_usd = max; shipping += max; }
  }
  shipping = Math.round(shipping * 100) / 100;
  for (const l of lines) delete (l as any)._ship;

  const subtotal = Math.round(lines.reduce((s, l) => s + l.unit_usd * 100 * l.qty, 0)) / 100;
  const total    = Math.round((subtotal + shipping) * 100) / 100;

  // ── write the order (pending) + its lines ───────────────────────────
  const { data: order, error: oerr } = await admin.from("orders").insert({
    user_id: userId, buyer_name: buyerName || null, buyer_email: buyerEmail,
    subtotal_usd: subtotal, shipping_usd: shipping, total_usd: total,
    payment_status: "pending",
    ship_to: shipTo,   // null keeps the old behaviour: the webhook fills it in from Stripe
    note: shipNote, gift: isGift,
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

    /* ── the customer ───────────────────────────────────────────────────
       Only for a signed-in buyer — a masked hand checking out anonymously has
       nowhere to hang a saved card, and shouldn't. Reuse the handle if we have
       one; if Stripe has since forgotten it (deleted in the dashboard), make a
       fresh one rather than failing the sale. */
    let customerId: string | null = null;
    if (userId) {
      try {
        const prof = await admin.from("profiles").select("stripe_customer_id").eq("id", userId).maybeSingle();
        const known = prof.data?.stripe_customer_id ?? null;
        if (known) {
          const c = await stripe.customers.retrieve(known).catch(() => null);
          if (c && !(c as { deleted?: boolean }).deleted) customerId = known;
        }
        if (!customerId) {
          const made = await stripe.customers.create({
            email: buyerEmail,
            name: buyerName || undefined,
            metadata: { shadowhook_uid: userId },
          });
          customerId = made.id;
          await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
        }
      } catch (_) { customerId = null; }   // never let card-saving cost somebody a sale
    }
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
      price_data: { currency: "usd", unit_amount: Math.round(shipping * 100), product_data: { name: "Shipping & handling" } },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      /* Stripe rejects customer and customer_email together — one or the other. */
      ...(customerId ? { customer: customerId } : { customer_email: buyerEmail }),
      client_reference_id: order.id,
      metadata: { order_id: order.id, order_code: order.code },
      payment_intent_data: {
        metadata: { order_id: order.id, order_code: order.code },
        /* save the card against the customer so the next till already knows it */
        ...(customerId ? { setup_future_usage: "on_session" as const } : {}),
        /* the address the buyer already chose — Stripe uses it rather than asking */
        ...(shipTo
          ? { shipping: { name: shipTo.name, address: {
                line1: shipTo.line1, line2: shipTo.line2 || undefined,
                city: shipTo.city, state: shipTo.state,
                postal_code: shipTo.postal_code, country: shipTo.country } } }
          : {}),
      },
      /* only ask when the app didn't already */
      ...(shipTo ? {} : { shipping_address_collection: { allowed_countries: ["US"] as const } }),
      phone_number_collection: { enabled: true },
      success_url: `${returnUrl}?armory_paid=1&code=${encodeURIComponent(order.code)}`,
      cancel_url:  `${returnUrl}?armory_cancel=1`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,  // 1 hour to pay
    });

    await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return reply(200, { url: session.url, code: order.code });
  } catch (e) {
    await admin.from("orders").update({
      payment_status: "cancelled",
      note: [shipNote, "stripe session failed"].filter(Boolean).join(" · "),
    }).eq("id", order.id);
    return reply(502, { error: "Stripe refused the session: " + (e as Error).message });
  }
});
