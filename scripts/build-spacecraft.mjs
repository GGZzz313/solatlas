/* ============================================================
   build-spacecraft.mjs — data/spacecraft.json
   ============================================================
   Heliocentric ecliptic trajectories for the famous in-flight deep-space
   probes, sampled from JPL Horizons (VECTORS). The polylines are time-
   parameterised [jd, x, y, z] so the app interpolates a live position at
   any sim time; they cover decades, so this rarely needs refreshing.

   Run standalone or as a step in data-refresh.yml.
   Zero dependencies — Node 18+ global fetch only.
   ============================================================ */
import { writeFile, mkdir } from "node:fs/promises";

const H = "https://ssd.jpl.nasa.gov/api/horizons.api";

// id = Horizons COMMAND. status: "active" (still talking) | "silent" (coasting,
// comms ended). step tuned per orbit: tight for sun-divers, coarse for cruisers.
const CRAFT = [
  { id: "-31", name: "Voyager 1", op: "NASA/JPL", launch: 1977, status: "active",
    note: "The farthest human-made object — in interstellar space since 2012 and still returning data.",
    start: "1977-09-06", stop: "2050-01-01", step: "150d" },
  { id: "-32", name: "Voyager 2", op: "NASA/JPL", launch: 1977, status: "active",
    note: "The only probe to visit all four giant planets; crossed into interstellar space in 2018.",
    start: "1977-08-21", stop: "2050-01-01", step: "150d" },
  { id: "-23", name: "Pioneer 10", op: "NASA/Ames", launch: 1972, status: "silent",
    note: "First probe through the asteroid belt and past Jupiter. Last signal 2003 — still coasting toward Aldebaran.",
    start: "1972-03-04", stop: "2030-01-01", step: "150d" },
  { id: "-24", name: "Pioneer 11", op: "NASA/Ames", launch: 1973, status: "silent",
    note: "First flyby of Saturn. Contact lost in 1995; drifting on toward Aquila.",
    start: "1973-04-07", stop: "2050-01-01", step: "150d" },
  { id: "-98", name: "New Horizons", op: "NASA/JHUAPL", launch: 2006, status: "active",
    note: "Flew past Pluto (2015) and Arrokoth (2019); now exploring the outer Kuiper Belt.",
    start: "2006-01-20", stop: "2050-01-01", step: "120d" },
  { id: "-96", name: "Parker Solar Probe", op: "NASA/JHUAPL", launch: 2018, status: "active",
    note: "Repeatedly dives through the Sun's corona — the fastest object ever built.",
    start: "2018-08-13", stop: "2026-08-01", step: "6d" },
  { id: "-49", name: "Lucy", op: "NASA/SwRI", launch: 2021, status: "active",
    note: "On a twelve-year tour of the Jupiter Trojan asteroids.",
    start: "2021-10-17", stop: "2033-03-01", step: "30d" },
  { id: "-255", name: "Psyche", op: "NASA/JPL", launch: 2023, status: "active",
    note: "En route to the metal asteroid 16 Psyche, arriving 2029.",
    start: "2023-10-16", stop: "2029-06-01", step: "20d" },
  { id: "-143205", name: "Starman", op: "SpaceX", launch: 2018, status: "silent",
    note: "Elon Musk's cherry-red Tesla Roadster — launched on Falcon Heavy's maiden flight (6 Feb 2018) with a spacesuited 'Starman' dummy at the wheel and 'DON'T PANIC' on the dash. Coasting on a Sun-orbit that crosses Mars; no signal since launch day.",
    img: ["starman.jpg", "SpaceX (public domain)"],
    start: "2018-02-08", stop: "2050-01-01", step: "20d" },
];

async function getJSON(url, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (err) {
      if (attempt >= tries) throw err;
      await new Promise((f) => setTimeout(f, 3000 * attempt));
    }
  }
}

async function trajectory(c) {
  const p = new URLSearchParams({
    format: "json", COMMAND: `'${c.id}'`, OBJ_DATA: "NO", MAKE_EPHEM: "YES",
    EPHEM_TYPE: "VECTORS", CENTER: "'500@10'", REF_PLANE: "ECLIPTIC",
    START_TIME: `'${c.start}'`, STOP_TIME: `'${c.stop}'`, STEP_SIZE: `'${c.step}'`,
    VEC_TABLE: "1", OUT_UNITS: "AU-D", CSV_FORMAT: "YES",
  });
  const j = await getJSON(`${H}?${p}`);
  const m = (j.result || "").match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (!m) throw new Error("no ephemeris");
  const points = [];
  for (const line of m[1].trim().split("\n")) {
    const f = line.split(",");
    if (f.length < 5) continue;
    const jd = +f[0], x = +f[2], y = +f[3], z = +f[4];
    if (!isFinite(jd) || !isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
    points.push([Math.round(jd * 10) / 10, +x.toFixed(4), +y.toFixed(4), +z.toFixed(4)]);
  }
  if (!points.length) throw new Error("no points parsed");
  return { name: c.name, op: c.op, launch: c.launch, status: c.status, note: c.note, img: c.img, points };
}

async function main() {
  console.log("Fetching spacecraft trajectories from JPL Horizons…");
  const out = [];
  for (const c of CRAFT) {
    try {
      const t = await trajectory(c);
      out.push(t);
      console.log(`  ${c.name.padEnd(20)} →  ${t.points.length} points`);
    } catch (err) {
      console.warn(`  ${c.name} unavailable:`, err.message);
    }
  }
  if (!out.length) throw new Error("no spacecraft fetched");
  await mkdir("data", { recursive: true });
  const payload = { generated: new Date().toISOString(), count: out.length, craft: out };
  await writeFile("data/spacecraft.json", JSON.stringify(payload));
  const kb = (Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(0);
  console.log(`Wrote data/spacecraft.json — ${out.length} craft, ${kb} KB`);
}

main().catch((e) => { console.error("build-spacecraft failed:", e.message); process.exit(1); });
