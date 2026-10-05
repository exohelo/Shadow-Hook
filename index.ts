// pma-pull — LINKS ONLY (#pmatools, oct5).
// PMA's LA/LB Dispatch list page is served openly; each shift's summary page sits behind a Cloudflare
// "Verify you are human" check that PMA put there to keep bots out — so this function never touches the
// summary pages or the PDFs. It reads the list and hands the app the direct link to each recent Shift 1
// (day board) and Shift 2 (night board) summary, so the Keymaster can open the right one in one tap.
// The PDF itself always comes in through a person: the one-click bookmark, a drop or an upload.
const LIST = "https://www.pmanet.org/members/bulletins-and-notices/la-lb-dispatch/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

function keyOf(y: string, m: string, d: string, shift: string): string | null {
  const ap = shift === "1st" ? "AM" : shift === "2nd" ? "PM" : null; if (!ap) return null;
  return y + "-" + m + "-" + d + "_" + DOW[new Date(Date.UTC(+y, +m - 1, +d)).getUTCDay()] + "_" + ap;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const reply = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    const r = await fetch(LIST, { headers: { "User-Agent": UA, "Accept": "text/html" } });
    if (!r.ok) return reply({ ok: false, err: "pmanet.org list page answered HTTP " + r.status, list: LIST });
    const html = await r.text();
    const re = /<a[^>]+href="([^"]*dispatch-summary[^"]*)"[^>]*>\s*(\d{2})\/(\d{2})\/(\d{4})\s+(1st|2nd|3rd)\s+Shift\s+LA\/LB\s+Dispatch\s+Summary\s*<\/a>/gi;
    const links: { key: string; url: string; title: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && links.length < 10) {
      const key = keyOf(m[4], m[2], m[3], m[5]);
      if (!key) continue;   // Shift 3 has no casual dispatch
      links.push({ key, url: new URL(m[1].replace(/&amp;/g, "&"), LIST).href, title: m[2] + "/" + m[3] + "/" + m[4] + " " + m[5] + " Shift" });
    }
    return reply({ ok: true, list: LIST, links, at: new Date().toISOString() });
  } catch (e) {
    return reply({ ok: false, err: (e as Error).message, list: LIST }, 500);
  }
});
