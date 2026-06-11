# ☄️ Asteroid Atlas

**A living, real-data map of the solar system's asteroids — rendered in your browser.**

Asteroid Atlas streams the orbital elements of **~30,000 real asteroids** straight from
NASA/JPL's public APIs, propagates every orbit with Keplerian mechanics, and renders the
whole solar system as an interactive, GPU-accelerated 3D scene. No build step, no
frameworks, no API keys — open `index.html` over HTTP and fly.

![populations](https://img.shields.io/badge/data-NASA%2FJPL%20SSD%2FCNEOS-blue)
![deps](https://img.shields.io/badge/dependencies-zero-brightgreen)

## ✨ What you get

- **Real positions, right now** — every asteroid is placed by solving Kepler's equation
  for its actual published orbital elements at the current instant (heliocentric
  ecliptic J2000 frame).
- **Seven color-coded populations** — near-Earth asteroids, Mars-crossers, the main belt,
  Jupiter trojans, centaurs, trans-Neptunian objects, and everything else — each
  toggleable from the legend.
- **A time machine** — play the solar system forward or backward at up to 5 years per
  second and watch the belt churn, trojans hold their Lagrange camps, and NEOs dive
  across Earth's orbit.
- **Tap anything** — click/tap an asteroid (or search for one: *Apophis*, *Ceres*,
  *Bennu*…) to see its orbit drawn live, plus semi-major axis, eccentricity,
  inclination, period, current solar distance, and estimated diameter.
- **Live close-approach feed** — upcoming Earth flybys within 10 lunar distances over
  the next 60 days, from JPL CNEOS.
- **All eight planets** with date-accurate positions (JPL approximate ephemeris,
  valid 1800–2050) and their orbits.
- **Desktop & mobile** — drag to orbit, scroll or pinch to zoom, glassmorphic panels
  that collapse into floating buttons on small screens.

## 🛰 Data sources (free, public, keyless)

| API | Used for |
| --- | --- |
| [JPL Small-Body Database Query API](https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html) | Orbital elements, absolute magnitudes, diameters and orbit classes for ~30k asteroids (NEOs, main belt, trojans, centaurs, TNOs) |
| [JPL CNEOS Close-Approach Data API](https://ssd-api.jpl.nasa.gov/doc/cad.html) | Upcoming Earth close approaches |
| [JPL Approximate Planetary Ephemeris](https://ssd.jpl.nasa.gov/planets/approx_pos.html) | Planet positions (embedded Keplerian elements + rates) |

Roughly 1.4 million asteroids are known; the Atlas streams the ~30,000 best-characterized
ones (which dominate visually) in parallel queries and dedupes them client-side.

## 🚀 Run it

Any static file server works:

```bash
npx http-server .        # or: python3 -m http.server 8000
```

Then open `http://localhost:8000`. The page needs network access to
`ssd-api.jpl.nasa.gov` at load time.

## 🧪 Tests

The orbital mechanics are covered by a zero-dependency test that checks the Kepler
solver's residuals, Earth's real heliocentric position on known dates, every planet's
radial bounds, and orbit periodicity:

```bash
node test/orbits.test.js
```

## 🧭 How it works

1. **Fetch** — five parallel SBDB queries (NEOs, main belt, trojans, centaurs, TNOs)
   return packed JSON; rows stream into typed arrays as they arrive.
2. **Propagate** — per frame, mean anomaly is advanced from each body's epoch and
   Kepler's equation is solved by Newton iteration; the perifocal→ecliptic basis is
   precomputed once per object. On slower devices the population is updated in
   rotating slices.
3. **Render** — hand-rolled WebGL1: additive-blended point sprites with soft gaussian
   falloff for asteroids/stars/planets, line loops for orbits, a CSS bloom tracking the
   Sun's projected position, and a twinkling 4,700-star backdrop with a milky-way band.

Everything lives in three files: `index.html`, `css/style.css`, `js/app.js`.
