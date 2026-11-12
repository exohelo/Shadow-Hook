// Shadow Hook — iOS signing for the cloud build (GitHub's Mac).
// Uses the App Store Connect API key to make a fresh Apple Distribution certificate and an App Store profile
// (with Push Notifications switched on for the app ID), so the archive is signed with push. "cleanup" revokes the
// certificate and deletes the profile afterwards, so they never pile up. Builds already sent to Apple are not affected:
// Apple re-signs TestFlight and App Store builds itself.
//
//   node signing.mjs setup   <outdir>   -> writes dist.key, dist.cer, profile.mobileprovision, profile-name.txt, state.json
//   node signing.mjs cleanup <outdir>   -> revokes what setup made
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_FILE (path to the .p8), BUNDLE_ID
import { createSign, createPrivateKey, generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const [mode, out] = process.argv.slice(2);
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_FILE, BUNDLE_ID } = process.env;
const API = "https://api.appstoreconnect.apple.com/v1";
const PROFILE_NAME = "Shadow Hook CI " + (process.env.GITHUB_RUN_NUMBER || Date.now());

function b64url(buf) { return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"); }
function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" }));
  const s = createSign("SHA256"); s.update(head + "." + body);
  const sig = s.sign({ key: createPrivateKey(readFileSync(ASC_KEY_FILE)), dsaEncoding: "ieee-p1363" });
  return head + "." + body + "." + b64url(sig);
}
async function api(method, path, body) {
  const r = await fetch(API + path, {
    method, headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j = null; try { j = text ? JSON.parse(text) : null; } catch {}
  return { ok: r.ok, status: r.status, j, text };
}
function fail(msg, r) {
  console.error("::error::" + msg + (r ? " (HTTP " + r.status + "): " + (r.j?.errors?.map(e => e.detail || e.title).join("; ") || r.text.slice(0, 300)) : ""));
  process.exit(1);
}

async function setup() {
  mkdirSync(out, { recursive: true });
  // 1. the app ID, and Push Notifications switched on for it
  const b = await api("GET", "/bundleIds?filter[identifier]=" + encodeURIComponent(BUNDLE_ID) + "&limit=5");
  if (!b.ok) fail("could not look up the app ID", b);
  const bundle = (b.j.data || []).find(x => x.attributes.identifier === BUNDLE_ID);
  if (!bundle) fail("app ID " + BUNDLE_ID + " not found in the developer account");
  const capGet = await api("GET", "/bundleIds/" + bundle.id + "/bundleIdCapabilities");
  const hasPush = capGet.ok && (capGet.j.data || []).some(c => c.attributes.capabilityType === "PUSH_NOTIFICATIONS");
  if (!hasPush) {
    const cap = await api("POST", "/bundleIdCapabilities", { data: { type: "bundleIdCapabilities",
      attributes: { capabilityType: "PUSH_NOTIFICATIONS" },
      relationships: { bundleId: { data: { type: "bundleIds", id: bundle.id } } } } });
    if (!cap.ok && cap.status !== 409) fail("could not switch on Push Notifications for the app ID", cap);
    console.log("push notifications: switched on for " + BUNDLE_ID);
  } else console.log("push notifications: already on for " + BUNDLE_ID);

  // 2. a fresh Apple Distribution certificate (RSA 2048 key made here, never leaves this Mac)
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const keyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  writeFileSync(join(out, "dist.key"), keyPem, { mode: 0o600 });
  execFileSync("/usr/bin/openssl", ["req", "-new", "-key", join(out, "dist.key"), "-out", join(out, "dist.csr"),
    "-subj", "/emailAddress=support@theshadowhook.com/CN=Shadow Hook CI/C=US"]);
  const csr = readFileSync(join(out, "dist.csr"), "utf8");
  let cert = await api("POST", "/certificates", { data: { type: "certificates", attributes: { certificateType: "DISTRIBUTION", csrContent: csr } } });
  if (!cert.ok && cert.status === 409) {
    // at the certificate limit: revoke distribution certificates this build made before (named "Shadow Hook CI"), then retry once
    const list = await api("GET", "/certificates?filter[certificateType]=DISTRIBUTION&limit=20");
    const ours = (list.j?.data || []).filter(c => /Shadow Hook CI/.test(c.attributes.name || "") || /Shadow Hook CI/.test(c.attributes.displayName || ""));
    for (const c of ours) { await api("DELETE", "/certificates/" + c.id); console.log("revoked an old CI certificate " + c.id); }
    cert = await api("POST", "/certificates", { data: { type: "certificates", attributes: { certificateType: "DISTRIBUTION", csrContent: csr } } });
  }
  if (!cert.ok) fail("could not create a distribution certificate", cert);
  writeFileSync(join(out, "dist.cer"), Buffer.from(cert.j.data.attributes.certificateContent, "base64"));
  console.log("certificate: made " + cert.j.data.id + " (" + (cert.j.data.attributes.displayName || cert.j.data.attributes.name) + ")");

  // 3. an App Store profile for this app ID and certificate
  const prof = await api("POST", "/profiles", { data: { type: "profiles",
    attributes: { name: PROFILE_NAME, profileType: "IOS_APP_STORE" },
    relationships: { bundleId: { data: { type: "bundleIds", id: bundle.id } },
      certificates: { data: [{ type: "certificates", id: cert.j.data.id }] } } } });
  if (!prof.ok) { await api("DELETE", "/certificates/" + cert.j.data.id); fail("could not create the App Store profile", prof); }
  writeFileSync(join(out, "profile.mobileprovision"), Buffer.from(prof.j.data.attributes.profileContent, "base64"));
  writeFileSync(join(out, "profile-name.txt"), PROFILE_NAME);
  writeFileSync(join(out, "profile-uuid.txt"), prof.j.data.attributes.uuid);
  writeFileSync(join(out, "state.json"), JSON.stringify({ cert: cert.j.data.id, profile: prof.j.data.id }));
  console.log("profile: made \"" + PROFILE_NAME + "\" " + prof.j.data.attributes.uuid);
}

async function cleanup() {
  const f = join(out, "state.json");
  if (!existsSync(f)) { console.log("nothing to clean up"); return; }
  const s = JSON.parse(readFileSync(f, "utf8"));
  if (s.profile) { const r = await api("DELETE", "/profiles/" + s.profile); console.log("profile removed: " + r.status); }
  if (s.cert) { const r = await api("DELETE", "/certificates/" + s.cert); console.log("certificate revoked: " + r.status); }
}

if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_FILE || !BUNDLE_ID || !out) fail("missing settings for signing.mjs");
await (mode === "setup" ? setup() : mode === "cleanup" ? cleanup() : Promise.reject(new Error("mode must be setup or cleanup")));
