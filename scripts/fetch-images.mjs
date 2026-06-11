/* Dev one-off: download real spacecraft imagery for the handful of small
   bodies that have genuinely been resolved (visited or radar-imaged).
   Resolves each canonical image via the Wikipedia REST summary API, then
   saves a thumbnail into img/bodies/. Everything else uses the procedural
   preview — we only show a "photo" where a real one exists. */
import { writeFile, mkdir } from "node:fs/promises";

// key (matches an object's designation/name) → Wikipedia article + credit
const BODIES = [
  ["ceres", "Ceres_(dwarf_planet)", "NASA/JPL-Caltech/Dawn"],
  ["vesta", "4_Vesta", "NASA/JPL-Caltech/Dawn"],
  ["pluto", "Pluto", "NASA/JHUAPL/SwRI · New Horizons"],
  ["bennu", "101955_Bennu", "NASA/Goddard/OSIRIS-REx"],
  ["ryugu", "162173_Ryugu", "JAXA/Hayabusa2"],
  ["eros", "433_Eros", "NASA/JPL/NEAR"],
  ["itokawa", "25143_Itokawa", "JAXA/Hayabusa"],
  ["ida", "243_Ida", "NASA/JPL/Galileo"],
  ["gaspra", "951_Gaspra", "NASA/JPL/Galileo"],
  ["mathilde", "253_Mathilde", "NASA/JPL/NEAR"],
  ["lutetia", "21_Lutetia", "ESA/Rosetta/OSIRIS"],
  ["steins", "2867_Steins", "ESA/Rosetta/OSIRIS"],
  ["dinkinesh", "152830_Dinkinesh", "NASA/Goddard/SwRI/Lucy"],
  ["dimorphos", "Dimorphos", "NASA/JHUAPL/DART"],
  ["arrokoth", "486958_Arrokoth", "NASA/JHUAPL/SwRI · New Horizons"],
  ["halley", "Halley%27s_Comet", "ESA/Giotto/MPAe"],
  ["churyumov", "67P/Churyumov–Gerasimenko", "ESA/Rosetta/NavCam"],
  ["tempel", "Tempel_1", "NASA/JPL/UMD · Deep Impact"],
  ["wild", "81P/Wild", "NASA/JPL/Stardust"],
  ["hartley", "103P/Hartley", "NASA/JPL/UMD · EPOXI"],
  ["borrelly", "19P/Borrelly", "NASA/JPL · Deep Space 1"],
  // planets
  ["mercury", "Mercury_(planet)", "NASA/JHUAPL · MESSENGER"],
  ["venus", "Venus", "NASA/JPL · Mariner 10"],
  ["earth", "Earth", "NASA · Apollo 17"],
  ["mars", "Mars", "ESA · Rosetta/OSIRIS"],
  ["jupiter", "Jupiter", "NASA/ESA · Hubble"],
  ["saturn", "Saturn", "NASA/JPL/SSI · Cassini"],
  ["uranus", "Uranus", "NASA/JPL · Voyager 2"],
  ["neptune", "Neptune", "NASA/JPL · Voyager 2"],
  // major moons
  ["luna", "Moon", "NASA/GSFC · LRO"],
  ["phobos", "Phobos_(moon)", "NASA/JPL/UA · MRO"],
  ["deimos", "Deimos_(moon)", "NASA/JPL/UA · MRO"],
  ["io", "Io_(moon)", "NASA/JPL · Galileo"],
  ["europa-moon", "Europa_(moon)", "NASA/JPL · Galileo"],
  ["ganymede", "Ganymede_(moon)", "NASA/JPL · Juno"],
  ["callisto", "Callisto_(moon)", "NASA/JPL · Galileo"],
  ["amalthea", "Amalthea_(moon)", "NASA/JPL · Galileo"],
  ["mimas", "Mimas", "NASA/JPL/SSI · Cassini"],
  ["enceladus", "Enceladus", "NASA/JPL/SSI · Cassini"],
  ["tethys", "Tethys_(moon)", "NASA/JPL/SSI · Cassini"],
  ["dione", "Dione_(moon)", "NASA/JPL/SSI · Cassini"],
  ["rhea", "Rhea_(moon)", "NASA/JPL/SSI · Cassini"],
  ["titan", "Titan_(moon)", "NASA/JPL/SSI · Cassini"],
  ["hyperion", "Hyperion_(moon)", "NASA/JPL/SSI · Cassini"],
  ["iapetus", "Iapetus_(moon)", "NASA/JPL/SSI · Cassini"],
  ["phoebe-moon", "Phoebe_(moon)", "NASA/JPL/SSI · Cassini"],
  ["miranda", "Miranda_(moon)", "NASA/JPL · Voyager 2"],
  ["ariel", "Ariel_(moon)", "NASA/JPL · Voyager 2"],
  ["umbriel", "Umbriel", "NASA/JPL · Voyager 2"],
  ["titania", "Titania_(moon)", "NASA/JPL · Voyager 2"],
  ["oberon", "Oberon_(moon)", "NASA/JPL · Voyager 2"],
  ["triton", "Triton_(moon)", "NASA/JPL · Voyager 2"],
  ["proteus", "Proteus_(moon)", "NASA/JPL · Voyager 2"],
  ["charon", "Charon_(moon)", "NASA/JHUAPL/SwRI · New Horizons"],
];

const UA = "AsteroidAtlas/1.0 (https://github.com/GGZzz313/test1; educational project)";
const sleep = (ms) => new Promise((f) => setTimeout(f, ms));

async function getWithRetry(url, accept) {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: accept } });
    if (r.status === 429 && attempt < 5) { await sleep(3000 * attempt); continue; }
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r;
  }
}

async function fetchSummary(title) {
  const r = await getWithRetry(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
    "application/json"
  );
  return r.json();
}

async function main() {
  await mkdir("img/bodies", { recursive: true });
  const manifest = {};
  for (const [key, title, credit] of BODIES) {
    try {
      const s = await fetchSummary(title);
      // use the summary thumbnail (already small); bump to ~480px wide
      const src = s.thumbnail && s.thumbnail.source;
      if (!src) throw new Error("no thumbnail in summary");
      const ir = await getWithRetry(src, "image/*");
      const ct = ir.headers.get("content-type") || "";
      const buf = Buffer.from(await ir.arrayBuffer());
      if (!ct.startsWith("image/") || buf.length < 3000) throw new Error("not a valid image (" + ct + ", " + buf.length + "b)");
      const ext = ct.includes("png") ? "png" : "jpg";
      await writeFile(`img/bodies/${key}.${ext}`, buf);
      manifest[key] = { file: `img/bodies/${key}.${ext}`, credit };
      console.log(`  ✓ ${key.padEnd(12)} ${(buf.length / 1024).toFixed(0)}KB  ${ext}`);
    } catch (err) {
      console.warn(`  ✗ ${key.padEnd(12)} ${err.message}`);
    }
    await sleep(1200);
  }
  await writeFile("img/bodies/manifest.json", JSON.stringify(manifest, null, 2));
  console.log(`\nSaved ${Object.keys(manifest).length}/${BODIES.length} images → img/bodies/manifest.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
