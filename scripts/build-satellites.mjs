/* ============================================================
   build-satellites.mjs — data/satellites.json
   ============================================================
   Active-satellite TLEs from CelesTrak (legally redistributable;
   no auth), PLUS the major tracked debris clouds. TLEs go stale
   within days, so this runs DAILY in CI (satellite-refresh.yml),
   separate from the weekly small-body snapshot. The app lazy-loads
   the result only when the camera reaches Earth.

   Output order is PAYLOADS first, then DEBRIS, with payloadCount
   marking the split — the app draws the two ranges in two colours.

   Local regen without re-hitting CelesTrak for the big active feed
   (they throttle repeat full-catalog pulls): pass a cached active
   TLE file —  node scripts/build-satellites.mjs path/to/active.txt
   (the small debris groups are always fetched fresh.)

   Zero dependencies — Node 18+ global fetch only.
   ============================================================ */
import { writeFile, mkdir, readFile } from "node:fs/promises";

const ACTIVE = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle";
// The significant tracked breakup clouds — the real "space junk" people mean:
// Fengyun-1C ASAT (2007), Iridium-33 / Cosmos-2251 collision (2009), Cosmos-1408 ASAT (2021).
const DEBRIS_GROUPS = ["fengyun-1c-debris", "cosmos-2251-debris", "iridium-33-debris", "cosmos-1408-debris"];
const gpURL = (g) => `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=tle`;

async function fetchTLE(url) {
  const r = await fetch(url, { headers: { "User-Agent": "AsteroidAtlas/1.0 (educational)" } });
  if (!r.ok) throw new Error("HTTP " + r.status + " for " + url);
  const txt = await r.text();
  if (/GP data has not updated|Invalid query|^<!DOCTYPE/i.test(txt.slice(0, 200)))
    throw new Error("CelesTrak throttled or returned non-TLE data for " + url);
  return txt;
}

// TLE text → [[name, l1, l2], …]
function parseTLE(txt) {
  const lines = txt.split(/\r?\n/);
  const out = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = (lines[i] || "").trim();
    const l1 = lines[i + 1], l2 = lines[i + 2];
    if (!name || !l1 || !l2 || l1[0] !== "1" || l2[0] !== "2") { i -= 2; continue; }
    out.push([name, l1, l2]);
  }
  return out;
}
const catnum = (l1) => l1.slice(2, 7).trim();

async function main() {
  const cache = process.argv[2];
  const activeTxt = cache
    ? (console.log("Reading cached active TLEs from", cache), await readFile(cache, "utf8"))
    : (console.log("Fetching active satellites from CelesTrak…"), await fetchTLE(ACTIVE));
  const payloads = parseTLE(activeTxt);
  if (payloads.length < 1000) throw new Error("suspiciously few satellites: " + payloads.length);

  const seen = new Set(payloads.map((s) => catnum(s[1])));
  const debris = [];
  for (const g of DEBRIS_GROUPS) {
    console.log("Fetching debris group", g, "…");
    let txt;
    try { txt = await fetchTLE(gpURL(g)); }
    catch (e) { console.warn("  skipped", g + ":", e.message); continue; }
    let added = 0;
    for (const s of parseTLE(txt)) {
      const c = catnum(s[1]);
      if (seen.has(c)) continue;       // dedupe within debris and against payloads
      seen.add(c); debris.push(s); added++;
    }
    console.log("  +", added, "objects");
  }

  const sats = [...payloads, ...debris];
  await mkdir("data", { recursive: true });
  const out = {
    generated: new Date().toISOString(),
    count: sats.length,
    payloadCount: payloads.length,
    sats,
  };
  await writeFile("data/satellites.json", JSON.stringify(out));
  // tiny companion so the header's man-made count loads without the 2.5 MB file
  await writeFile("data/sat-count.json", JSON.stringify({
    count: sats.length, payloads: payloads.length, debris: debris.length,
  }));
  const mb = (Buffer.byteLength(JSON.stringify(out)) / 1e6).toFixed(2);
  console.log(`Wrote data/satellites.json — ${payloads.length} payloads + ${debris.length} debris = ${sats.length}, ${mb} MB`);
}

main().catch((e) => { console.error("build-satellites failed:", e.message); process.exit(1); });
