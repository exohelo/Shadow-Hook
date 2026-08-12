/* ═══════════════════════════════════════════════════════════════════════
   SHADOW HOOK — stripe-webhook
   Stripe's runner. When a Checkout Session completes, the order flips to
   PAID and the ship-to lands on the row — that's the moment it appears in
   the vendors' Dock Office queue. Expired sessions get marked; refunds
   made in the Stripe dashboard flow back automatically.

   Deploy (webhooks carry no user JWT — the signature IS the auth):
     supabase functions deploy stripe-webhook --no-verify-jwt
   Secrets:
     supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   Stripe dashboard → Developers → Webhooks → Add endpoint:
     https://<project-ref>.supabase.co/functions/v1/stripe-webhook
     events: checkout.session.completed, checkout.session.expired, charge.refunded
   ═══════════════════════════════════════════════════════════════════════ */
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const STRIPE_KEY  = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const HOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SB_URL      = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (!HOOK_SECRET) return new Response("STRIPE_WEBHOOK_SECRET not set", { status: 500 });

  const sig = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();

  const stripe = new Stripe(STRIPE_KEY || "sk_unused");
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, HOOK_SECRET);
  } catch (e) {
    return new Response("bad signature: " + (e as Error).message, { status: 400 });
  }

  const admin = createClient(SB_URL, SB_SERVICE);

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;

      // #aug12 — PORT BUCKS PACKS credit here too, not only when the buyer's phone
      // returns from Stripe. bucks-till and this webhook call the SAME atomic,
      // idempotent function (keyed on the session), so whichever arrives first
      // credits and the other is a no-op — a pack is never lost, never doubled.
      if (s.metadata?.kind === "bucks_pack") {
        const uid = s.metadata?.uid;
        const bucks = Number(s.metadata?.bucks ?? 0);
        if (uid && bucks > 0 && s.payment_status === "paid") {
          const { error: bErr } = await admin.rpc("credit_bucks_pack",
            { p_uid: uid, p_bucks: bucks, p_session: s.id });
          if (bErr) return new Response("bucks credit: " + bErr.message, { status: 500 }); // Stripe retries
        }
        return new Response(JSON.stringify({ received: true }),
          { status: 200, headers: { "Content-Type": "application/json" } });
      }

      const orderId = s.metadata?.order_id ?? s.client_reference_id;
      if (!orderId) return new Response("no order_id", { status: 200 });

      // ship-to: newer API versions park it on collected_information
      const shipRaw: any = (s as any).collected_information?.shipping_details
                        ?? (s as any).shipping_details ?? null;
      const addr = shipRaw?.address ?? null;
      const ship_to = addr ? {
        name: shipRaw?.name ?? s.customer_details?.name ?? null,
        line1: addr.line1 ?? null, line2: addr.line2 ?? null,
        city: addr.city ?? null, state: addr.state ?? null,
        postal_code: addr.postal_code ?? null, country: addr.country ?? null,
      } : null;

      const patch: Record<string, unknown> = {
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null,
      };
      if (ship_to) patch.ship_to = ship_to;
      if (s.customer_details?.email) patch.buyer_email = s.customer_details.email;
      if (s.customer_details?.name)  patch.buyer_name  = s.customer_details.name;
      if (s.customer_details?.phone) patch.buyer_phone = s.customer_details.phone;

      const { error } = await admin.from("orders").update(patch)
        .eq("id", orderId).neq("payment_status", "refunded");
      if (error) return new Response("db: " + error.message, { status: 500 });  // Stripe retries
    }

    if (event.type === "checkout.session.expired") {
      const s = event.data.object as Stripe.Checkout.Session;
      const orderId = s.metadata?.order_id ?? s.client_reference_id;
      if (orderId) {
        await admin.from("orders").update({ payment_status: "expired" })
          .eq("id", orderId).eq("payment_status", "pending");
      }
    }

    if (event.type === "charge.refunded") {
      const c = event.data.object as Stripe.Charge;
      const pi = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id;
      if (pi && c.refunded) {   // fully refunded — partial refunds stay 'paid', note it by hand
        await admin.from("orders")
          .update({ payment_status: "refunded", note: "refunded via Stripe" })
          .eq("stripe_payment_intent", pi);
      }
    }
  } catch (e) {
    return new Response("handler error: " + (e as Error).message, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
