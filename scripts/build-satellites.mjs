/* ============================================================
   build-satellites.mjs — data/satellites.json
   ============================================================
   Active-satellite TLEs from CelesTrak (legally redistributable;
   no auth). TLEs go stale within days, so this runs DAILY in CI
   (satellite-refresh.yml), separate from the weekly small-body
   snapshot. The app lazy-loads the result only when the camera
   reaches Earth.

   Local regen without re-hitting CelesTrak (they throttle repeat
   full-catalog pulls):  node scripts/build-satellites.mjs path/to/cache.txt

   Zero dependencies — Node 18+ global fetch only.
   ============================================================ */
import { writeFile, mkdir, readFile } from "node:fs/promises";

const SRC = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle";

async function getTLEText() {
  const cache = process.argv[2];
  if (cache) {
    console.log("Reading cached TLEs from", cache);
    return readFile(cache, "utf8");
  }
  console.log("Fetching active satellites from CelesTrak…");
  const r = await fetch(SRC, { headers: { "User-Agent": "AsteroidAtlas/1.0 (educational)" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const txt = await r.text();
  if (/GP data has not updated|Invalid query|^<!DOCTYPE/i.test(txt.slice(0, 200)))
    throw new Error("CelesTrak throttled or returned non-TLE data");
  return txt;
}

async function main() {
  const lines = (await getTLEText()).split(/\r?\n/);
  const sats = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = (lines[i] || "").trim();
    const l1 = lines[i + 1], l2 = lines[i + 2];
    if (!name || !l1 || !l2 || l1[0] !== "1" || l2[0] !== "2") { i -= 2; continue; }
    sats.push([name, l1, l2]);
  }
  if (sats.length < 1000) throw new Error("suspiciously few satellites: " + sats.length);

  await mkdir("data", { recursive: true });
  const out = { generated: new Date().toISOString(), count: sats.length, sats };
  await writeFile("data/satellites.json", JSON.stringify(out));
  // tiny companion so the header's man-made count loads without the 2.5 MB file
  await writeFile("data/sat-count.json", JSON.stringify({ count: sats.length }));
  const mb = (Buffer.byteLength(JSON.stringify(out)) / 1e6).toFixed(2);
  console.log(`Wrote data/satellites.json — ${sats.length} satellites, ${mb} MB`);
}

main().catch((e) => { console.error("build-satellites failed:", e.message); process.exit(1); });
