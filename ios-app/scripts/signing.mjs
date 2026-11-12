// Shadow Hook — iOS signing for the cloud build (GitHub's Mac).
// Uses the App Store Connect API key to make a fresh Apple Distribution certificate and an App Store profile
// (with Push Notifications switched on for the app ID), so the archive is signed with push. "cleanup" revokes the
// profiles afterwards. With the vault (see below) the certificate is kept and reused, so nothing is revoked; without it
// the certificate is revoked too. Builds already sent to Apple are not affected: Apple re-signs them itself.
//
//   node signing.mjs setup   <outdir>   -> writes dist.key, dist.cer, profile.mobileprovision, profile-name.txt, state.json
//   node signing.mjs cleanup <outdir>   -> revokes what setup made
//
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_FILE (path to the .p8), BUNDLE_ID,
//      EXTRA_BUNDLES (optional, "bundle.id:Label,...": also registers each extension's app ID and makes its profile)
import { createSign, createPrivateKey, generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const [mode, out] = process.argv.slice(2);
const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_FILE, BUNDLE_ID, WIDGET_BUNDLE_ID } = process.env;
// Optional vault: with SUPABASE_URL + SUPABASE_SERVICE_KEY the certificate and its private key are kept in km_secrets
// (service role only) and reused by every build, so nothing is revoked and Apple sends no "certificate revoked" emails.
const VAULT_URL = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, ""), VAULT_KEY = (process.env.SUPABASE_SERVICE_KEY || "").trim();
const VH = { apikey: VAULT_KEY, Authorization: "Bearer " + VAULT_KEY, "Content-Type": "application/json" };
async function vaultGet() {
  if (!VAULT_URL || !VAULT_KEY) return null;
  try {
    const r = await fetch(VAULT_URL + "/rest/v1/km_secrets?select=name,value&name=in.(ios_dist_cert_id,ios_dist_cert,ios_dist_key)", { headers: VH });
    if (!r.ok) return null;
    const o = {}; for (const row of await r.json()) o[row.name] = row.value;
    return (o.ios_dist_cert_id && o.ios_dist_cert && o.ios_dist_key) ? o : null;
  } catch { return null; }
}
async function vaultPut(id, certB64, keyPem) {
  if (!VAULT_URL || !VAULT_KEY) return false;
  try {
    const now = new Date().toISOString();
    const r = await fetch(VAULT_URL + "/rest/v1/km_secrets?on_conflict=name", { method: "POST",
      headers: { ...VH, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ name: "ios_dist_cert_id", value: id, set_at: now }, { name: "ios_dist_cert", value: certB64, set_at: now }, { name: "ios_dist_key", value: keyPem, set_at: now }]) });
    return r.ok;
  } catch { return false; }
}
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

  // 2. the Apple Distribution certificate: the one kept in the vault if Apple still honours it, otherwise a fresh one
  let certId = "", keep = false;
  const saved = await vaultGet();
  if (saved) {
    const chk = await api("GET", "/certificates/" + saved.ios_dist_cert_id);
    const exp = chk.ok ? Date.parse(chk.j.data.attributes.expirationDate || "") : 0;
    if (chk.ok && exp - Date.now() > 14 * 86400000) {
      writeFileSync(join(out, "dist.key"), saved.ios_dist_key, { mode: 0o600 });
      writeFileSync(join(out, "dist.cer"), Buffer.from(saved.ios_dist_cert, "base64"));
      certId = saved.ios_dist_cert_id; keep = true;
      console.log("certificate: reusing " + certId + " from the vault (nothing to revoke later)");
    } else console.log("certificate: the one in the vault is gone or expiring; making a new one");
  }
  if (!certId) {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const keyPem = privateKey.export({ type: "pkcs8", format: "pem" });
    writeFileSync(join(out, "dist.key"), keyPem, { mode: 0o600 });
    execFileSync("/usr/bin/openssl", ["req", "-new", "-key", join(out, "dist.key"), "-out", join(out, "dist.csr"),
      "-subj", "/emailAddress=support@theshadowhook.com/CN=Shadow Hook CI/C=US"]);
    const csr = readFileSync(join(out, "dist.csr"), "utf8");
    const cert = await api("POST", "/certificates", { data: { type: "certificates", attributes: { certificateType: "DISTRIBUTION", csrContent: csr } } });
    if (!cert.ok) fail("could not create a distribution certificate (if Apple says the limit is reached, revoke an old Distribution certificate at developer.apple.com > Certificates)", cert);
    writeFileSync(join(out, "dist.cer"), Buffer.from(cert.j.data.attributes.certificateContent, "base64"));
    certId = cert.j.data.id;
    keep = await vaultPut(certId, cert.j.data.attributes.certificateContent, keyPem);
    console.log("certificate: made " + certId + (keep ? " and stored it in the vault for the next builds" : " (no vault: it will be revoked at the end of this run)"));
  }
  writeFileSync(join(out, "state.json"), JSON.stringify({ cert: keep ? null : certId, profiles: [] }));

  // 3. an App Store profile for this app ID and certificate
  const prof = await api("POST", "/profiles", { data: { type: "profiles",
    attributes: { name: PROFILE_NAME, profileType: "IOS_APP_STORE" },
    relationships: { bundleId: { data: { type: "bundleIds", id: bundle.id } },
      certificates: { data: [{ type: "certificates", id: certId }] } } } });
  if (!prof.ok) fail("could not create the App Store profile (the cleanup step tidies up)", prof);
  writeFileSync(join(out, "profile.mobileprovision"), Buffer.from(prof.j.data.attributes.profileContent, "base64"));
  writeFileSync(join(out, "profile-name.txt"), PROFILE_NAME);
  writeFileSync(join(out, "profile-uuid.txt"), prof.j.data.attributes.uuid);
  const state = { cert: keep ? null : certId, profiles: [prof.j.data.id] };
  writeFileSync(join(out, "state.json"), JSON.stringify(state));
  console.log("profile: made \"" + PROFILE_NAME + "\" " + prof.j.data.attributes.uuid);

  // 4. the extensions (widgets, the Apple Watch app and its complications): each has its own app ID (made once)
  //    and its own App Store profile. EXTRA_BUNDLES = "bundle.id:Label,bundle.id:Label"
  const profiles = {};
  profiles[BUNDLE_ID] = { name: PROFILE_NAME, uuid: prof.j.data.attributes.uuid, file: "profile.mobileprovision" };
  const extras = (process.env.EXTRA_BUNDLES || (WIDGET_BUNDLE_ID ? WIDGET_BUNDLE_ID + ":Shadow Hook Widgets" : "")).split(",").map(x => x.trim()).filter(Boolean);
  let n = 0;
  for (const item of extras) {
    n++;
    const ident = item.split(":")[0].trim(), label = (item.split(":")[1] || ("Shadow Hook Extra " + n)).trim();
    const wb = await api("GET", "/bundleIds?filter[identifier]=" + encodeURIComponent(ident) + "&limit=20");
    let wBundle = wb.ok ? (wb.j.data || []).find(x => x.attributes.identifier === ident) : null;
    if (!wBundle) {
      const mk = await api("POST", "/bundleIds", { data: { type: "bundleIds", attributes: { identifier: ident, name: label, platform: "IOS" } } });
      if (!mk.ok) fail("could not register the app ID " + ident, mk);
      wBundle = mk.j.data;
      console.log("app ID: registered " + ident);
    }
    const wName = PROFILE_NAME + " " + label.replace(/^Shadow Hook /, "");
    const wp = await api("POST", "/profiles", { data: { type: "profiles",
      attributes: { name: wName, profileType: "IOS_APP_STORE" },
      relationships: { bundleId: { data: { type: "bundleIds", id: wBundle.id } },
        certificates: { data: [{ type: "certificates", id: certId }] } } } });
    if (!wp.ok) fail("could not create the profile for " + ident + " (the cleanup step tidies up)", wp);
    const file = "profile-" + n + ".mobileprovision";
    writeFileSync(join(out, file), Buffer.from(wp.j.data.attributes.profileContent, "base64"));
    profiles[ident] = { name: wName, uuid: wp.j.data.attributes.uuid, file };
    state.profiles.push(wp.j.data.id);
    writeFileSync(join(out, "state.json"), JSON.stringify(state));
    console.log("profile: made \"" + wName + "\" for " + ident);
  }

  // 5. hand-offs for the build: the list of profiles, the ExportOptions fragment, and the profiles installed on this Mac
  writeFileSync(join(out, "profiles.json"), JSON.stringify(profiles));
  writeFileSync(join(out, "export-profiles.xml"), Object.entries(profiles).map(([id, p]) => "<key>" + id + "</key><string>" + p.name + "</string>").join(""));
  const dir = join(process.env.HOME || ".", "Library/MobileDevice/Provisioning Profiles");
  mkdirSync(dir, { recursive: true });
  for (const p of Object.values(profiles)) copyFileSync(join(out, p.file), join(dir, p.uuid + ".mobileprovision"));
  console.log("installed " + Object.keys(profiles).length + " profiles");
}

async function cleanup() {
  const f = join(out, "state.json");
  if (!existsSync(f)) { console.log("nothing to clean up"); return; }
  const s = JSON.parse(readFileSync(f, "utf8"));
  for (const id of (s.profiles || (s.profile ? [s.profile] : []))) { const r = await api("DELETE", "/profiles/" + id); console.log("profile removed: " + r.status); }
  if (s.cert) { const r = await api("DELETE", "/certificates/" + s.cert); console.log("certificate revoked: " + r.status); }
}

if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_FILE || !BUNDLE_ID || !out) fail("missing settings for signing.mjs");
await (mode === "setup" ? setup() : mode === "cleanup" ? cleanup() : Promise.reject(new Error("mode must be setup or cleanup")));
