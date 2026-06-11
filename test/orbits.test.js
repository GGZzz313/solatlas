const m = require('../js/app.js');
const { solveKepler, perifocalBasis, ellipsePoint, planetPosition, PLANETS, J2000, DEG, GAUSS_K } = m;
let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '   [' + detail + ']' : ''));
  if (!cond) fails++;
}

// 1. Kepler solver residuals across M and e (incl. high eccentricity)
let maxRes = 0;
for (let e of [0, 0.1, 0.5, 0.8, 0.95, 0.99]) {
  for (let k = 0; k < 100; k++) {
    const M = (k / 100) * 2 * Math.PI - Math.PI;
    const E = solveKepler(M, e);
    maxRes = Math.max(maxRes, Math.abs(E - e * Math.sin(E) - M));
  }
}
check('Kepler residual < 1e-8', maxRes < 1e-8, 'max=' + maxRes.toExponential(2));

// 2. Earth on 2026-06-11: heliocentric ecliptic longitude ~ 260.6 deg, r ~ 1.015 au
const jd = 2461202.5; // 2026-06-11 00:00 UTC
const p = new Float64Array(3);
planetPosition(PLANETS[2], jd, p);
const lon = ((Math.atan2(p[1], p[0]) / DEG) + 360) % 360;
const r = Math.hypot(p[0], p[1], p[2]);
check('Earth helio longitude ~260.6 deg', Math.abs(lon - 260.6) < 1.0, 'lon=' + lon.toFixed(2));
check('Earth distance ~1.015 au', r > 1.009 && r < 1.018, 'r=' + r.toFixed(4));
check('Earth near ecliptic plane', Math.abs(p[2]) < 0.001, 'z=' + p[2].toExponential(2));

// 3. Earth at J2000: Sun's geocentric longitude on 2000-01-01.5 was ~280.46 -> Earth ~100.46
planetPosition(PLANETS[2], J2000, p);
const lon2k = ((Math.atan2(p[1], p[0]) / DEG) + 360) % 360;
check('Earth helio longitude at J2000 ~100.4 deg', Math.abs(lon2k - 100.4) < 1.0, 'lon=' + lon2k.toFixed(2));

// 4. All planets: r within perihelion..aphelion at several dates
for (let i = 0; i < PLANETS.length; i++) {
  const pl = PLANETS[i];
  let ok = true, detail = '';
  for (const d of [J2000 - 30000, J2000, jd, jd + 30000]) {
    planetPosition(pl, d, p);
    const rr = Math.hypot(p[0], p[1], p[2]);
    const a = pl.el[0], e = pl.el[1] + Math.abs(pl.rate[1]) * 2.6;
    if (!(rr > a * (1 - e) * 0.995 && rr < a * (1 + e) * 1.005)) { ok = false; detail = 'r=' + rr.toFixed(3) + ' at jd=' + d; }
  }
  check(pl.name + ' radius within orbit bounds', ok, detail);
}

// 5. Mars on 2026-06-11: helio longitude ~ 76-90 deg? cross-check distance only (perihelion 1.381, aphelion 1.666)
planetPosition(PLANETS[3], jd, p);
const rMars = Math.hypot(p[0], p[1], p[2]);
check('Mars r in [1.38,1.67] au', rMars > 1.38 && rMars < 1.67, 'r=' + rMars.toFixed(3));

// 6. Asteroid-style propagation: Ceres elements (approx, epoch JD 2461000.5):
//    a=2.7672, e=0.0789, i=10.587, om=80.25, w=73.74, ma propagates; check periodicity & bounds
const a = 2.7672, e = 0.0789, inc = 10.587 * DEG, om = 80.25 * DEG, w = 73.74 * DEG;
const Pb = perifocalBasis(w, om, inc, new Float64Array(6));
const b = a * Math.sqrt(1 - e * e);
const n = GAUSS_K / Math.pow(a, 1.5);
const periodDays = 2 * Math.PI / n;
check('Ceres period ~4.60 yr', Math.abs(periodDays / 365.25 - 4.60) < 0.03, (periodDays / 365.25).toFixed(3) + ' yr');
const M0 = 1.234;
const E0 = solveKepler(M0, e);
const E1 = solveKepler(M0 + n * periodDays, e);
const q0 = ellipsePoint(a, e, b, Pb, E0, new Float64Array(3));
const q1 = ellipsePoint(a, e, b, Pb, E1, new Float64Array(3));
const drift = Math.hypot(q0[0]-q1[0], q0[1]-q1[1], q0[2]-q1[2]);
check('position repeats after one period', drift < 1e-6, 'drift=' + drift.toExponential(2));
const r0 = Math.hypot(q0[0], q0[1], q0[2]);
check('Ceres r within [q,Q]', r0 > a*(1-e)-1e-9 && r0 < a*(1+e)+1e-9, 'r=' + r0.toFixed(4));
// inclination of position: z/r <= sin(i)
check('Ceres |z|/r <= sin(i)', Math.abs(q0[2])/r0 <= Math.sin(inc) + 1e-9);

// 7. Jupiter on 2026-06-11 should be in Gemini/Cancer region: helio lon ~ 105-115 deg
planetPosition(PLANETS[4], jd, p);
const lonJ = ((Math.atan2(p[1], p[0]) / DEG) + 360) % 360;
console.log('INFO  Jupiter helio lon = ' + lonJ.toFixed(1) + ' deg, r = ' + Math.hypot(p[0],p[1],p[2]).toFixed(3) + ' au');

process.exit(fails ? 1 : 0);
