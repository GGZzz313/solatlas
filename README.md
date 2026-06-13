# 🪐 Sol Atlas

**The solar system, live and to scale — rendered in your browser.**

Sol Atlas streams real orbital data for **every charted world, moon and machine** —
asteroids, comets, planets, moons, dwarf planets, interstellar visitors, satellites and
in-flight spacecraft — straight from NASA/JPL and CelesTrak, propagates every orbit, and
renders the whole system from the Sun to the Oort cloud as an interactive, GPU-accelerated
3D scene. No frameworks, no API keys — open `index.html` over HTTP and fly.

![populations](https://img.shields.io/badge/data-NASA%2FJPL%20SSD%2FCNEOS-blue)
![deps](https://img.shields.io/badge/dependencies-zero-brightgreen)

## ✨ What you get

- **Real positions, right now** — every asteroid is placed by solving Kepler's equation
  for its actual published orbital elements at the current instant (heliocentric
  ecliptic J2000 frame).
- **A full census in the legend** — the Sun, the planets, near-Earth asteroids,
  Mars-crossers, the main belt, Jupiter trojans, centaurs, trans-Neptunian objects,
  dwarf planets, **comets**, long-period comets, and interstellar visitors — every row
  toggleable, with a plain-English ⓘ description of what it means.
- **The journey to the Oort cloud** — zoom out past everything and a clearly-labelled
  *inferred representation* of the Oort cloud resolves at its true scale
  (≈2,000–100,000 au; no Oort object has ever been observed — the shell is drawn where
  long-period comet orbits say it must be). A live scale bar keeps the distances honest,
  and the 379 near-parabolic comets are plotted as the real evidence pointing at it.
- **Comets** — ~4,000 periodic and Halley-type comets, converted from their perihelion
  elements (`q`, `tp`) and propagated on the same Keplerian engine. As one nears the Sun
  it grows a short dust tail pointing **anti-sunward**, lengthening toward perihelion.
- **Dwarf planets** — Ceres, Pluto, Eris, Haumea, Makemake and friends carry always-on
  labels so you can find them in the crowd.
- **Interstellar visitors** — 1I/ʻOumuamua, 2I/Borisov and 3I/ATLAS, propagated on a
  hyperbolic Kepler solver and drawn as the open, unbound trajectories they really are.
- **Every known moon** — all ~457 planetary satellites in JPL Horizons, propagated
  around their parent planets with their real orbital elements. Click a planet and the
  camera flies to it: watch the Galileans race around Jupiter, Saturn's irregular swarm,
  or the Pluto–Charon binary, at true scale and true speed.
- **Planets are first-class too** — click or search any planet for its live orbital
  elements, diameter, rotation, moon count and a real photo; double-click space to
  return to the Sun.
- **Lit worlds & Saturn's rings** — fly close to a planet and the point sprite resolves
  into a real, **Lambert-lit textured sphere** with a visible day/night terminator (lit
  from the Sun at the origin), at the planet's true axial tilt — and Saturn into its full
  ring system, Cassini Division and all.
- **In-flight spacecraft** — humanity's deep-space probes (Voyager 1 & 2, Pioneer 10 &
  11, New Horizons, Parker Solar Probe, Lucy, Psyche) on their real flight paths from
  JPL Horizons. The Voyagers are out past 165 au, coasting toward the interstellar-space
  signpost; click any probe for its live distance, speed and mission status.
- **Earth's artificial moons** — fly down to Earth and the ~15,700 active satellites
  from CelesTrak appear, propagated live with SGP4: the dense LEO swarm, the GPS/MEO
  ring and the geostationary belt. Click any one (the ISS, a Starlink, a GEO bird) for
  its orbit class, altitude, period and inclination. Shown **live** — they update at
  real time, independent of the time machine (you can't watch a 90-minute orbit at
  1 month/second).
- **Tracked space junk** — a second, separate layer (in orange) for the major catalogued
  debris clouds: the Fengyun-1C ASAT test (2007), the Iridium-33 / Cosmos-2251 collision
  (2009) and the Cosmos-1408 ASAT test (2021) — ~2,600 fragments still circling Earth,
  each clickable. Off by default; toggle it on to see the LEO junk shell.
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
- **How well do we *know* it?** — the card also shows when each small body was **last
  observed** and its **observation arc**, and flags poorly-constrained orbits (short arc
  or a high MPC uncertainty code) with a caution line, e.g. *1979 XB — observed for four
  days in 1979 and never recovered; the plotted path is approximate.*
- **Sentry watchlist** — JPL CNEOS's impact-risk table, with Torino/Palermo scale and
  odds; hazardous objects are flagged right in the object card.
- **An "Upcoming" feed** — what's about to happen in the near-Earth sky, all computed
  in-browser: the next Earth close approaches (JPL CNEOS), comet perihelia, planetary
  oppositions and the annual meteor-shower peaks. Click any event to jump the clock to
  that moment and frame the object.
- **True scale, honestly** — a toggle that renders every body at its *real* angular size
  instead of an exaggerated dot. The Sun and planets shrink to faint points, the asteroid
  belt and moons vanish entirely — the genuine emptiness of space. (Everything stays
  searchable and clickable.)
- **Take the tour** — one button auto-flies a cinematic, continuous-zoom journey through
  the highlights (Sun → belt → Jupiter → Saturn's rings → Pluto → Voyager 1 → the Oort
  cloud → Alpha Centauri), narrating each stop; any interaction or `Esc` hands control
  back. Plus keyboard shortcuts: `space` play/pause, `←/→` speed, `n` now.
- **Shareable views** — every view encodes itself into the URL (selected object, camera,
  date, layers). Hit **Share** to copy a link that drops someone onto the exact same
  scene — *"Voyager 1 at the heliopause"* — no backend involved.
- **All eight planets** with date-accurate positions (JPL approximate ephemeris,
  valid 1800–2050) and their orbits.
- **Desktop & mobile** — drag to orbit, scroll or pinch to zoom, **tap or drag the zoom
  bar** (handy without a scroll wheel), glassmorphic panels that collapse into floating
  buttons on small screens. Keyboard-operable and focus-ringed throughout.

## 🛰 Data sources (free, public, keyless)

| API | Used for |
| --- | --- |
| [JPL Small-Body Database Query API](https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html) | Orbital elements, magnitudes, diameters, albedo, rotation, spectral class, orbit classes — plus **observation arc, last-observed date and orbit-condition code** (the orbit-quality signals) — for ~50k asteroids **and comets** (NEOs, main belt, trojans, centaurs, TNOs, comets) |
| [JPL CNEOS Sentry API](https://ssd-api.jpl.nasa.gov/doc/sentry.html) | Earth-impact risk table (Torino/Palermo scale, probabilities) |
| [JPL CNEOS Close-Approach Data API](https://ssd-api.jpl.nasa.gov/doc/cad.html) | Upcoming Earth close approaches |
| [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | Orbital elements for all ~457 planetary moons, and flight-path vectors for in-flight spacecraft |
| [CelesTrak](https://celestrak.org/NORAD/elements/) | Active-satellite TLEs **and the major debris clouds** (Fengyun-1C, Iridium-33 / Cosmos-2251, Cosmos-1408) — refreshed daily, propagated client-side with SGP4 |
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
   visitors, plus the CNEOS Sentry/close-approach feeds — committed as one packed JSON
   snapshot; the app ingests it into typed arrays and dedupes by designation. Comets and
   ISOs are converted from `q`/`tp` to the same `{a, M, n}` record the propagator uses.
   Moon elements (`data/moons.json`) come from a one-off Horizons sweep
   (`scripts/fetch-moons.mjs`) over every satellite in its major-body catalogue.
2. **Propagate** — per frame, mean anomaly is advanced from each body's epoch and
   Kepler's equation is solved by Newton iteration (the hyperbolic form for interstellar
   objects); the perifocal→ecliptic basis is precomputed once per object. Moons solve
   the same equation around their parent planet, then ride its heliocentric position.
   On slower devices the population is updated in rotating slices.
3. **Render** — hand-rolled WebGL1: additive-blended point sprites with soft gaussian
   falloff for asteroids/stars/planets, line loops for orbits, anti-sunward comet tails,
   a CSS bloom tracking the Sun's projected position, and a twinkling 4,700-star backdrop
   with a milky-way band. The focused planet upgrades to a depth-tested, Lambert-lit
   textured sphere (plus a procedural ring disc) — briefly switching the pipeline out of
   its additive/depth-off default and restoring it afterward. Satellites are propagated
   live in real time (decoupled from the time machine) and re-anchored to Earth each frame.

The app is three files — `index.html`, `css/style.css`, `js/app.js` — plus the data
builders in `scripts/` (Node-only), `img/bodies/` (the spacecraft photos), and one
vendored runtime library: [`satellite.js`](https://github.com/shashwatak/satellite-js)
(MIT) for SGP4 satellite propagation. No build step.
