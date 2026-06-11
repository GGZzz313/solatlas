/* Dev one-off: fetch Keplerian elements for every planetary satellite that
   JPL Horizons knows, relative to the parent planet's center in the ecliptic
   J2000 frame, and write data/moons.json. Mean elements at a single epoch
   propagate well enough for visualization (two-body around the parent).

   Zero dependencies — Node 18+ global fetch only. ~460 requests, throttled. */
import { writeFile, mkdir } from "node:fs/promises";

const H = "https://ssd.jpl.nasa.gov/api/horizons.api";
const EPOCH_START = "2026-06-11";
const EPOCH_STOP = "2026-06-12";
const PARENTS = { 3: "Earth", 4: "Mars", 5: "Jupiter", 6: "Saturn", 7: "Uranus", 8: "Neptune", 9: "Pluto" };

async function getJSON(url, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (err) {
      if (attempt >= tries) throw err;
      await new Promise((f) => setTimeout(f, 2500 * attempt));
    }
  }
}

async function listSatellites() {
  const j = await getJSON(`${H}?format=json&COMMAND='MB'`);
  const sats = [];
  for (const l of (j.result || "").split("\n")) {
    // numbered moons: 3-digit IDs 301..998, skipping planet centers (x99)
    let m = l.match(/^\s*([1-9]\d{2})\s+(\S.*?)\s{2,}/);
    if (m) {
      const id = +m[1];
      if (id >= 301 && id <= 998 && id % 100 !== 99) {
        sats.push({ id, name: m[2].trim(), parent: Math.floor(id / 100) });
        continue;
      }
    }
    // provisional moons: 5-digit IDs (55501 = S/2003 J2 etc.)
    m = l.match(/^\s*([1-9]\d{4})\s+(\S.*?)\s{2,}/);
    if (m) {
      const id = +m[1];
      const parent = Math.floor(id / 10000);
      if (parent >= 3 && parent <= 9) sats.push({ id, name: m[2].trim(), parent });
    }
  }
  return sats;
}

// "S2003_J2" → "S/2003 J2"
function cleanName(n) {
  const m = n.match(/^S(\d{4})_([A-Z])(\d+)$/);
  return m ? `S/${m[1]} ${m[2]}${m[3]}` : n;
}

async function fetchElements(sat) {
  const p = new URLSearchParams({
    format: "json", COMMAND: `'${sat.id}'`, OBJ_DATA: "YES", MAKE_EPHEM: "YES",
    EPHEM_TYPE: "ELEMENTS", CENTER: `'500@${sat.parent}99'`, REF_PLANE: "ECLIPTIC",
    START_TIME: `'${EPOCH_START}'`, STOP_TIME: `'${EPOCH_STOP}'`, STEP_SIZE: "'2d'",
    OUT_UNITS: "AU-D", CSV_FORMAT: "YES",
  });
  const j = await getJSON(`${H}?${p}`);
  const r = j.result || "";
  const m = r.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (!m) throw new Error("no elements");
  const f = m[1].trim().split("\n")[0].split(",").map((s) => +s.trim());
  // CSV: JDTDB,_,EC,QR,IN,OM,W,Tp,N,MA,TA,A,AD,PR
  const [jd, , e, , i, om, w, , n, ma, , a] = [f[0], 0, f[2], f[3], f[4], f[5], f[6], f[7], f[8], f[9], f[10], f[11]];
  if (!(a > 0) || !(e >= 0) || e >= 1 || !isFinite(n)) throw new Error("bad elements");
  const radM = r.match(/adius\s*\(km\)[^=]*=\s*([\d.]+)/) || r.match(/adius,\s*km\s*=\s*([\d.]+)/);
  return {
    id: sat.id, name: cleanName(sat.name), parent: sat.parent,
    a: +a.toPrecision(7), e: +e.toPrecision(5), i: +i.toFixed(3),
    om: +om.toFixed(3), w: +w.toFixed(3), ma: +ma.toFixed(3),
    n: +n.toPrecision(8), epoch: jd,
    radius: radM ? +radM[1] : null,
  };
}

async function main() {
  console.log("Listing satellites from Horizons MB table…");
  const sats = await listSatellites();
  console.log(`  ${sats.length} satellites found`);

  const out = [];
  const failed = [];
  let done = 0;
  // small worker pool — be kind to Horizons
  const queue = [...sats];
  async function worker() {
    while (queue.length) {
      const s = queue.shift();
      try {
        out.push(await fetchElements(s));
      } catch (err) {
        failed.push(s.id + " " + s.name + ": " + err.message);
      }
      if (++done % 40 === 0) console.log(`  ${done}/${sats.length}…`);
      await new Promise((f) => setTimeout(f, 120));
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);

  out.sort((x, y) => x.id - y.id);
  const byP = {};
  for (const o of out) byP[PARENTS[o.parent]] = (byP[PARENTS[o.parent]] || 0) + 1;
  console.log("fetched:", JSON.stringify(byP));
  if (failed.length) console.log("failed (" + failed.length + "):\n  " + failed.join("\n  "));

  await mkdir("data", { recursive: true });
  await writeFile("data/moons.json", JSON.stringify({
    generated: new Date().toISOString(),
    source: "NASA/JPL Horizons (osculating elements vs parent planet, ecliptic J2000)",
    count: out.length,
    moons: out,
  }));
  const kb = (Buffer.byteLength(JSON.stringify(out)) / 1024).toFixed(0);
  console.log(`Wrote data/moons.json — ${out.length} moons, ${kb} KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
