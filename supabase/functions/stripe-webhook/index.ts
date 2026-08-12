// ============================================================================
// bucks-till — the ⬡ mint: sell Port Buck packs for real money through Stripe.
//
// HOW TO DEPLOY (once, ~2 minutes):
//   Supabase dashboard → Edge Functions → Deploy a new function →
//   name it exactly:  bucks-till   → paste this whole file → Deploy.
//   (Your STRIPE key is already set for armory-checkout, so it's reused here.
//    If the function complains about a missing key, add a secret named
//    STRIPE_SECRET_KEY under Edge Functions → Manage secrets.)
//
// WHAT IT DOES — two actions, both POSTed by the app:
//   {action:'create', pack:'bosun', return_url}  → makes a Stripe Checkout
//       session for that pack (prices live HERE, so nobody can tamper) and
//       returns {url} for the member's phone to open.
//   {action:'confirm', session:'cs_...'}         → verifies with Stripe that
//       the session is PAID, then credits the member ONCE (the bucks_book
//       stripe_session unique lock makes double-credits impossible) and
//       returns {ok, credited, balance}.
//
// Money truth lives with Stripe; balances live in profiles.port_bucks; the
// statement line lands in bucks_book. Run BUCKS-BANK.sql before deploying.
// ============================================================================

// deno-lint-ignore-file no-explicit-any
Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const J = (b: any, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const STRIPE =
      Deno.env.get("STRIPE_SECRET_KEY") ?? Deno.env.get("STRIPE_SECRET") ?? Deno.env.get("STRIPE_KEY") ?? "";
    if (!SB_URL || !SERVICE) return J({ error: "function env missing" }, 500);
    if (!STRIPE) return J({ error: "no Stripe key on file — set STRIPE_SECRET_KEY" }, 500);

    // ── the packs: THE prices. Keep in step with the display list in index.html. ──
    const PACKS: Record<string, { usd: number; bucks: number; name: string }> = {
      deckhand:     { usd: 5,  bucks: 500,  name: "Port Bucks — Deckhand pack (500 ⬡)" },
      bosun:        { usd: 10, bucks: 1100, name: "Port Bucks — Bosun pack (1,100 ⬡)" },
      stevedore:    { usd: 25, bucks: 3000, name: "Port Bucks — Stevedore pack (3,000 ⬡)" },
      harbormaster: { usd: 50, bucks: 6500, name: "Port Bucks — Harbormaster pack (6,500 ⬡)" },
    };

    // ── who's asking? verify the caller's JWT with Supabase auth ──
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const uRes = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE, Authorization: `Bearer ${jwt}` },
    });
    if (!uRes.ok) return J({ error: "sign in first — the mint needs to know whose stack to fill" }, 401);
    const user = await uRes.json();
    const uid: string = user?.id ?? "";
    if (!uid) return J({ error: "no account on the line" }, 401);

    const body = await req.json().catch(() => ({}));

    // ══ CREATE — open a Stripe Checkout for one pack ══
    if (body.action === "create") {
      const pack = PACKS[String(body.pack ?? "")];
      if (!pack) return J({ error: "no such pack" }, 400);
      const back = String(body.return_url ?? "").split("?")[0] || "https://theshadowhook.com/";
      const form = new URLSearchParams({
        mode: "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(pack.usd * 100),
        "line_items[0][price_data][product_data][name]": pack.name,
        success_url: `${back}?bucks_paid={CHECKOUT_SESSION_ID}`,
        cancel_url: `${back}?bucks_cancel=1`,
        "metadata[uid]": uid,
        "metadata[bucks]": String(pack.bucks),
        "metadata[kind]": "bucks_pack",
      });
      const sRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${STRIPE}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      const sess = await sRes.json();
      if (!sRes.ok || !sess?.url) return J({ error: sess?.error?.message ?? "the mint jammed" }, 502);
      return J({ ok: true, url: sess.url });
    }

    // ══ CONFIRM — verify paid, credit once, return the new balance ══
    if (body.action === "confirm") {
      const sid = String(body.session ?? "");
      if (!/^cs_/.test(sid)) return J({ error: "bad session" }, 400);

      // already credited? (the unique lock answers instantly)
      const dupe = await fetch(
        `${SB_URL}/rest/v1/bucks_book?stripe_session=eq.${encodeURIComponent(sid)}&select=delta,user_id`,
        { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
      ).then((r) => r.json());
      const balNow = async () => {
        const p = await fetch(
          `${SB_URL}/rest/v1/profiles?id=eq.${uid}&select=port_bucks`,
          { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } },
        ).then((r) => r.json());
        return Number(p?.[0]?.port_bucks ?? 0);
      };
      if (Array.isArray(dupe) && dupe.length) {
        return J({ ok: true, credited: 0, already: true, balance: await balNow() });
      }

      const sess = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sid}`, {
        headers: { Authorization: `Bearer ${STRIPE}` },
      }).then((r) => r.json());
      if (sess?.payment_status !== "paid") return J({ error: "not paid yet" }, 402);
      if (sess?.metadata?.kind !== "bucks_pack") return J({ error: "not a bucks session" }, 400);
      if (sess?.metadata?.uid !== uid) return J({ error: "this session belongs to another hand" }, 403);
      const bucks = Number(sess?.metadata?.bucks ?? 0);
      if (!(bucks > 0)) return J({ error: "empty pack" }, 400);

      // #aug12 — CREDIT ATOMICALLY. The old path did this in two REST calls
      // (insert the statement line, then read-and-PATCH the balance), which could
      // (#33) lose a concurrent chat earn, and (#34) leave the member PAID-BUT-
      // NOT-CREDITED if the balance write failed after the line was written — the
      // session lock then blocked every retry from ever crediting. One SECURITY
      // DEFINER function now does the line AND the balance in a single
      // transaction, idempotent on the session. (Run credit_bucks_pack.sql once.)
      const cr = await fetch(`${SB_URL}/rest/v1/rpc/credit_bucks_pack`, {
        method: "POST",
        headers: {
          apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_uid: uid, p_bucks: bucks, p_session: sid }),
      });
      if (!cr.ok) {
        const t = await cr.text();
        return J({ error: "credit failed (run credit_bucks_pack.sql?): " + t.slice(0, 140) }, 500);
      }
      const out = await cr.json();   // { credited, already, balance }
      return J({ ok: true, credited: Number(out?.credited ?? 0), already: !!out?.already, balance: Number(out?.balance ?? 0) });
    }

    return J({ error: "unknown action" }, 400);
  } catch (e) {
    return J({ error: String((e as any)?.message ?? e) }, 500);
  }
});
