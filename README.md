# ☄️ Asteroid Atlas

**A living, real-data map of the solar system's asteroids — rendered in your browser.**

Asteroid Atlas streams the orbital elements of **~50,000 real asteroids and comets**
straight from NASA/JPL's public APIs, propagates every orbit with Keplerian mechanics,
and renders the whole solar system as an interactive, GPU-accelerated 3D scene. No
frameworks, no API keys — open `index.html` over HTTP and fly.

![populations](https://img.shields.io/badge/data-NASA%2FJPL%20SSD%2FCNEOS-blue)
![deps](https://img.shields.io/badge/dependencies-zero-brightgreen)

## ✨ What you get

- **Real positions, right now** — every asteroid is placed by solving Kepler's equation
  for its actual published orbital elements at the current instant (heliocentric
  ecliptic J2000 frame).
- **Eight color-coded populations** — near-Earth asteroids, Mars-crossers, the main belt,
  Jupiter trojans, centaurs, trans-Neptunian objects, **comets**, and everything else —
  each toggleable from the legend.
- **Comets** — ~1,300 periodic and Halley-type comets, converted from their perihelion
  elements (`q`, `tp`) and propagated on the same Keplerian engine.
- **Dwarf planets** — Ceres, Pluto, Eris, Haumea, Makemake and friends carry always-on
  labels so you can find them in the crowd.
- **Interstellar visitors** — 1I/ʻOumuamua, 2I/Borisov and 3I/ATLAS, propagated on a
  hyperbolic Kepler solver and drawn as the open, unbound trajectories they really are.
- **Spacecraft** — live positions and full trajectories for Voyager 1 & 2, Pioneer 10 &
  11, New Horizons, Parker Solar Probe, Lucy and Psyche, straight from JPL Horizons —
  watch them fly with the time machine and click for distance, speed and mission.
- **Hazard highlight** — toggle a layer that lights up every Potentially Hazardous
  Asteroid in orange.
- **A time machine** — play the solar system forward or backward at up to 5 years per
  second and watch the belt churn, trojans hold their Lagrange camps, and NEOs dive
  across Earth's orbit.
- **A detailed object card** — click/tap anything (or search: *Apophis*, *Ceres*,
  *Halley*…) for its live orbit plus orbital + physical data (albedo, rotation, spectral
  class, MOID) and a **preview** — a real spacecraft photo for the ~21 bodies that have
  been visited, or an honest procedural representation (scaled to the object's true size,
  albedo and spectral class) for everything else.
- **Sentry watchlist** — JPL CNEOS's impact-risk table, with Torino/Palermo scale and
  odds; hazardous objects are flagged right in the object card.
- **Live close-approach feed** — upcoming Earth flybys within 10 lunar distances over
  the next 60 days, from JPL CNEOS.
- **All eight planets** with date-accurate positions (JPL approximate ephemeris,
  valid 1800–2050) and their orbits.
- **Desktop & mobile** — drag to orbit, scroll or pinch to zoom, glassmorphic panels
  that collapse into floating buttons on small screens.

## 🛰 Data sources (free, public, keyless)

| API | Used for |
| --- | --- |
| [JPL Small-Body Database Query API](https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html) | Orbital elements, magnitudes, diameters, albedo, rotation, spectral class and orbit classes for ~50k asteroids **and comets** (NEOs, main belt, trojans, centaurs, TNOs, comets) |
| [JPL CNEOS Sentry API](https://ssd-api.jpl.nasa.gov/doc/sentry.html) | Earth-impact risk table (Torino/Palermo scale, probabilities) |
| [JPL CNEOS Close-Approach Data API](https://ssd-api.jpl.nasa.gov/doc/cad.html) | Upcoming Earth close approaches |
| [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | Spacecraft trajectories (heliocentric ecliptic state vectors) |
| [JPL Approximate Planetary Ephemeris](https://ssd.jpl.nasa.gov/planets/approx_pos.html) | Planet positions (embedded Keplerian elements + rates) |

Spacecraft imagery for the ~21 visited/resolved bodies (Ceres, Vesta, Pluto, Bennu,
Ryugu, comet 67P…) comes from public-domain NASA/ESA/JAXA mission photos; everything
else is rendered procedurally and clearly labelled *"not a photograph."*

Roughly 1.5 million asteroids are known (the header shows the live count from JPL);
the Atlas maps the ~50,000 best-characterized ones, which dominate visually.

**Why a snapshot?** The JPL SSD APIs don't send CORS headers, so browsers can't
query them directly. A GitHub Actions workflow
([`data-refresh.yml`](.github/workflows/data-refresh.yml)) runs
[`scripts/build-data.mjs`](scripts/build-data.mjs) server-side and commits the result
to `data/asteroids.json`, refreshing it weekly (and on demand via *Run workflow*). The
app loads that snapshot from its own origin — faster for visitors, kinder to NASA's
servers, and still 100% real JPL data.

## 🚀 Run it

Any static file server works:

```bash
npx http-server .        # or: python3 -m http.server 8000
```

Then open `http://localhost:8000`. All data is served locally from
`data/asteroids.json` — no external API access needed at runtime.

## 🧪 Tests

The orbital mechanics are covered by a zero-dependency test that checks the Kepler
solver's residuals, Earth's real heliocentric position on known dates, every planet's
radial bounds, and orbit periodicity:

```bash
node test/orbits.test.js
```

## 🧭 How it works

1. **Fetch** — a weekly GitHub Actions job runs `scripts/build-data.mjs`: SBDB queries
   for asteroids (NEOs, main belt, trojans, centaurs, TNOs), comets and the interstellar
   visitors, plus the CNEOS Sentry/close-approach feeds and Horizons spacecraft
   trajectories — committed as one packed JSON snapshot; the app ingests it into typed
   arrays and dedupes by designation. Comets and ISOs are converted from `q`/`tp` to the
   same `{a, M, n}` record the propagator uses.
2. **Propagate** — per frame, mean anomaly is advanced from each body's epoch and
   Kepler's equation is solved by Newton iteration (the hyperbolic form for interstellar
   objects); the perifocal→ecliptic basis is precomputed once per object. Spacecraft
   positions are interpolated along their sampled Horizons trajectories. On slower
   devices the population is updated in rotating slices.
3. **Render** — hand-rolled WebGL1: additive-blended point sprites with soft gaussian
   falloff for asteroids/stars/planets, line loops for orbits, a CSS bloom tracking the
   Sun's projected position, and a twinkling 4,700-star backdrop with a milky-way band.

The app is three files — `index.html`, `css/style.css`, `js/app.js` — plus
`scripts/build-data.mjs` (the data builder, Node-only) and `img/bodies/` (the
spacecraft photos). Still zero runtime dependencies.
