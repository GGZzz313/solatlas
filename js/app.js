/* ============================================================
   Asteroid Atlas
   A living map of the solar system's asteroids.

   Data:
     - NASA/JPL Small-Body Database Query API  (orbital elements)
       https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html
     - NASA/JPL CNEOS Close-Approach Data API
       https://ssd-api.jpl.nasa.gov/doc/cad.html

   Rendering: hand-rolled WebGL1, zero dependencies.
   Positions are propagated from Keplerian elements in the
   heliocentric ecliptic J2000 frame, solved per frame.
   ============================================================ */
"use strict";

/* ============================================================
   1. Orbital mechanics
   ============================================================ */
const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;
const J2000 = 2451545.0;            // JD of epoch J2000.0
const GAUSS_K = 0.01720209895;      // Gaussian gravitational constant, rad/day

function jdNow() {
  return Date.now() / 86400000 + 2440587.5;
}

/* Solve Kepler's equation  E - e·sinE = M  (radians) via Newton. */
function solveKepler(M, e) {
  M = M % TWO_PI;
  if (M > Math.PI) M -= TWO_PI;
  else if (M < -Math.PI) M += TWO_PI;
  let E = e < 0.8 ? M : Math.PI * (M < 0 ? -1 : 1);
  for (let j = 0; j < 12; j++) {
    const s = Math.sin(E);
    const c = Math.cos(E);
    const d = (E - e * s - M) / (1 - e * c);
    E -= d;
    if (Math.abs(d) < 1e-9) break;
  }
  return E;
}

/* Perifocal→ecliptic basis vectors P (periapsis dir) and Q, from
   argument of periapsis w, longitude of node om, inclination i (rad). */
function perifocalBasis(w, om, i, out) {
  const cw = Math.cos(w), sw = Math.sin(w);
  const co = Math.cos(om), so = Math.sin(om);
  const ci = Math.cos(i), si = Math.sin(i);
  out[0] = co * cw - so * sw * ci;   // Px
  out[1] = so * cw + co * sw * ci;   // Py
  out[2] = sw * si;                  // Pz
  out[3] = -co * sw - so * cw * ci;  // Qx
  out[4] = -so * sw + co * cw * ci;  // Qy
  out[5] = cw * si;                  // Qz
  return out;
}

/* Position on the ellipse from eccentric anomaly. */
function ellipsePoint(a, e, b, P, E, out) {
  const xp = a * (Math.cos(E) - e);
  const yp = b * Math.sin(E);
  out[0] = xp * P[0] + yp * P[3];
  out[1] = xp * P[1] + yp * P[4];
  out[2] = xp * P[2] + yp * P[5];
  return out;
}

/* ---- Major planets ----
   Keplerian elements + per-century rates, valid 1800–2050 AD.
   Source: JPL "Approximate Positions of the Planets" (Table 1),
   https://ssd.jpl.nasa.gov/planets/approx_pos.html
   Order: a [au], e, I [deg], L [deg], long.peri [deg], long.node [deg] */
const PLANETS = [
  { name: "Mercury", color: [0.72, 0.69, 0.65], size: 0.035,
    el: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
    rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
  { name: "Venus", color: [0.96, 0.85, 0.63], size: 0.055,
    el: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
    rate: [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418] },
  { name: "Earth", color: [0.44, 0.71, 1.0], size: 0.058,
    el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0] },
  { name: "Mars", color: [1.0, 0.54, 0.36], size: 0.045,
    el: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
  { name: "Jupiter", color: [0.91, 0.72, 0.54], size: 0.16,
    el: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
  { name: "Saturn", color: [0.95, 0.84, 0.56], size: 0.14,
    el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    rate: [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
  { name: "Uranus", color: [0.61, 0.85, 0.88], size: 0.10,
    el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
    rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589] },
  { name: "Neptune", color: [0.50, 0.60, 1.0], size: 0.10,
    el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664] },
];

/* Planet Keplerian elements {a,e,i,om,w,M} (rad where angular) at JD. */
function planetElements(p, jd, out) {
  const T = (jd - J2000) / 36525;
  const a = p.el[0] + p.rate[0] * T;
  const e = p.el[1] + p.rate[1] * T;
  const i = (p.el[2] + p.rate[2] * T) * DEG;
  const L = (p.el[3] + p.rate[3] * T) * DEG;
  const lp = (p.el[4] + p.rate[4] * T) * DEG;
  const om = (p.el[5] + p.rate[5] * T) * DEG;
  out.a = a; out.e = e; out.i = i; out.om = om;
  out.w = lp - om;
  out.M = L - lp;
  return out;
}

/* Heliocentric ecliptic position of a planet at JD (au). */
function planetPosition(p, jd, out) {
  const el = planetElements(p, jd, { a: 0, e: 0, i: 0, om: 0, w: 0, M: 0 });
  const P = perifocalBasis(el.w, el.om, el.i, new Float64Array(6));
  const E = solveKepler(el.M, el.e);
  return ellipsePoint(el.a, el.e, el.a * Math.sqrt(1 - el.e * el.e), P, E, out);
}

/* Node test hook (no effect in the browser). */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { jdNow, solveKepler, perifocalBasis, ellipsePoint, planetElements, planetPosition, PLANETS, J2000, DEG, GAUSS_K };
}

/* ============================================================
   Everything below runs only in the browser.
   ============================================================ */
if (typeof document !== "undefined") (() => {

/* ============================================================
   2. Configuration / populations
   ============================================================ */
// The JPL SSD APIs don't send CORS headers, so the browser can't query them
// directly. A GitHub Actions workflow (.github/workflows/data-refresh.yml)
// pulls the same queries server-side and commits this snapshot.
const DATA_URL = "data/asteroids.json";

const GROUPS = [
  { key: "NEO", label: "Near-Earth", color: [1.0, 0.42, 0.42], css: "#ff6b6b" },
  { key: "MCA", label: "Mars-crossers", color: [1.0, 0.66, 0.30], css: "#ffa94d" },
  { key: "MBA", label: "Main belt", color: [1.0, 0.83, 0.47], css: "#ffd479" },
  { key: "TJN", label: "Jupiter Trojans", color: [0.37, 0.92, 0.83], css: "#5eead4" },
  { key: "CEN", label: "Centaurs", color: [0.75, 0.52, 0.99], css: "#c084fc" },
  { key: "TNO", label: "Trans-Neptunian", color: [0.49, 0.65, 1.0], css: "#7da7ff" },
  { key: "OTH", label: "Other", color: [0.58, 0.64, 0.72], css: "#94a3b8" },
];
const CLASS_TO_GROUP = {
  IEO: 0, ATE: 0, APO: 0, AMO: 0,
  MCA: 1,
  IMB: 2, MBA: 2, OMB: 2,
  TJN: 3,
  CEN: 4,
  TNO: 5,
};
const CLASS_NAMES = {
  IEO: "Atira (interior-Earth orbit)", ATE: "Aten near-Earth asteroid",
  APO: "Apollo near-Earth asteroid", AMO: "Amor near-Earth asteroid",
  MCA: "Mars-crossing asteroid", IMB: "Inner main-belt asteroid",
  MBA: "Main-belt asteroid", OMB: "Outer main-belt asteroid",
  TJN: "Jupiter trojan", CEN: "Centaur", TNO: "Trans-Neptunian object",
  AST: "Asteroid", PAA: "Parabolic asteroid", HYA: "Hyperbolic asteroid",
};

// Per-object element record stride inside group.el:
// [a, e, b, M0, n, epochD, Px, Py, Pz, Qx, Qy, Qz]
const STRIDE = 12;

/* ============================================================
   3. DOM handles & app state
   ============================================================ */
const $ = (id) => document.getElementById(id);
const canvas = $("scene");
const sunHalo = $("sun-halo");
const labelsEl = $("labels");

const state = {
  simJD: jdNow(),
  playing: true,
  dps: 30,                 // simulated days per real second
  dir: 1,
  cam: { yaw: -1.1, pitch: 0.55, dist: 7.8, tYaw: -1.1, tPitch: 0.55, tDist: 7.8 },
  topDown: false,
  savedPitch: 0.55,
  selected: null,          // { group, index }
  totalLoaded: 0,
  shownCount: 0,
  needFullUpdate: true,
  updateSlices: 1,
  sliceCursor: 0,
};

const groups = GROUPS.map((g) => ({
  ...g,
  count: 0,
  el: new Float32Array(0),       // packed elements, STRIDE per object
  pos: new Float32Array(0),      // xyz per object, recomputed
  sizes: new Float32Array(0),
  meta: [],                      // { name, cls, a, e, i, H, diam }
  visible: true,
  posBuf: null,
  sizeBuf: null,
  dirty: true,
}));

const seen = new Set();          // pdes dedupe across queries

/* ============================================================
   4. WebGL renderer
   ============================================================ */
const gl = canvas.getContext("webgl", { antialias: true, alpha: false, powerPreference: "high-performance" });
if (!gl) {
  $("loader-status").textContent = "";
  $("loader-error-msg").textContent = "Your browser does not support WebGL, which this visualization needs.";
  $("loader-error").hidden = false;
  $("retry-btn").hidden = true;
  return;
}

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error("Shader: " + gl.getShaderInfoLog(s));
  }
  return s;
}
function program(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("Program: " + gl.getProgramInfoLog(p));
  }
  return p;
}

const POINT_VS = `
attribute vec3 aPos;
attribute float aSize;
attribute float aPhase;
uniform mat4 uVP;
uniform float uPixScale, uTime, uMinPx, uMaxPx;
varying float vTw;
void main() {
  gl_Position = uVP * vec4(aPos, 1.0);
  float px = uPixScale * aSize / max(gl_Position.w, 1e-4);
  gl_PointSize = clamp(px, uMinPx, uMaxPx);
  vTw = aPhase > 0.0 ? 0.72 + 0.28 * sin(uTime * 1.8 + aPhase * 7.0) : 1.0;
}`;
const POINT_FS = `
precision mediump float;
uniform vec3 uColor;
uniform float uAlpha;
varying float vTw;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d) * 4.0;
  float a = exp(-r2 * 3.2) * smoothstep(1.0, 0.55, r2) * uAlpha * vTw;
  gl_FragColor = vec4(uColor * a, a);
}`;
const LINE_VS = `
attribute vec3 aPos;
uniform mat4 uVP;
void main() { gl_Position = uVP * vec4(aPos, 1.0); }`;
const LINE_FS = `
precision mediump float;
uniform vec3 uColor;
uniform float uAlpha;
void main() { gl_FragColor = vec4(uColor * uAlpha, uAlpha); }`;

const ptProg = program(POINT_VS, POINT_FS);
const lnProg = program(LINE_VS, LINE_FS);
const PT = {
  aPos: gl.getAttribLocation(ptProg, "aPos"),
  aSize: gl.getAttribLocation(ptProg, "aSize"),
  aPhase: gl.getAttribLocation(ptProg, "aPhase"),
  uVP: gl.getUniformLocation(ptProg, "uVP"),
  uPixScale: gl.getUniformLocation(ptProg, "uPixScale"),
  uTime: gl.getUniformLocation(ptProg, "uTime"),
  uMinPx: gl.getUniformLocation(ptProg, "uMinPx"),
  uMaxPx: gl.getUniformLocation(ptProg, "uMaxPx"),
  uColor: gl.getUniformLocation(ptProg, "uColor"),
  uAlpha: gl.getUniformLocation(ptProg, "uAlpha"),
};
const LN = {
  aPos: gl.getAttribLocation(lnProg, "aPos"),
  uVP: gl.getUniformLocation(lnProg, "uVP"),
  uColor: gl.getUniformLocation(lnProg, "uColor"),
  uAlpha: gl.getUniformLocation(lnProg, "uAlpha"),
};

gl.disable(gl.DEPTH_TEST);
gl.enable(gl.BLEND);
gl.blendFunc(gl.ONE, gl.ONE);   // additive — glowing space dust
gl.clearColor(0, 0, 0, 1);

/* ---- tiny mat4 helpers (column-major) ---- */
function mat4Perspective(out, fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  out.fill(0);
  out[0] = f / aspect; out[5] = f;
  out[10] = (far + near) / (near - far); out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}
function mat4LookAt(out, eye, up) {
  // target is always the origin
  let zx = eye[0], zy = eye[1], zz = eye[2];
  let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}
function mat4Mul(out, a, b) {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

const proj = new Float32Array(16);
const view = new Float32Array(16);
const vp = new Float32Array(16);
const FOV = 55 * DEG;

let dpr = 1, cssW = 0, cssH = 0;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cssW = canvas.clientWidth || window.innerWidth;
  cssH = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
  mat4Perspective(proj, FOV, canvas.width / canvas.height, 0.01, 4000);
}
window.addEventListener("resize", resize);
resize();

/* ---- static buffers: stars, sun, planets, orbit lines ---- */
function makeBuffer(data, usage) {
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
  return b;
}

function makeStars(count, banded) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const R = 1300;
  // tilted plane for a "milky way" band
  const bn = [0.48, 0.2, 0.85];
  const bl = Math.hypot(bn[0], bn[1], bn[2]);
  bn[0] /= bl; bn[1] /= bl; bn[2] /= bl;
  for (let k = 0; k < count; k++) {
    let x, y, z;
    do {
      x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1;
    } while (x * x + y * y + z * z > 1 || x * x + y * y + z * z < 1e-4);
    const l = Math.hypot(x, y, z);
    x /= l; y /= l; z /= l;
    if (banded) {
      // squash toward the band plane
      const d = x * bn[0] + y * bn[1] + z * bn[2];
      const f = d * (1 - Math.pow(Math.random(), 2.2) * 0.92);
      x -= bn[0] * (d - f); y -= bn[1] * (d - f); z -= bn[2] * (d - f);
      const l2 = Math.hypot(x, y, z);
      x /= l2; y /= l2; z /= l2;
    }
    pos[k * 3] = x * R; pos[k * 3 + 1] = y * R; pos[k * 3 + 2] = z * R;
    size[k] = (banded ? 1.1 : 1.6) * (0.5 + Math.pow(Math.random(), 3) * 2.6);
    phase[k] = 0.05 + Math.random();
  }
  return {
    count,
    posBuf: makeBuffer(pos),
    sizeBuf: makeBuffer(size),
    phaseBuf: makeBuffer(phase),
  };
}
const starsCool = makeStars(1900, false);
const starsBand = makeStars(2400, true);
const starsWarm = makeStars(450, false);

const sunBuf = makeBuffer(new Float32Array([0, 0, 0]));
const oneBuf = makeBuffer(new Float32Array([0]));        // phase=0
const sunSizeBuf = makeBuffer(new Float32Array([0.45]));

const planetState = PLANETS.map((p) => ({
  def: p,
  pos: new Float64Array(3),
  sizeBuf: makeBuffer(new Float32Array([p.size])),
  posBuf: makeBuffer(new Float32Array(3), gl.DYNAMIC_DRAW),
  orbitBuf: null,
  orbitCount: 0,
  labelEl: null,
}));

function buildPlanetOrbits() {
  const jd = state.simJD;
  const SEG = 180;
  const tmp = new Float64Array(3);
  for (const ps of planetState) {
    const el = planetElements(ps.def, jd, { a: 0, e: 0, i: 0, om: 0, w: 0, M: 0 });
    const P = perifocalBasis(el.w, el.om, el.i, new Float64Array(6));
    const b = el.a * Math.sqrt(1 - el.e * el.e);
    const verts = new Float32Array(SEG * 3);
    for (let s = 0; s < SEG; s++) {
      ellipsePoint(el.a, el.e, b, P, (s / SEG) * TWO_PI, tmp);
      verts[s * 3] = tmp[0]; verts[s * 3 + 1] = tmp[1]; verts[s * 3 + 2] = tmp[2];
    }
    if (ps.orbitBuf) gl.deleteBuffer(ps.orbitBuf);
    ps.orbitBuf = makeBuffer(verts);
    ps.orbitCount = SEG;
  }
}
buildPlanetOrbits();

/* selected-orbit line (dynamic) */
let selOrbitBuf = gl.createBuffer();
let selOrbitCount = 0;
function buildSelectedOrbit(rec) {
  const SEG = 256;
  const verts = new Float32Array(SEG * 3);
  const P = [rec.Px, rec.Py, rec.Pz, rec.Qx, rec.Qy, rec.Qz];
  const tmp = new Float64Array(3);
  for (let s = 0; s < SEG; s++) {
    ellipsePoint(rec.a, rec.e, rec.b, P, (s / SEG) * TWO_PI, tmp);
    verts[s * 3] = tmp[0]; verts[s * 3 + 1] = tmp[1]; verts[s * 3 + 2] = tmp[2];
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, selOrbitBuf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
  selOrbitCount = SEG;
}

/* ---- draw helpers ---- */
function bindPointAttrs(posBuf, sizeBuf, phaseBuf, singlePhase) {
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.enableVertexAttribArray(PT.aPos);
  gl.vertexAttribPointer(PT.aPos, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
  gl.enableVertexAttribArray(PT.aSize);
  gl.vertexAttribPointer(PT.aSize, 1, gl.FLOAT, false, 0, 0);
  if (phaseBuf) {
    gl.bindBuffer(gl.ARRAY_BUFFER, phaseBuf);
    gl.enableVertexAttribArray(PT.aPhase);
    gl.vertexAttribPointer(PT.aPhase, 1, gl.FLOAT, false, 0, 0);
  } else {
    gl.disableVertexAttribArray(PT.aPhase);
    gl.vertexAttrib1f(PT.aPhase, singlePhase || 0);
  }
}

/* ============================================================
   5. Position propagation (CPU, chunk-rotated for mobile)
   ============================================================ */
function updateGroupPositions(g, from, to, t) {
  const el = g.el, pos = g.pos;
  for (let k = from; k < to; k++) {
    const o = k * STRIDE;
    const a = el[o], e = el[o + 1], b = el[o + 2];
    let M = el[o + 3] + el[o + 4] * (t - el[o + 5]);
    M = M % TWO_PI;
    if (M > Math.PI) M -= TWO_PI; else if (M < -Math.PI) M += TWO_PI;
    let E = e < 0.8 ? M : Math.PI * (M < 0 ? -1 : 1);
    for (let j = 0; j < 8; j++) {
      const s = Math.sin(E), c = Math.cos(E);
      const d = (E - e * s - M) / (1 - e * c);
      E -= d;
      if (d < 1e-7 && d > -1e-7) break;
    }
    const xp = a * (Math.cos(E) - e);
    const yp = b * Math.sin(E);
    pos[k * 3] = xp * el[o + 6] + yp * el[o + 9];
    pos[k * 3 + 1] = xp * el[o + 7] + yp * el[o + 10];
    pos[k * 3 + 2] = xp * el[o + 8] + yp * el[o + 11];
  }
}

function propagate() {
  const t = state.simJD - J2000;
  const t0 = performance.now();
  const slices = state.needFullUpdate ? 1 : state.updateSlices;
  const cursor = state.sliceCursor;
  for (const g of groups) {
    if (!g.count) continue;
    if (slices === 1) {
      updateGroupPositions(g, 0, g.count, t);
    } else {
      const span = Math.ceil(g.count / slices);
      const from = Math.min(cursor * span, g.count);
      const to = Math.min(from + span, g.count);
      updateGroupPositions(g, from, to, t);
    }
    g.dirty = true;
  }
  state.sliceCursor = (cursor + 1) % Math.max(state.updateSlices, 1);
  state.needFullUpdate = false;
  // adapt: if a full pass is slow, rotate through the population in slices
  const took = performance.now() - t0;
  if (slices === 1 && took > 7) state.updateSlices = Math.min(4, Math.ceil(took / 5));
}

/* ============================================================
   6. Render loop
   ============================================================ */
const eye = new Float64Array(3);
let lastFrame = performance.now();
let simAtLastPropagate = NaN;

function render(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.25);
  lastFrame = now;

  // time machine
  if (state.playing) state.simJD += state.dir * state.dps * dt;

  // camera easing
  const c = state.cam;
  const ease = 1 - Math.exp(-dt * 9);
  c.yaw += (c.tYaw - c.yaw) * ease;
  c.pitch += (c.tPitch - c.pitch) * ease;
  c.dist += (c.tDist - c.dist) * ease;

  eye[0] = c.dist * Math.cos(c.pitch) * Math.cos(c.yaw);
  eye[1] = c.dist * Math.cos(c.pitch) * Math.sin(c.yaw);
  eye[2] = c.dist * Math.sin(c.pitch);
  mat4LookAt(view, eye, [0, 0, 1]);
  mat4Mul(vp, proj, view);

  // propagate asteroid + planet positions when time moved
  if (state.simJD !== simAtLastPropagate || state.needFullUpdate) {
    propagate();
    simAtLastPropagate = state.simJD;
    const tmp = new Float64Array(3);
    for (const ps of planetState) {
      planetPosition(ps.def, state.simJD, tmp);
      ps.pos.set(tmp);
      gl.bindBuffer(gl.ARRAY_BUFFER, ps.posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tmp), gl.DYNAMIC_DRAW);
    }
  }

  gl.clear(gl.COLOR_BUFFER_BIT);
  const pixScale = canvas.height / (2 * Math.tan(FOV / 2));
  const timeS = now / 1000;

  /* ---- orbit lines ---- */
  gl.useProgram(lnProg);
  gl.uniformMatrix4fv(LN.uVP, false, vp);
  gl.enableVertexAttribArray(LN.aPos);
  for (const ps of planetState) {
    gl.bindBuffer(gl.ARRAY_BUFFER, ps.orbitBuf);
    gl.vertexAttribPointer(LN.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.uniform3f(LN.uColor, ps.def.color[0], ps.def.color[1], ps.def.color[2]);
    gl.uniform1f(LN.uAlpha, 0.14);
    gl.drawArrays(gl.LINE_LOOP, 0, ps.orbitCount);
  }
  if (state.selected && selOrbitCount) {
    gl.bindBuffer(gl.ARRAY_BUFFER, selOrbitBuf);
    gl.vertexAttribPointer(LN.aPos, 3, gl.FLOAT, false, 0, 0);
    const gc = groups[state.selected.group].color;
    gl.uniform3f(LN.uColor, gc[0], gc[1], gc[2]);
    gl.uniform1f(LN.uAlpha, 0.55);
    gl.drawArrays(gl.LINE_LOOP, 0, selOrbitCount);
  }

  /* ---- points ---- */
  gl.useProgram(ptProg);
  gl.uniformMatrix4fv(PT.uVP, false, vp);
  gl.uniform1f(PT.uPixScale, pixScale);
  gl.uniform1f(PT.uTime, timeS);

  // stars (sizes are in px, not world units: fake it with min=max clamp window)
  gl.uniform1f(PT.uMinPx, 0.6 * dpr);
  gl.uniform1f(PT.uMaxPx, 3.4 * dpr);
  gl.uniform1f(PT.uAlpha, 0.9);
  gl.uniform3f(PT.uColor, 0.78, 0.85, 1.0);
  bindPointAttrs(starsCool.posBuf, starsCool.sizeBuf, starsCool.phaseBuf);
  gl.drawArrays(gl.POINTS, 0, starsCool.count);
  gl.uniform3f(PT.uColor, 0.62, 0.74, 0.98);
  gl.uniform1f(PT.uAlpha, 0.55);
  bindPointAttrs(starsBand.posBuf, starsBand.sizeBuf, starsBand.phaseBuf);
  gl.drawArrays(gl.POINTS, 0, starsBand.count);
  gl.uniform3f(PT.uColor, 1.0, 0.86, 0.66);
  gl.uniform1f(PT.uAlpha, 0.8);
  bindPointAttrs(starsWarm.posBuf, starsWarm.sizeBuf, starsWarm.phaseBuf);
  gl.drawArrays(gl.POINTS, 0, starsWarm.count);

  // asteroids
  gl.uniform1f(PT.uMinPx, 1.25 * dpr);
  gl.uniform1f(PT.uMaxPx, 9 * dpr);
  for (const g of groups) {
    if (!g.count || !g.visible) continue;
    if (g.dirty) {
      gl.bindBuffer(gl.ARRAY_BUFFER, g.posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.DYNAMIC_DRAW);
      g.dirty = false;
    }
    gl.uniform3f(PT.uColor, g.color[0], g.color[1], g.color[2]);
    gl.uniform1f(PT.uAlpha, 0.85);
    bindPointAttrs(g.posBuf, g.sizeBuf, null, 0);
    gl.drawArrays(gl.POINTS, 0, g.count);
  }

  // planets
  gl.uniform1f(PT.uMinPx, 2.5 * dpr);
  gl.uniform1f(PT.uMaxPx, 26 * dpr);
  for (const ps of planetState) {
    gl.uniform3f(PT.uColor, ps.def.color[0], ps.def.color[1], ps.def.color[2]);
    gl.uniform1f(PT.uAlpha, 1.0);
    bindPointAttrs(ps.posBuf, ps.sizeBuf, null, 0);
    gl.drawArrays(gl.POINTS, 0, 1);
  }

  // sun core
  gl.uniform1f(PT.uMinPx, 10 * dpr);
  gl.uniform1f(PT.uMaxPx, 58 * dpr);
  gl.uniform3f(PT.uColor, 1.0, 0.93, 0.78);
  gl.uniform1f(PT.uAlpha, 1.0);
  bindPointAttrs(sunBuf, sunSizeBuf, null, 0);
  gl.drawArrays(gl.POINTS, 0, 1);

  updateOverlays(pixScale);
  updateHUD();
  requestAnimationFrame(render);
}

/* project world → CSS px; returns null when behind the camera */
const _pv = new Float64Array(4);
function project(x, y, z) {
  _pv[0] = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  _pv[1] = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  _pv[3] = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (_pv[3] <= 0.001) return null;
  return [
    (_pv[0] / _pv[3] * 0.5 + 0.5) * cssW,
    (1 - (_pv[1] / _pv[3] * 0.5 + 0.5)) * cssH,
    _pv[3],
  ];
}

/* ---- HTML overlays: sun halo, planet labels, selection marker ---- */
let selMarkerEl = null;
function updateOverlays(pixScale) {
  // sun halo
  const sp = project(0, 0, 0);
  if (sp) {
    const px = (pixScale / dpr) * 0.55 / Math.max(sp[2], 0.05);
    const sc = Math.min(Math.max(px / 160, 0.22), 2.6);
    sunHalo.style.opacity = "1";
    sunHalo.style.transform = `translate(${sp[0] - cssW / 2}px, ${sp[1] - cssH / 2}px) scale(${sc})`;
  } else {
    sunHalo.style.opacity = "0";
  }
  // planet labels
  for (const ps of planetState) {
    if (!ps.labelEl) {
      ps.labelEl = document.createElement("div");
      ps.labelEl.className = "pl-label";
      ps.labelEl.textContent = ps.def.name;
      labelsEl.appendChild(ps.labelEl);
    }
    const p = project(ps.pos[0], ps.pos[1], ps.pos[2]);
    if (!p) { ps.labelEl.style.opacity = "0"; continue; }
    const px = (pixScale / dpr) * ps.def.size / p[2];
    const show = px > 1.6 && p[0] > -40 && p[0] < cssW + 40 && p[1] > -20 && p[1] < cssH + 20;
    ps.labelEl.style.opacity = show ? "1" : "0";
    if (show) ps.labelEl.style.transform = `translate(${p[0]}px, ${p[1]}px) translate(-50%,-150%)`;
  }
  // selection marker
  if (state.selected) {
    const g = groups[state.selected.group];
    const k = state.selected.index;
    const p = project(g.pos[k * 3], g.pos[k * 3 + 1], g.pos[k * 3 + 2]);
    if (!selMarkerEl) {
      selMarkerEl = document.createElement("div");
      selMarkerEl.className = "pl-label sel-marker";
      labelsEl.appendChild(selMarkerEl);
    }
    selMarkerEl.textContent = g.meta[k].name;
    if (p) {
      selMarkerEl.style.opacity = "1";
      selMarkerEl.style.transform = `translate(${p[0]}px, ${p[1]}px) translate(-50%,-150%)`;
    } else selMarkerEl.style.opacity = "0";
    // live distance readout
    const r = Math.hypot(g.pos[k * 3], g.pos[k * 3 + 1], g.pos[k * 3 + 2]);
    $("info-r").textContent = r.toFixed(3) + " au";
  } else if (selMarkerEl) {
    selMarkerEl.style.opacity = "0";
  }
}

/* ---- HUD: animated counter + clock ---- */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
let lastDateStr = "";
function updateHUD() {
  if (state.shownCount !== state.totalLoaded) {
    const d = state.totalLoaded - state.shownCount;
    state.shownCount += Math.abs(d) < 4 ? d : Math.round(d * 0.08);
    $("stat-count").textContent = state.shownCount.toLocaleString("en-US");
  }
  const date = new Date((state.simJD - 2440587.5) * 86400000);
  if (!isFinite(date.getTime())) return;
  const s = `${String(date.getUTCDate()).padStart(2, "0")} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} · ${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")} UTC`;
  if (s !== lastDateStr) { $("sim-date").textContent = s; lastDateStr = s; }
}

/* ============================================================
   7. Data loading — NASA/JPL SBDB
   ============================================================ */
function fetchJSON(url) {
  return fetch(url, { headers: { Accept: "application/json" } }).then((r) => {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  });
}

function ingest(resp) {
  if (!resp || !Array.isArray(resp.fields) || !Array.isArray(resp.data)) return 0;
  const ix = {};
  resp.fields.forEach((f, k) => (ix[f] = k));
  const need = ["pdes", "a", "e", "i", "om", "w", "ma", "epoch"];
  for (const f of need) if (!(f in ix)) return 0;
  const num = (v) => (v == null || v === "" ? NaN : +v);

  // bucket rows per group first, then append in bulk
  const buckets = groups.map(() => []);
  for (const row of resp.data) {
    const pdes = row[ix.pdes];
    if (pdes == null || seen.has(pdes)) continue;
    const a = num(row[ix.a]), e = num(row[ix.e]), inc = num(row[ix.i]);
    const om = num(row[ix.om]), w = num(row[ix.w]), ma = num(row[ix.ma]), ep = num(row[ix.epoch]);
    if (!(a > 0) || !(e >= 0) || e >= 0.995 || !isFinite(inc) || !isFinite(om) || !isFinite(w) || !isFinite(ma) || !isFinite(ep)) continue;
    seen.add(pdes);
    const cls = (row[ix.class] || "").trim();
    const gi = cls in CLASS_TO_GROUP ? CLASS_TO_GROUP[cls] : 6;
    const H = num(row[ix.H]);
    const diam = num(row[ix.diameter]);
    const name = (row[ix.name] || "").trim() || pdes;
    buckets[gi].push({ pdes, name, cls, a, e, inc, om, w, ma, ep, H: isFinite(H) ? H : NaN, diam: isFinite(diam) ? diam : NaN });
  }

  let added = 0;
  const Pb = new Float64Array(6);
  buckets.forEach((rows, gi) => {
    if (!rows.length) return;
    const g = groups[gi];
    const n0 = g.count, n1 = n0 + rows.length;
    const el = new Float32Array(n1 * STRIDE); el.set(g.el);
    const pos = new Float32Array(n1 * 3); pos.set(g.pos);
    const sizes = new Float32Array(n1); sizes.set(g.sizes);
    rows.forEach((r, j) => {
      const k = n0 + j, o = k * STRIDE;
      perifocalBasis(r.w * DEG, r.om * DEG, r.inc * DEG, Pb);
      el[o] = r.a;
      el[o + 1] = r.e;
      el[o + 2] = r.a * Math.sqrt(1 - r.e * r.e);
      el[o + 3] = r.ma * DEG;
      el[o + 4] = GAUSS_K / Math.pow(r.a, 1.5);   // rad/day
      el[o + 5] = r.ep - J2000;
      el[o + 6] = Pb[0]; el[o + 7] = Pb[1]; el[o + 8] = Pb[2];
      el[o + 9] = Pb[3]; el[o + 10] = Pb[4]; el[o + 11] = Pb[5];
      const H = isFinite(r.H) ? r.H : 16;
      sizes[k] = Math.min(0.006 * Math.pow(1.32, Math.max(17 - H, 0)), 0.13);
      g.meta.push({ name: r.name, cls: r.cls, a: r.a, e: r.e, i: r.inc, H: r.H, diam: r.diam });
    });
    g.el = el; g.pos = pos; g.sizes = sizes; g.count = n1;
    if (!g.posBuf) g.posBuf = gl.createBuffer();
    if (g.sizeBuf) gl.deleteBuffer(g.sizeBuf);
    g.sizeBuf = makeBuffer(sizes);
    g.dirty = true;
    added += rows.length;
  });
  if (added) {
    state.totalLoaded += added;
    state.needFullUpdate = true;
    renderLegend();
  }
  return added;
}

let loadedOnce = false;
async function loadAsteroids() {
  const fill = $("loader-fill");
  const status = $("loader-status");
  $("loader-error").hidden = true;
  status.textContent = "downloading NASA/JPL data snapshot…";
  fill.style.width = "15%";
  try {
    const snap = await fetchJSON(DATA_URL);
    fill.style.width = "70%";
    status.textContent = "propagating orbits…";
    let added = 0;
    for (const q of snap.queries || []) added += ingest(q);
    if (!added) throw new Error("snapshot contained no usable records");
    fill.style.width = "100%";
    const total = +snap.totalKnown;
    if (total > 0) $("stat-known").textContent = total.toLocaleString("en-US");
    if (snap.generated) {
      const d = new Date(snap.generated);
      if (isFinite(d.getTime())) {
        $("snap-date").textContent =
          ` · snapshot ${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      }
    }
    renderCloseApproaches(snap.cad);
    loadedOnce = true;
    $("loader").classList.add("done");
  } catch (err) {
    console.warn("snapshot load failed:", err);
    status.textContent = "";
    $("loader-error-msg").textContent =
      "Could not load the asteroid data snapshot (data/asteroids.json). Check your connection and try again.";
    $("loader-error").hidden = false;
  }
}

/* ---- close approaches (JPL CNEOS, from the snapshot) ---- */
function renderCloseApproaches(resp) {
  const list = $("cad-list");
  try {
    const ix = {};
    (resp.fields || []).forEach((f, k) => (ix[f] = k));
    if (!("des" in ix) || !("jd" in ix)) throw new Error("no cad data");
    const now = jdNow();
    const rows = (resp.data || []).filter((r) => +r[ix.jd] >= now - 0.5).slice(0, 30);
    if (!rows.length) {
      list.innerHTML = '<li class="cad-empty">no approaches within 10 LD in the next 60 days</li>';
      return;
    }
    list.innerHTML = "";
    for (const r of rows) {
      const des = r[ix.des] || "?";
      const cd = (r[ix.cd] || "").replace(/^(\d{4})-(\w{3})-(\d{2})\s+(\d{2}:\d{2})$/, "$3 $2 $1 · $4 UTC");
      const ld = (+r[ix.dist] || 0) / 0.002569;
      const v = +r[ix.v_rel];
      const cls = ld < 1 ? "cad-near" : ld < 4 ? "cad-mid" : "cad-far";
      const li = document.createElement("li");
      li.innerHTML =
        `<span class="cad-name"></span>` +
        `<span class="cad-dist ${cls}">${ld.toFixed(2)} LD<small>${isFinite(v) ? v.toFixed(1) + " km/s" : ""}</small></span>` +
        `<span class="cad-when">${cd}</span>`;
      li.querySelector(".cad-name").textContent = des;
      list.appendChild(li);
    }
  } catch (err) {
    list.innerHTML = '<li class="cad-empty">close-approach feed unavailable</li>';
  }
}

/* ============================================================
   8. Legend / filters
   ============================================================ */
function renderLegend() {
  const ul = $("legend-list");
  ul.innerHTML = "";
  groups.forEach((g, gi) => {
    if (!g.count) return;
    const li = document.createElement("li");
    if (!g.visible) li.classList.add("off");
    li.innerHTML =
      `<span class="dot" style="background:${g.css};box-shadow:0 0 8px ${g.css}"></span>` +
      `<span class="lname">${g.label}</span>` +
      `<span class="lcount">${g.count.toLocaleString("en-US")}</span>`;
    li.addEventListener("click", () => {
      g.visible = !g.visible;
      li.classList.toggle("off", !g.visible);
      if (!g.visible && state.selected && state.selected.group === gi) clearSelection();
    });
    ul.appendChild(li);
  });
}

/* ============================================================
   9. Selection, info card & search
   ============================================================ */
function selectObject(gi, k) {
  const g = groups[gi];
  const m = g.meta[k];
  state.selected = { group: gi, index: k };
  const o = k * STRIDE, el = g.el;
  buildSelectedOrbit({
    a: el[o], e: el[o + 1], b: el[o + 2],
    Px: el[o + 6], Py: el[o + 7], Pz: el[o + 8],
    Qx: el[o + 9], Qy: el[o + 10], Qz: el[o + 11],
  });
  $("info-name").textContent = m.name;
  $("info-class").textContent = CLASS_NAMES[m.cls] || m.cls || "asteroid";
  $("info-a").textContent = m.a.toFixed(3) + " au";
  $("info-e").textContent = m.e.toFixed(3);
  $("info-i").textContent = m.i.toFixed(1) + "°";
  $("info-per").textContent = formatPeriod(Math.pow(m.a, 1.5));
  let dTxt = "—";
  if (isFinite(m.diam)) dTxt = formatKm(m.diam);
  else if (isFinite(m.H)) dTxt = "~" + formatKm(1329 / Math.sqrt(0.14) * Math.pow(10, -m.H / 5));
  $("info-d").textContent = dTxt;
  $("panel-info").hidden = false;
}
function clearSelection() {
  state.selected = null;
  selOrbitCount = 0;
  $("panel-info").hidden = true;
}
function formatPeriod(yr) {
  return yr < 1.5 ? Math.round(yr * 365.25) + " days" : yr.toFixed(yr < 10 ? 2 : 1) + " yr";
}
function formatKm(km) {
  return km < 1 ? Math.round(km * 1000) + " m" : km < 10 ? km.toFixed(1) + " km" : Math.round(km) + " km";
}

function pickAt(x, y) {
  let best = null, bestD = 22 * 22;
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    if (!g.visible) continue;
    for (let k = 0; k < g.count; k++) {
      const p = project(g.pos[k * 3], g.pos[k * 3 + 1], g.pos[k * 3 + 2]);
      if (!p) continue;
      const dx = p[0] - x, dy = p[1] - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = [gi, k]; }
    }
  }
  if (best) selectObject(best[0], best[1]);
  else clearSelection();
}

/* ---- search ---- */
const searchEl = $("search");
const resultsEl = $("search-results");
function runSearch(q) {
  q = q.trim().toLowerCase();
  resultsEl.innerHTML = "";
  if (q.length < 2) { resultsEl.hidden = true; return; }
  const hits = [];
  outer:
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    for (let k = 0; k < g.count; k++) {
      if (g.meta[k].name.toLowerCase().includes(q)) {
        hits.push([gi, k]);
        if (hits.length >= 8) break outer;
      }
    }
  }
  if (!hits.length) { resultsEl.hidden = true; return; }
  for (const [gi, k] of hits) {
    const li = document.createElement("li");
    const nameSpan = document.createElement("span");
    nameSpan.textContent = groups[gi].meta[k].name;
    const clsSpan = document.createElement("span");
    clsSpan.className = "sr-class";
    clsSpan.textContent = groups[gi].meta[k].cls;
    li.append(nameSpan, clsSpan);
    li.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      selectObject(gi, k);
      resultsEl.hidden = true;
      searchEl.blur();
    });
    resultsEl.appendChild(li);
  }
  resultsEl.hidden = false;
}
searchEl.addEventListener("input", () => runSearch(searchEl.value));
searchEl.addEventListener("blur", () => setTimeout(() => (resultsEl.hidden = true), 150));
searchEl.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    const first = resultsEl.querySelector("li");
    if (first) first.dispatchEvent(new PointerEvent("pointerdown"));
  }
  if (ev.key === "Escape") searchEl.blur();
});

/* ============================================================
   10. Camera input — mouse / touch / wheel
   ============================================================ */
const pointers = new Map();
let dragDist = 0, pinchD0 = 0, distAtPinch = 0;
function dismissHint() { $("hint").classList.add("gone"); }
setTimeout(dismissHint, 9000);

canvas.addEventListener("pointerdown", (ev) => {
  canvas.setPointerCapture(ev.pointerId);
  pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  dragDist = 0;
  if (pointers.size === 2) {
    const [p1, p2] = [...pointers.values()];
    pinchD0 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    distAtPinch = state.cam.tDist;
  }
});
canvas.addEventListener("pointermove", (ev) => {
  const p = pointers.get(ev.pointerId);
  if (!p) return;
  const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
  dragDist += Math.abs(dx) + Math.abs(dy);
  p.x = ev.clientX; p.y = ev.clientY;
  if (pointers.size === 1) {
    state.cam.tYaw -= dx * 0.0052;
    state.cam.tPitch = clamp(state.cam.tPitch + dy * 0.0045, -1.45, 1.45);
    if (state.topDown && dragDist > 12) setTopDown(false, true);
    dismissHint();
  } else if (pointers.size === 2) {
    const [p1, p2] = [...pointers.values()];
    const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    if (pinchD0 > 0 && d > 0) state.cam.tDist = clamp(distAtPinch * (pinchD0 / d), 0.18, 240);
    dismissHint();
  }
});
function endPointer(ev) {
  const wasDrag = dragDist > 7 || pointers.size > 1;
  pointers.delete(ev.pointerId);
  if (!wasDrag && ev.type === "pointerup" && ev.target === canvas) {
    pickAt(ev.clientX, ev.clientY);
  }
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("wheel", (ev) => {
  ev.preventDefault();
  state.cam.tDist = clamp(state.cam.tDist * Math.exp(ev.deltaY * 0.0011), 0.18, 240);
  dismissHint();
}, { passive: false });
canvas.addEventListener("dblclick", () => {
  Object.assign(state.cam, { tYaw: -1.1, tPitch: 0.55, tDist: 7.8 });
  setTopDown(false, true);
});
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/* ============================================================
   11. UI wiring — time machine, panels, view
   ============================================================ */
const btnPlay = $("btn-play");
function syncPlayBtn() {
  btnPlay.textContent = state.playing ? "❚❚" : "▶";
  btnPlay.classList.toggle("on", state.playing);
}
btnPlay.addEventListener("click", () => { state.playing = !state.playing; syncPlayBtn(); });
$("btn-rev").addEventListener("click", (ev) => {
  state.dir *= -1;
  ev.currentTarget.classList.toggle("on", state.dir < 0);
});
$("btn-now").addEventListener("click", () => {
  state.simJD = jdNow();
  state.needFullUpdate = true;
  buildPlanetOrbits();
});
$("speed-chips").addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-dps]");
  if (!b) return;
  state.dps = +b.dataset.dps;
  if (!state.playing) { state.playing = true; syncPlayBtn(); }
  for (const x of $("speed-chips").children) x.classList.toggle("on", x === b);
});
syncPlayBtn();

/* panels: close buttons + mobile FAB toggles */
document.querySelectorAll(".panel-close").forEach((b) =>
  b.addEventListener("click", () => {
    const p = $(b.dataset.close);
    if (p.id === "panel-info") { clearSelection(); return; }
    p.classList.remove("open");
    p.classList.add("closed");
  })
);
function togglePanel(id, fab) {
  const p = $(id);
  const isOpen = p.classList.contains("open") || (!p.classList.contains("closed") && getComputedStyle(p).display !== "none");
  if (isOpen) { p.classList.remove("open"); p.classList.add("closed"); }
  else { p.classList.add("open"); p.classList.remove("closed"); }
  if (fab) fab.classList.toggle("on", !isOpen);
}
$("fab-legend").addEventListener("click", (ev) => togglePanel("panel-legend", ev.currentTarget));
$("fab-cad").addEventListener("click", (ev) => togglePanel("panel-cad", ev.currentTarget));

function setTopDown(on, skipCamera) {
  state.topDown = on;
  $("fab-view").classList.toggle("on", on);
  if (skipCamera) return;
  if (on) {
    state.savedPitch = state.cam.tPitch;
    state.cam.tPitch = 1.45;
  } else {
    state.cam.tPitch = state.savedPitch;
  }
}
$("fab-view").addEventListener("click", () => setTopDown(!state.topDown));
$("retry-btn").addEventListener("click", loadAsteroids);

/* keep the planet-orbit lines honest if the user time-travels far */
setInterval(() => {
  buildPlanetOrbits();
}, 30000);

/* ============================================================
   12. Lift-off
   ============================================================ */
window.addEventListener("error", (ev) => {
  // surface fatal init errors instead of an eternal spinner
  const loader = $("loader");
  if (loader && !loader.classList.contains("done") && !loadedOnce) {
    $("loader-status").textContent = "";
    $("loader-error-msg").textContent = "Something went wrong while starting up: " + (ev.message || "unknown error");
    $("loader-error").hidden = false;
  }
});
requestAnimationFrame((t) => { lastFrame = t; requestAnimationFrame(render); });
loadAsteroids();

})();
