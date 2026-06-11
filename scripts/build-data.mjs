/* ============================================================
   build-data.mjs — assemble data/asteroids.json
   ============================================================
   The JPL SSD APIs don't send CORS headers, so the browser can't
   query them directly. This script pulls the same queries
   server-side (in CI via data-refresh.yml, or locally) and writes
   one packed snapshot the app serves from its own origin.

   Zero dependencies — Node 18+ global fetch only.
   ============================================================ */
import { writeFile, mkdir } from "node:fs/promises";

const API = "https://ssd-api.jpl.nasa.gov";

// Orbital elements + physical params + hazard flags for the info panel.
const AST_FIELDS =
  "pdes,name,a,e,i,om,w,ma,epoch,H,class,diameter,albedo,rot_per,spec_B,spec_T,pha,moid";
// Comets are parameterised by perihelion distance q and time of
// perihelion passage tp rather than a / mean-anomaly.
const COM_FIELDS = "pdes,name,e,i,om,w,q,tp,epoch,diameter,rot_per";

async function getJSON(url, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (err) {
      if (attempt >= tries) throw err;
      await new Promise((f) => setTimeout(f, 4000 * attempt));
    }
  }
}

async function query(params, fields = AST_FIELDS) {
  const url = `${API}/sbdb_query.api?fields=${fields}&${params}`;
  const j = await getJSON(url);
  if (!Array.isArray(j.fields) || !Array.isArray(j.data))
    throw new Error("bad SBDB response for: " + params);
  console.log(`  ${params}  →  ${j.data.length} rows (count=${j.count})`);
  return j;
}

async function main() {
  console.log("Fetching NASA/JPL small-body data…");

  // ---- asteroids, by dynamical population ----
  // TNO/CEN sorted by -diameter so the named dwarf planets are always in range.
  const queries = await Promise.all([
    query("sb-kind=a&sb-group=neo&limit=8000"),
    query("sb-kind=a&limit=30000"),
    query("sb-kind=a&sb-class=TJN&limit=5000"),
    query("sb-kind=a&sb-class=CEN&sort=-diameter&limit=2500"),
    query("sb-kind=a&sb-class=TNO&sort=-diameter&limit=7000"),
  ]);
  const totalKnown = queries[1].count;

  // ---- comets (periodic + Halley-type; long-period/hyperbolic dropped app-side) ----
  let comets = null;
  try {
    comets = await query("sb-kind=c&limit=5000", COM_FIELDS);
  } catch (err) {
    console.warn("  comets unavailable:", err.message);
  }

  // ---- Sentry impact-risk table (slim to what the UI needs) ----
  let sentry = null;
  try {
    const s = await getJSON(`${API}/sentry.api`);
    const objects = (s.data || [])
      .map((o) => ({
        des: o.des,
        name: o.fullname,
        ip: o.ip == null ? null : +o.ip,
        ps: o.ps_max == null ? null : +o.ps_max,
        ts: o.ts_max == null ? null : +o.ts_max,
        n: o.n_imp == null ? null : +o.n_imp,
        diam: o.diameter == null ? null : +o.diameter,
        h: o.h == null ? null : +o.h,
        range: o.range || null,
      }))
      // highest risk first: Torino, then Palermo, then probability
      .sort(
        (a, b) =>
          (b.ts ?? -99) - (a.ts ?? -99) ||
          (b.ps ?? -99) - (a.ps ?? -99) ||
          (b.ip ?? 0) - (a.ip ?? 0)
      );
    sentry = { count: objects.length, objects };
    console.log(`  sentry.api  →  ${objects.length} risk objects`);
  } catch (err) {
    console.warn("  sentry unavailable:", err.message);
  }

  // ---- CNEOS close approaches, next 60 days, < 10 lunar distances ----
  let cad = { count: "0" };
  try {
    cad = await getJSON(
      `${API}/cad.api?dist-max=10LD&date-min=now&date-max=%2B60&sort=date`
    );
    if (!Array.isArray(cad.fields) || !Array.isArray(cad.data)) cad = { count: "0" };
  } catch (err) {
    console.warn("  close approaches unavailable:", err.message);
  }

  const snapshot = {
    generated: new Date().toISOString(),
    totalKnown,
    queries,
    comets,
    sentry,
    cad,
  };

  await mkdir("data", { recursive: true });
  await writeFile("data/asteroids.json", JSON.stringify(snapshot));
  const mb = (Buffer.byteLength(JSON.stringify(snapshot)) / 1e6).toFixed(2);
  console.log(`Wrote data/asteroids.json (${mb} MB)`);
}

main().catch((err) => {
  console.error("build-data failed:", err);
  process.exit(1);
});
