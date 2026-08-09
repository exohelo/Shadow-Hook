# The Dock Pass — deep review

**The short version.** You are right, and the app is wrong. There is currently no way to
get an outsider into the Order except by inventing a password for them and saying it out
loud. That is not a policy you are working around — it is the only road the code builds.
Separately, the button you were pressing could never have worked: the mint has never
understood what a crown is, which is exactly what `bad vendor id` is telling you.

Both are fixed in the files next to this one. The rest of this is what I found on the way,
ranked by what would bite you first — including six defects an adversarial pass found in my
own fix, which are worth reading because one of them is a mistake this codebase is
structurally prone to making again.

---

## 1 · The mint has never understood a crown — this is your `bad vendor id`

The string `bad vendor id` appears nowhere in `ambassador.html` or `index.html`. It comes
back over the wire, in the `error` field of the JSON the `vendor-invite` edge function
returns, and gets painted into the sheet by this line:

```js
m.textContent='> '+((j&&j.error)||('the mint jammed ('+r.status+')'));
```

Now look at what the sheet actually sent. The subtitle reads *"A crown login for …"*, so
`inviteKind === 'amb'`, so the body was:

```js
{ email: email, ambassador_id: inviteVendorId, temp_password: pass }
```

There is no `vendor_id` in that object at all. The deployed function reads `vendor_id`,
finds nothing, and answers `bad vendor id`.

Your second screenshot proves it beyond argument. **D4928 is a different person, a
different email — `d4928@shadowhook.com`, a card address, not a gmail — a different
password, and the identical error.** Two people who have nothing in common except that
both were being crowned. It was never about Ruth, never about her address, never about
what you typed in the password box. The crown button has been broken for everyone, from
both pages: `index.html` posts the same shape from the Command Center at line 18469 and
swallows the same refusal into `shkAlert`, which is why it has been failing quietly there
instead of loudly.

The fixed function accepts exactly one of `vendor_id` or `ambassador_id`, and names the
thing it couldn't find instead of blaming a vendor nobody mentioned.

---

## 2 · The real problem: there is no door that isn't a password you made up

This is the finding that matters, and it is bigger than one bug.

Trace every way a human can come to exist in this system.

The store makes accounts from a dispatch card. `cardToEmail()` in `index.html` is
`String(id).trim().toLowerCase() + "@shadowhook.com"` — D4928 becomes
`d4928@shadowhook.com`, an address the comment at the gate correctly describes as *"a
fiction: it receives no mail and the member has never seen it."* That road is closed to
Ruth. She has no card.

The application at `BECOME AN AMBASSADOR` reads `ME.uid` on its first line —
`SB.from('amb_applications').select('*').eq('user_id', ME.uid)`. You have to already be
signed in to apply. So the self-serve road requires the account it is supposed to create.
Closed too.

Which leaves the mint. And the mint's only mode was: type a password for another adult,
then read it to them. The sheet is honest about it — *TEMP PASSWORD — HAND IT TO THEM
YOURSELF* — but honesty about a bad design doesn't fix it.

So the system is card-shaped all the way down, and every non-casual has to be smuggled in
through a hole that was cut for handing a fob to somebody standing at the counter. For a
shop owner across town it means a password with her own name in it, sitting in a text
thread forever, that you chose and she never consented to.

**The fix is the link.** `mode:"link"` creates or finds the account, hangs the crown on
it, and hands *you* a one-time sign-in URL. You send it however you already talk to her.
She clicks once, lands inside the deck already signed in, and sets her own password —
which you never see, never choose, and never have to keep secret on her behalf.

The important practical detail: this uses the admin `generateLink` call, which *returns*
the link rather than mailing it. **It needs no SMTP setup at all.** You copy it and send
it yourself. That matters — see §12.

And it isn't only crowns. `dockoffice.html` and `vendor.html` are the same engine — the
mint sheet in them is byte-for-byte the one on the ambassador deck — so a vendor has had
exactly the same problem, minus the one bug in §1 that made the crown road fail loudly
instead of quietly. Both decks are patched, and a link cut for a vendor now lands them on
`/dockoffice` rather than on a deck that would bounce them.

---

## 3 · Ruth is already inside. She has been the whole time.

Your own SQL, bottom of the first screenshot, third row:

```
Ruth Gutierrez | Ruth.d.gutierrez@gmail.com | 60 | true | ruth.d.gutierrez@gmail.com | 13c04e0a-7926-47a4-9a71-9bad2934160b
```

That row is a join across `ambassador_members → ambassadors → auth.users`. For it to
return at all, three things must already be true: she has an `auth.users` row, she has an
`ambassadors` row, and the two are linked. The crown is set. The membership exists.
`route()` will find her.

She does not need the mint. She needs a way to authenticate as
`13c04e0a-7926-47a4-9a71-9bad2934160b`, which is a different problem, and the one §2
solves.

**Also, while you're looking at that row: her rate is 60.** D4928 and NAUGHTY_1 are both
10, and `openAmbSheet()` defaults new crowns to `'10'`. Sixty percent of the house margin
on everything her recruits ever sell, forever, booked automatically at the till. If that
was deliberate, good — it's a hell of a deal for her. If a `6` landed where a `1` was
meant to, you want to know before the first sale books, because the ledger snapshots the
rate per line and history keeps what it captured.

---

## 4 · The capital R would have broken the mint even after §1 was fixed

`ambassadors.email` holds `Ruth.d.gutierrez@gmail.com`. `auth.users` holds
`ruth.d.gutierrez@gmail.com`. Auth normalises to lowercase; your table does not.

`openInvite()` prefills straight from the row:

```js
$('invEmail').value = who && who.email ? who.email : '';
```

So the capitalised form goes up to the function. A case-sensitive lookup against
`auth.users` misses the account that already exists and tries to create a second one —
which then fails on the unique constraint, or worse, doesn't.

Fixed on both ends: the sheet lowercases on prefill, and the function lowercases before it
does anything at all.

---

## 5 · Both auth drawers race for the sign-in link, and the wrong one usually wins

This one would have quietly eaten the fix in §2, so it's worth understanding.

You deliberately run two clients:

```js
const SB_DOCK = createClient(url, key, { auth:{ persistSession:true, autoRefreshToken:true,
                                                storageKey:'shadowhook_dock_auth' }});
const SB_APP  = createClient(url, key, { auth:{ persistSession:true, autoRefreshToken:false }});
```

`detectSessionInUrl` is not set on either, and its default is `true`. So when someone
arrives on `…/ambassador#access_token=…`, **both** clients try to claim that hash, and
whichever initialises first consumes it. That is `SB_DOCK` today by declaration order — but
it is order-of-execution luck, not a guarantee, and the whole point of the comment above
those lines is that the app's drawer is read-only from here. A drawer that can swallow a
sign-in link is not read-only.

Now `SB_APP` is explicitly `detectSessionInUrl:false` and `SB_DOCK` explicitly `true`. The
link lands in the dock drawer by contract instead of by accident.

The same patch reads `location.hash` once at the top of the engine — before any client
boots and eats it — into `ARRIVED_BY_LINK`, so `route()` can still tell how someone got
in.

---

## 6 · There was no way back in from the gate

The gate offers exactly one thing: email plus password. The fine print says *"Lost your
login? Send word — support@theshadowhook.com."*

So the recovery path for an ambassador locked out on a Sunday is: email a human, wait for
the human, and have the human invent her a new password. Same hole as §2, from the other
side. `resetPasswordForEmail` appears in your bundled auth library and is never called by
a single line of your own code.

The Dock Office gate says the same thing in different words — *"Passes are minted by the
Keymaster. Lost yours? Send word."* Same hole, same page count. (`service.html` has a
third copy of this pattern in its sign-in sheet. There's no mint behind it and everyone
who uses it has a card, so I left it alone — but it's the same shape if you ever put an
outsider on the service board.)

Added: an **EMAIL ME A SIGN-IN LINK** button on both gates. Two details in it are not
optional. `shouldCreateUser:false` — without it that button is a public
"create-me-an-account" endpoint sitting on the page that hands out dock passes. And it
refuses `@shadowhook.com` addresses with an explanation, because a dispatch-card address
has no inbox to send to and a silent failure there would be maddening.

---

## 7 · The password floor is eight characters, and the last one through was a first name and four digits

```js
if(pass.length<8){ m.textContent='> temp password needs 8+ characters'; return; }
```

`genPass()` rolls a good 12-character string. Nothing makes you keep it, and on the first
screenshot it had been replaced by `Ruth1234` — her own name and a counting sequence,
eight characters, first guess in any dictionary attack, and it opens a dashboard with
commission money in it.

That is not a discipline problem, it's a design problem: the field is empty-able, the
floor is low, and the flow *requires* a human to pick something they can say aloud over
the phone. Anything sayable is guessable.

Raised to 12 in both the sheet and the function, `genPass()` raised to 16, and the
password road is now behind a second click with a plain warning about what a password in
a text message is. But the real fix is that it is no longer the default road.

---

## 8 · Verify who is allowed to call the mint

I can't see v1's source, so treat this as a thing to check rather than a thing I found.

`vendor-invite` runs with the service role. It creates auth users. It is called from the
browser with the public anon key and whatever session the caller has. If it does not
verify the caller server-side, then any signed-in account — every casual with a card — can
POST to it and mint themselves a pass.

Check it in one command:

```bash
# sign in as an ordinary casual, grab that access_token, then:
curl -i -X POST 'https://ehykqebzkbelwtkgjbml.supabase.co/functions/v1/vendor-invite' \
  -H 'Content-Type: application/json' \
  -H "apikey: $ANON" -H "Authorization: Bearer $CASUAL_TOKEN" \
  -d '{"email":"probe@example.com","vendor_id":"<any real vendor uuid>","mode":"link"}'
```

Anything but a `403` is a hole. v2 enforces it regardless: Keymaster may mint anything
except onto another Keymaster; an ambassador may mint a **vendor** pass, only for a vendor
whose `ambassador_id` is their own, and only by *creating* a login — never by being handed
one into an account that already existed. `AMBASSADOR_MINT=off` takes even that away if
you'd rather the mint were yours alone.

Related, and worth saying plainly: `ME.km` is set by reading `profiles.is_keymaster` in
the browser. That flag decides which tabs render. It cannot decide anything else. Every
Keymaster-only *write* — rate changes, retiring crowns, payouts, product costs — has to be
refused by RLS on its own merits, because `openTab('ambs')` is one line in a console.

---

## 9 · Verify what an ambassador's browser is actually holding

`refreshAll()` calls `loadVendors()` for ambassadors as well as the Keymaster, and it
selects everything:

```js
SB.from('vendors').select('*').order('created_at')
SB.from('vendor_members').select('*')
```

The scoping to *their* recruits happens afterwards, in the renderer:

```js
const mine = VENDORS.filter(v => !ME.amb || ME.km || v.ambassador_id === ME.amb.id);
```

That is a filter on data already sitting in the browser. `loadLedger()` is the same shape
over `vendor_balances` and `vendor_payouts` — every vendor's owed, pipe and paid.

If RLS on those four tables scopes rows to the caller, this is merely wasteful. If it
doesn't, then Ruth — at 60% — can open the console, type `VENDORS`, and read every maker's
email, phone, private notes and money in the Order. Two minutes to check:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"13c04e0a-7926-47a4-9a71-9bad2934160b","role":"authenticated"}';
select count(*) from vendors;          -- should be her recruits only
select count(*) from vendor_balances;  -- same
reset role;
```

I'd fix the RLS rather than the query. Client-side filtering is presentation; it was never
a boundary.

While you're in there: an ambassador can `update` `vendors.email` on their own recruits.
The new mint uses that field as its audit trail — it refuses to mint to an address that
isn't written on the card — so if you want that to be worth anything, RLS has to be the
thing deciding who may write it.

---

## 10 · Smaller things, in the order I'd get to them

Revoking a pass deletes by user alone — `SB.from('ambassador_members').delete().eq('user_id', …)`
and the same in the vendor version. Pull one crown from somebody who holds two and both
come off. Scope the delete with `.eq('ambassador_id', …)` as well; `kmAmbPull()` in
`index.html` already gets this right, so the two pages disagree.

`shkAlert()` inserts into `error_log` straight from the browser, with a cap of six per
session enforced only in JavaScript. Anyone signed in can write whatever they like into
your alarm book, as many times as they like, from a console. It's a nuisance rather than a
breach, but it's the book you read when something is wrong, so it's worth an insert policy
and a server-side rate limit.

`kmAmbGo()` in `index.html` paints the freshly minted temp password into `innerHTML` and
leaves it on screen — deliberately, so it can be copied, and the copy says it won't be
shown again. Fine as far as it goes, but that string is now in the DOM of a page that
stays open all day. With the link road in place this branch should just go.

The mint sheet's promise — *"If the email already has an Order account, it's linked as-is
— their password is never touched"* — is now true by construction in v2 on every path,
including the password path, which no longer even generates a link when the address is
already on the rolls, so a pending invite that person is holding stays valid.

---

## 11 · What the adversarial pass found in my own fix

I had a second reader attack the patch before handing it over. It found six real defects,
and four rounds later they're closed. Two are worth your time, because the first is a
mistake this codebase is set up to make again and the second is the kind that only shows
up on somebody else's Sunday.

**The link road, as I first wrote it, was an account takeover.** I asked GoTrue "does this
account already exist?" the obvious way — call `generateLink({type:"invite"})` and treat an
*already registered* error as yes. That is wrong in exactly one direction, and it is the
expensive one. GoTrue only raises that error for a user it considers **confirmed**. Hand
it an existing but *unconfirmed* address — which is every invite you have cut that nobody
has clicked yet — and it quietly re-issues the invite and returns success. So an
ambassador could put a pending crown's address on their own vendor's card, hit mint, and
be handed that person's live sign-in link.

I replaced the search with the only thing that answers the question exactly: try to create
the account and let the unique index decide. Success means it's new and we made it;
`email_exists` means it was there, deterministically, confirmed or not. **The general
lesson is worth keeping: never infer a security fact from the text of an error, and never
from a paginated search — a substring filter over one page of results is an answer an
attacker can manufacture by creating two hundred lookalike rows.**

**The second: a half-made account wedges the vendor forever.** If the account got created
and then anything downstream failed — the link generation, the membership insert — the auth
row survived with nothing attached to it. The next attempt at the same address now hits
`email_exists`, which for an ambassador is a 409, so that vendor could never be minted
again by the person who owns them. It now rolls the account back on any downstream
failure, so a retry starts from where it started.

The other four were the ordinary kind and are closed: a vendor invited by link was bounced
to the "no crown yet" screen with a spent link and no password control anywhere on their
road; a link-mode mint that returned nothing still toasted *"hand them the temp password"*
for a password that was never generated; the gate's link button leaked membership one
address at a time by printing GoTrue's refusal verbatim; and the returned link rendered
inside a container the mode chips could hide, so flipping a chip made the one thing you
cannot get back disappear.

---

## 12 · What you actually have to do

**Deploy the function.** `supabase/functions/vendor-invite/index.ts` replaces what's there
now. It is backward compatible: the old `{email, vendor_id, temp_password}` shape still
works and still means the password road.

```bash
supabase functions deploy vendor-invite
supabase secrets set DOCK_SITE_URL=https://theshadowhook.com
supabase secrets set AMBASSADOR_MINT=on          # 'off' = only you may mint
```

**Allow the redirect.** Dashboard → Authentication → URL Configuration → Redirect URLs.
Add `https://theshadowhook.com/ambassador` and `https://theshadowhook.com/**`. Without
this the link authenticates and then bounces to your Site URL, where the *app's* client
picks the token up — which is precisely the failure §5 exists to prevent. It will look
like the link is broken when it isn't.

**Ship the pages.** Three files, eleven surgical patches each, nothing else touched:

`ambassador.html` — the crown deck. Diff in `ambassador.patch.diff`: 200 lines added
against 24 touched.

`dockoffice.html` — the vendor deck, which runs the identical mint. Diff in
`dockoffice.patch.diff`: 194 against 23.

`vendor.html` — byte-identical to `dockoffice.html` upstream, so it's shipped as the same
bytes again. If those two have drifted apart on your server since you sent them, use the
diff rather than the file.

Every comment I added is tagged `#linkin`, in the same style as your own `#ambtab2` and
`#arrive` marks.

**Optional, and it makes the function simpler.** One SQL function removes the only awkward
piece of the mint — the fallback that resolves an existing account's uid through GoTrue's
admin search:

```sql
create function public.uid_for_email(p text) returns uuid
  language sql security definer set search_path = '' as
  $$ select id from auth.users where lower(email) = lower(p) limit 1 $$;
revoke execute on function public.uid_for_email(text) from anon, authenticated;
```

Swap it in where the comment says to and delete the fallback.

**About email.** Two different things, and only one of them needs SMTP.

The mint's link does **not**. `generateLink` hands the URL back to you and you send it.
Works today, on a free project, with nothing configured.

The gate's *EMAIL ME A SIGN-IN LINK* button **does**, and this is the one that will
surprise you: without custom SMTP, Supabase Auth *refuses to deliver to addresses that are
not part of the project's team*, at a rate limit currently around two messages an hour.
Ruth's gmail is not on your team. That button will fail for exactly the people who need it
until you point the project at a real sender — Resend, Postmark, SendGrid, any of them —
under Authentication → Emails → SMTP Settings. Until then it's there for you, and the
fallback is that you cut her a link from the deck.

**Then close the hole properly.** §2 is still only half-fixed: an outsider still cannot
begin without you. If you want Ruth's shop-owner friends to be able to knock on the door
themselves, the application page needs a real-email signup in front of it instead of
`ME.uid`. That's a bigger piece of work and I didn't touch it, but it's the same root, and
you'll hit it again.

---

## Ruth, tonight, in about five minutes

Deploy the function and the page, add the redirect URL, open the deck, hit `🗝 PASS` on her
card. It opens on **CUT THEM A LINK** with her address already lowercased in the box.
Press it, copy what comes back, and send it to her the way you'd send her anything else.

She clicks it once. She lands on the ambassador deck, already signed in, with the
set-a-password sheet open in front of her and one line of explanation. She picks something
you will never know.

You didn't invent her password, you didn't say it out loud, and there is nothing sitting
in a text thread with her name and four digits in it.

---

*Sources for the email limits: [Supabase — Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).*
