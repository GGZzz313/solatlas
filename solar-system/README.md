# Solar System Simulation

A zero-dependency, single-file interactive solar system simulation. Open
`index.html` in any browser — no build step, no server required.

## What it does

- **Real orbital mechanics** — planet positions are computed from J2000
  Keplerian orbital elements (JPL approximate ephemeris), solving Kepler's
  equation numerically each frame. Hit **Today** and the planets are where
  they actually are right now.
- **Time control** — scrub from hours-per-second up to years-per-second,
  forwards or backwards in time.
- **Explore** — drag to pan, scroll/pinch to zoom (anchored on the cursor),
  click any planet to open an info card and have the camera follow it.
- **Detail** — sunlit planet shading, Saturn's rings, Jupiter's cloud bands,
  major moons (visible when zoomed in), a 450-rock asteroid belt, twinkling
  starfield, optional orbit lines and motion trails.

## Controls

| Input | Action |
| --- | --- |
| Drag | Pan |
| Scroll / pinch | Zoom |
| Click planet | Info card + camera follow |
| Click sun | Sun info, recenter |
| `Space` | Pause / resume |
| `Esc` | Stop following |

## How positions are computed

Each planet's six orbital elements (semi-major axis, eccentricity,
inclination, mean longitude, longitude of perihelion, longitude of the
ascending node) are propagated linearly in Julian centuries from the J2000
epoch, Kepler's equation `M = E − e·sin E` is solved with Newton iteration,
and the resulting orbital-plane coordinates are rotated into the ecliptic.
The view is a top-down projection of the ecliptic plane. Planet sizes are
log-compressed (a true-scale Earth would be a fraction of a pixel) and moon
distances are decorative, but orbital geometry and timing are real.
