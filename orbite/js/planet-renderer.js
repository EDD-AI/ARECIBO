/* ORBITE — rendu WebGL2 des planètes en pixel art.
 * Dessine un ou plusieurs systèmes dans une même image basse résolution :
 * surface, nuages, atmosphère, bulle, couronne, anneaux, lunes et sprites.
 * Tramage Bayer partout (aucun dégradé lisse), boucle d'animation parfaite.
 * Contient aussi l'encodeur GIF des exports. */
(function (root) {
  'use strict';

  const OP = root.OrbitePlanets;
  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  // ─── Shaders ─────────────────────────────────────────────────
  const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

  const COMMON = `
const float TAU = 6.283185307;
uniform float uReveal;
uniform float uPhase;
uniform float uFlash;
uniform float uDim;
uniform float uFlip;
out vec4 outColor;

float bayer4(vec2 fc) {
  ivec2 p = ivec2(mod(floor(fc), 4.0));
  int i = p.x + p.y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}
vec4 fin(vec3 c) { return vec4(mix(c, vec3(1.0), uFlash) * uDim, 1.0); }
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 rotAxis(vec3 p, vec3 ax, float a) { float c = cos(a), s = sin(a); return p * c + cross(ax, p) * s + ax * dot(ax, p) * (1.0 - c); }

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p, int oct) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 7; i++) {
    if (i >= oct) break;
    s += a * snoise(p);
    n += a;
    p = p * 2.02 + vec3(19.1, 7.3, 3.7);
    a *= 0.5;
  }
  return s / n;
}
float fbm01(vec3 p, int oct) { return fbm(p, oct) * 0.5 + 0.5; }
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vnoise1(float x) { float i = floor(x); float f = fract(x); float u = f * f * (3.0 - 2.0 * f); return mix(hash11(i), hash11(i + 1.0), u); }
struct Vor { float f1; float f2; vec3 pt; vec3 id; };
Vor voronoi(vec3 x) {
  vec3 ip = floor(x), fp = fract(x);
  Vor v; v.f1 = 9.0; v.f2 = 9.0; v.pt = x; v.id = vec3(0.0);
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 h = hash33(ip + g);
    vec3 r = g + h - fp;
    float d = dot(r, r);
    if (d < v.f1) { v.f2 = v.f1; v.f1 = d; v.pt = x + r; v.id = h; }
    else if (d < v.f2) { v.f2 = d; }
  }
  v.f1 = sqrt(v.f1); v.f2 = sqrt(v.f2);
  return v;
}
float ringDensity(float rho, vec4 R) {
  if (R.y <= 0.0 || rho < R.x || rho > R.y) return 0.0;
  float t = (rho - R.x) / (R.y - R.x);
  float x = rho * R.w + R.z;
  float n = vnoise1(x) * 0.5 + vnoise1(x * 2.7 + 5.1) * 0.3 + vnoise1(x * 6.3 + 9.7) * 0.2;
  float edge = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.88, t);
  return clamp((n - 0.28) * 2.0, 0.0, 1.0) * edge;
}
`;

  const VS_QUAD = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

  const FS_BODY = HEAD + COMMON + `
uniform vec2 uCenter;
uniform float uRadius;
uniform int uType;
uniform int uLayer;
uniform int uOct;
uniform mat3 uTilt;
uniform float uSpin;
uniform vec3 uLight;
uniform vec3 uSeed;
uniform vec4 uA;
uniform vec4 uB;
uniform vec4 uC;
uniform vec4 uD;
uniform sampler2D uPal;
uniform float uFacet;
uniform vec4 uOcc[4];
uniform int uOccN;
uniform vec3 uRingN;
uniform vec4 uRing;
uniform float uRingA;
uniform float uUnit;
uniform int uShadeBias;

vec3 pal(int row, int sh) { return texelFetch(uPal, ivec2(clamp(sh, 0, 7), clamp(row, 0, 15)), 0).rgb; }

struct Surf { int row; float bump; int emis; float spec; int glow; int glowRow; };
Surf surf(int row) { Surf s; s.row = row; s.bump = 0.0; s.emis = -1; s.spec = 0.0; s.glow = -1; s.glowRow = 10; return s; }

vec3 bodyToView(vec3 b, float spin) { return transpose(uTilt) * rotY(b, spin); }

int shadeOf(float l, float d) {
  float v = l + (d - 0.5) * 0.16;
  if (v > 0.8) return 5;
  if (v > 0.28) return 4;
  if (v > 0.05) return 3;
  if (v > -0.16) return 2;
  return 1;
}

vec2 craterField(vec3 p, vec3 Lt, float scale, float density, vec3 off) {
  if (density <= 0.0) return vec2(0.0);
  vec3 q = p * scale + off;
  vec3 ip = floor(q), fp = fract(q);
  float best = 9.0;
  vec3 bestD = vec3(0.0);
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 g = vec3(float(i), float(j), float(k));
    if (hash13(ip + g + 17.0) > density) continue;
    vec3 h = hash33(ip + g);
    vec3 d = fp - g - h;
    d -= p * dot(d, p);
    float rad = mix(0.16, 0.42, h.y * h.y);
    float dd = length(d) / rad;
    if (dd < best) { best = dd; bestD = d; }
  }
  if (best > 1.35) return vec2(0.0);
  vec3 dir = bestD / max(length(bestD), 1e-4);
  float ld = dot(dir, Lt);
  float bump = best < 1.0 ? -ld * (0.3 + 0.7 * best) : ld * (1.35 - best) * 2.0;
  return vec2(bump, best < 0.72 ? 1.0 : 0.0);
}

float terrainH(vec3 p) {
  vec3 q = p * uA.x + uSeed;
  vec3 w = vec3(fbm(q + vec3(5.2, 1.3, 2.8), 3), fbm(q + vec3(1.7, 9.2, 3.4), 3), fbm(q + vec3(8.3, 2.8, 6.1), 3));
  return clamp(fbm(q + w * uA.y, uOct) * uB.x * 0.5 + 0.5, 0.0, 1.0);
}

Surf terranSurf(vec3 p, vec3 Lt, float dth) {
  vec3 q = p * uA.x + uSeed;
  float h = terrainH(p);
  float sea = uA.z;
  float lat = abs(p.y) + fbm(q * 1.3 + 4.0, 3) * 0.08;
  bool cap = lat > uA.w;
  Surf s;
  if (h < sea) {
    float dep = (sea - h) / max(sea, 0.05) + (dth - 0.5) * 0.07;
    s = surf(dep > 0.34 ? 0 : (dep > 0.12 ? 1 : 2));
    s.spec = 1.0;
    if (uC.z > 0.0) {
      float wv = sin(dot(p, vec3(0.31, 0.95, 0.17)) * uC.z + fbm(q * 2.2, 2) * 6.0);
      if (wv > 0.9 && s.row < 2) s.row += 1;
    }
    if (uC.w > 0.5) { s.glow = dep < 0.12 ? 4 : 3; s.glowRow = s.row; }
    if (cap) { s = surf(7); s.spec = 0.35; }
  } else {
    float hl = (h - sea) / max(1.0 - sea, 0.05) + (dth - 0.5) * 0.04;
    float m = fbm01(q * 0.5 + vec3(11.0, 3.0, 7.0), 3);
    int row;
    if (hl < 0.035) row = 3;
    else if (hl < 0.2) row = m > uB.y ? 3 : 4;
    else if (hl < 0.36) row = m > uB.y + 0.07 ? 3 : 5;
    else if (hl < 0.58) row = 6;
    else row = 7;
    s = surf(row);
    if (cap) s.row = 7;
    float h2 = terrainH(normalize(p + Lt * 0.03));
    s.bump = clamp((h - h2) * uB.z, -0.6, 0.6);
    if (uC.x > 0.0 && !cap && row != 7) {
      float cl = fbm01(q * 0.9 + 31.0, 3);
      if (cl > 1.0 - uC.x && hash13(floor(p * uC.y) + uSeed) > 0.55) { s.glow = 5; s.glowRow = 10; }
    }
  }
  return s;
}

Surf iceSurf(vec3 p, vec3 Lt, float dth) {
  vec3 q = p * uA.x + uSeed;
  float h = fbm01(q, uOct);
  float hd = h + (dth - 0.5) * 0.04;
  int row = hd > uB.y ? 7 : (hd > uB.y - 0.16 ? 2 : 1);
  Surf s = surf(row);
  s.spec = row == 1 ? 1.0 : 0.5;
  float c1 = abs(snoise(q * uA.y * 0.5 + 7.0 + fbm(q * 2.0, 2) * 0.6));
  float c2 = abs(snoise(q * uA.y * 1.4 + 3.0));
  if (c1 < uA.w) { s.row = 0; s.spec = 0.0; }
  else if (c2 < uA.w * 0.55) s.row = row == 7 ? 2 : (row == 2 ? 1 : 0);
  vec2 cr = craterField(p, Lt, uB.w, uB.x, uSeed + 4.0);
  s.bump = cr.x * 0.8;
  if (cr.y > 0.5) s.row = 11;
  float h2 = fbm01(normalize(p + Lt * 0.04) * uA.x + uSeed, uOct);
  s.bump += (h - h2) * uB.z;
  return s;
}

Surf lavaSurf(vec3 p, vec3 Lt, float dth) {
  vec3 q = p * uA.x + uSeed;
  float h = fbm01(q, uOct);
  vec3 qr = p * uA.y + uSeed * 1.3;
  float rv = 1.0 - abs(snoise(qr + vec3(fbm(qr * 1.7, 2)) * 0.5));
  float rv2 = 1.0 - abs(snoise(qr * 2.1 + 4.0));
  float rmax = max(rv, rv2 - 0.04);
  float fl = sin(TAU * uPhase * 4.0 + h * 30.0 + q.x * 3.0) * 0.5 + 0.5;
  Surf s;
  if (h < uA.z) {
    s = surf(9);
    float dep = (uA.z - h) / uA.z;
    s.emis = 4 + int(clamp(dep * 3.0 + fl * 0.8 + (dth - 0.5) * 0.6, 0.0, 3.0));
  } else if (rmax > uA.w) {
    s = surf(9);
    s.emis = 3 + int(clamp((rmax - uA.w) / (1.0 - uA.w) * 3.0 + fl * 0.7 + (dth - 0.5) * 0.6, 0.0, 3.0));
  } else {
    s = surf(h > 0.62 ? 5 : (h > 0.45 ? 6 : 11));
    if (rmax > uA.w - 0.05) { s.glow = 2; s.glowRow = 9; }
    vec2 cr = craterField(p, Lt, uB.y, uB.x, uSeed + 3.0);
    s.bump += cr.x;
    if (cr.y > 0.5) s.row = 11;
    float h2 = fbm01(normalize(p + Lt * 0.04) * uA.x + uSeed, uOct);
    s.bump += (h - h2) * uB.z;
  }
  return s;
}

Surf desertSurf(vec3 p, vec3 Lt, float dth) {
  vec3 q = p * uA.x + uSeed;
  vec3 w = vec3(fbm(q + 1.3, 2), fbm(q + 7.1, 2), fbm(q + 3.7, 2));
  float h = fbm01(q + w * 0.6, uOct);
  float hd = h + (dth - 0.5) * 0.04;
  int row = hd > 0.64 ? 6 : (hd > 0.52 ? 5 : (hd > 0.38 ? 4 : 3));
  Surf s = surf(row);
  float cv = 1.0 - abs(snoise(q * 1.4 + 9.0));
  if (cv > uA.z) s.row = 11;
  float dune = sin(dot(p, vec3(0.86, 0.22, 0.46)) * uA.y + fbm(q * 1.8, 3) * 5.0);
  if (row <= 4) s.bump += dune * 0.16;
  float lat = abs(p.y) + fbm(q * 1.2, 2) * 0.06;
  if (lat > uA.w) s.row = 7;
  vec2 cr = craterField(p, Lt, uB.y, uB.x, uSeed + 5.0);
  s.bump += cr.x * 0.8;
  if (cr.y > 0.5 && s.row != 7) s.row = 6;
  float h2 = fbm01(normalize(p + Lt * 0.04) * uA.x + uSeed + w * 0.6, uOct);
  s.bump += (h - h2) * uB.z;
  return s;
}

Surf gasSurf(vec3 p, float dth) {
  vec3 q = p * uA.x + uSeed;
  float turb = fbm(vec3(q.x, q.y * 2.5, q.z), max(uOct - 1, 2));
  float v = p.y * uA.y + turb * uA.z;
  float bn = vnoise1(v + uSeed.x) * 0.62 + vnoise1(v * 2.7 + uSeed.y) * 0.38;
  int row = int(clamp(bn + (dth - 0.5) * 0.1, 0.0, 0.999) * uB.y);
  Surf s = surf(row);
  if (uC.w > 0.0) {
    vec3 sd = normalize(uC.xyz);
    vec3 e1 = normalize(cross(vec3(0.0, 1.0, 0.0), sd));
    vec3 e2 = cross(sd, e1);
    vec2 lc = vec2(dot(p, e1) / 1.7, dot(p, e2)) / uC.w;
    float lr = length(lc);
    if (dot(p, sd) > 0.0 && lr < 1.0) {
      float sw = atan(lc.y, lc.x) + lr * 6.0 - TAU * uPhase * 2.0;
      float rg = sin(sw + lr * 8.0) + (dth - 0.5) * 0.4;
      if (lr < 0.5) s.row = 7;
      else if (lr < 0.88) s.row = rg > 0.0 ? 6 : 7;
      else s.row = rg > 0.3 ? 6 : row;
    }
  }
  return s;
}

Surf rockSurf(vec3 p, vec3 Lt, float dth) {
  vec3 q = p * uA.x + uSeed;
  float h = fbm01(q, uOct);
  float mar = fbm01(q * 0.45 + 13.0, 3) + (dth - 0.5) * 0.04;
  int row = mar < uA.y ? 11 : (h > 0.6 ? 5 : 6);
  Surf s = surf(row);
  vec2 c1 = craterField(p, Lt, uA.z, uA.w, uSeed + 1.0);
  vec2 c2 = craterField(p, Lt, uA.z * uB.x, uA.w * 0.85, uSeed + 2.0);
  s.bump = c1.x + c2.x * 0.7;
  if (c1.y > 0.5) s.row = row == 5 ? 6 : 11;
  float h2 = fbm01(normalize(p + Lt * 0.04) * uA.x + uSeed, uOct);
  s.bump += (h - h2) * uB.z;
  return s;
}

Surf starSurf(vec3 p, vec3 nv, float dth) {
  vec3 q = p * uA.x + uSeed;
  vec3 m = vec3(cos(TAU * uPhase), sin(TAU * uPhase), 0.0) * 0.3;
  Vor v = voronoi(q * uA.z * 0.5 + m);
  float gran = 1.0 - smoothstep(0.1, 0.8, v.f1);
  float turb = fbm01(q + m * 2.0, max(uOct - 1, 2));
  float I = 0.22 + 0.48 * turb + 0.3 * gran;
  I *= mix(0.5, 1.08, pow(max(nv.z, 0.0), 0.5));
  if (fbm01(q * 0.8 + 21.0, 3) > uA.y) I *= 0.55;
  Surf s = surf(0);
  s.emis = clamp(int(I * 7.0 + (dth - 0.5) * 0.9), 1, 7);
  return s;
}

Surf crystalSurf(vec3 p, float spin, float dth, inout vec3 nl) {
  Vor v = voronoi(p * uA.x + uSeed);
  vec3 cdir = normalize(v.pt - uSeed);
  vec3 nb = normalize(cdir + (v.id - 0.5) * uB.x);
  nl = bodyToView(nb, spin);
  float irid = fract(dot(nl, vec3(0.5, 0.7, 0.4)) * 0.6 + v.id.z * 0.16 + uPhase);
  Surf s = surf(int(irid * 4.0));
  s.spec = 1.6;
  float edge = v.f2 - v.f1;
  if (edge < uA.y || v.id.x < uA.z) {
    s.row = 9;
    float core = fbm01(p * 5.0 + uSeed + vec3(cos(TAU * uPhase), sin(TAU * uPhase), 0.0) * 0.4, 3);
    s.emis = clamp(int(core * 5.0 + (dth - 0.5) * 1.2) + 2, 2, 7);
    if (edge < uA.y * 0.45) s.emis = min(7, s.emis + 1);
  }
  return s;
}

Surf mechaSurf(vec3 p, vec3 Lt, float dth) {
  float lon = atan(p.z, p.x);
  float lat = asin(clamp(p.y, -1.0, 1.0));
  vec2 g = vec2(lon / TAU * uA.x, lat / 3.14159265 * uA.y);
  vec2 cell = floor(g);
  vec2 f = fract(g);
  float hp = hash12(cell + uSeed.xy);
  Surf s = surf(hp > 0.72 ? 5 : 6);
  s.bump = (hp - 0.5) * 0.4;
  s.spec = 0.7;
  float ew = 0.06 / max(cos(lat), 0.2);
  if (f.x < ew || f.y < 0.08) { s.row = 11; s.bump = -0.15; s.spec = 0.0; }
  if (abs(lat) < uA.z) { s.row = 11; s.bump = -0.35; s.spec = 0.0; }
  vec2 sub = floor(g * vec2(5.0, 3.0));
  if (hash12(cell * 1.37 + uSeed.yz) > 0.6 && hash12(sub + uSeed.zx) > 0.82 && f.x > ew && f.y > 0.08) { s.glow = 5; s.glowRow = 10; }
  vec3 ed = normalize(uC.xyz);
  float ang = acos(clamp(dot(p, ed), -1.0, 1.0));
  float rr = ang / uC.w;
  if (rr < 1.0) {
    s.glow = -1;
    if (rr < 0.3) {
      s.row = 9;
      int pulse = sin(TAU * uPhase * 3.0) > 0.6 ? 1 : 0;
      s.emis = clamp(7 - int(rr / 0.3 * 3.0 + (dth - 0.5) * 0.8) - pulse, 3, 7);
    } else if (rr < 0.4) {
      s.row = 11; s.bump = -0.4; s.spec = 0.0;
    } else {
      s.row = fract(rr * 4.0) < 0.12 ? 6 : 5;
      vec3 d = p - ed;
      d -= p * dot(d, p);
      vec3 dir = d / max(length(d), 1e-4);
      s.bump = -dot(dir, Lt) * 0.8 * rr;
      s.spec = 0.4;
    }
  }
  return s;
}

float asteroidR(vec3 dir) {
  vec3 e = dir / uC.xyz;
  return (1.0 / length(e)) * (1.0 + uD.x * fbm(dir * uD.y + uSeed + 11.0, 4));
}
float asteroidSDF(vec3 q) {
  float lq = length(q);
  vec3 b = rotY(uTilt * (q / max(lq, 1e-4)), -uSpin);
  return lq - asteroidR(b);
}
vec3 asteroidNormal(vec3 q) {
  vec2 e = vec2(0.012, 0.0);
  return normalize(vec3(
    asteroidSDF(q + e.xyy) - asteroidSDF(q - e.xyy),
    asteroidSDF(q + e.yxy) - asteroidSDF(q - e.yxy),
    asteroidSDF(q + e.yyx) - asteroidSDF(q - e.yyx)));
}

vec3 portalColor(vec2 xy, float dth) {
  float c = cos(uA.y), s = sin(uA.y);
  vec2 e = vec2(c * xy.x + s * xy.y, -s * xy.x + c * xy.y);
  e.x /= uA.x;
  float r = length(e);
  float ang = atan(e.y, e.x);
  vec3 tp = vec3(cos(TAU * uPhase), sin(TAU * uPhase), 0.0) * 0.5;
  float en = fbm(vec3(cos(ang) * 1.6, sin(ang) * 1.6, 0.0) + uSeed + tp, 3);
  float rEdge = 0.92 + en * 0.16;
  if (r > rEdge + 0.2) discard;
  vec2 e2 = e - uB.xy * clamp(1.0 - r, 0.0, 1.0);
  float r2 = length(e2);
  float a2 = atan(e2.y, e2.x);
  float sw = a2 * uA.z + log(r2 + 0.04) * uA.w + TAU * uPhase * uB.z;
  float wob = fbm(vec3(cos(sw), sin(sw), r2 * 3.0) + uSeed, 3);
  if (r > rEdge) {
    float gl = 1.0 - (r - rEdge) / 0.2;
    float wisp = 0.5 + 0.5 * sin(sw * 2.0 + wob * 3.0);
    if (gl * gl * (0.3 + 0.9 * wisp) < dth) discard;
    return pal(0, gl > 0.5 ? 6 : 5);
  }
  float v = pow(clamp(r2 / rEdge, 0.0, 1.0), 0.8) * 0.8 + (0.5 + 0.5 * sin(sw)) * 0.22 + wob * 0.15;
  if (r > rEdge - 0.06) v += 0.25;
  return pal(0, clamp(int(v * 7.0 + (dth - 0.5) * 0.9), 0, 7));
}

float cloudDens(vec3 p) {
  if (uD.w > 0.0) {
    vec3 sd = uD.xyz;
    float cd = dot(p, sd);
    float cr = cos(uD.w);
    if (cd > cr) { float k = (cd - cr) / (1.0 - cr); p = rotAxis(p, sd, k * k * 7.0); }
  }
  vec3 q = vec3(p.x, p.y * uB.w, p.z) * uA.x + uSeed;
  float morph = 0.22 * sin(TAU * uPhase);
  float base = clamp(fbm(q + vec3(morph, 0.0, -morph), min(uOct, 4)) * 1.5 * 0.5 + 0.5, 0.0, 1.0);
  Vor v = voronoi(q * uA.z);
  float puff = 1.0 - v.f1 * 1.7;
  float band = uB.x > 0.0 ? (0.5 + 0.5 * sin(p.y * uB.x + base * 3.0)) * uB.y : 0.0;
  return base * 0.7 + puff * uA.w + band - uA.y;
}

float shadowAt(vec3 P, float dth) {
  float sf = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= uOccN) break;
    vec3 c = uOcc[i].xyz;
    float rr = uOcc[i].w;
    float t = dot(c - P, uLight);
    if (t > 0.0) {
      vec3 cl = P + uLight * t - c;
      if (dot(cl, cl) < rr * rr) sf = 1.2;
    }
  }
  if (uRing.y > 0.0) {
    float dn = dot(uRingN, uLight);
    if (abs(dn) > 0.001) {
      float t = -dot(uRingN, P) / dn;
      if (t > 0.0) {
        float dens = ringDensity(length(P + uLight * t), uRing) * uRingA;
        if (dens > dth) sf = max(sf, 0.45);
      }
    }
  }
  return sf;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float dth = bayer4(fc);
  if (dth > uReveal) discard;
  vec2 xy = (fc - uCenter) / uRadius;
  xy.y *= uFlip;
  if (uType == 10) { outColor = fin(portalColor(xy, dth)); return; }

  bool ast = (uType == 7 && uLayer == 0);
  vec3 pv;
  if (ast) {
    float bound = uD.z;
    float d2 = dot(xy, xy);
    if (d2 > bound * bound) discard;
    float z = sqrt(max(bound * bound - d2, 0.0));
    bool hit = false;
    for (int i = 0; i < 56; i++) {
      float d = asteroidSDF(vec3(xy, z));
      if (d < 0.004) { hit = true; break; }
      z -= max(d * 0.6, 0.006);
      if (z < -bound) break;
    }
    if (!hit) discard;
    pv = vec3(xy, z);
  } else {
    float r2 = dot(xy, xy);
    if (r2 > 1.0) discard;
    pv = vec3(xy, sqrt(1.0 - r2));
  }
  if (uType == 11) { outColor = fin(vec3(0.0)); return; }

  vec3 nv = ast ? asteroidNormal(pv) : pv;
  vec3 pt = uTilt * normalize(pv);
  float spin = uSpin;
  if (uType == 5 && uLayer == 0 && uB.x > 0.0) spin += TAU * uPhase * floor(uB.x * (0.5 + 0.5 * sin(pt.y * 6.0 + uSeed.z)) + 0.5);
  vec3 p = rotY(pt, -spin);
  vec3 Lb = rotY(uTilt * uLight, -spin);
  vec3 P = pv * uUnit;

  if (uLayer == 1) {
    float d = cloudDens(p);
    if (d + (dth - 0.5) * 0.05 < 0.0) discard;
    float dl = cloudDens(normalize(p + Lb * 0.08));
    float l = dot(nv, uLight) + clamp((d - dl) * uB.z, -0.65, 0.35) + 0.1;
    if (d < 0.04) l -= 0.18;
    l -= shadowAt(P, dth) * 0.8;
    outColor = fin(pal(8, clamp(shadeOf(l, dth) + uShadeBias, 0, 7)));
    return;
  }

  vec3 nl = nv;
  if (uFacet > 0.0 && uType != 9 && uType != 8) {
    Vor fv = voronoi(p * uFacet + uSeed * 0.71);
    vec3 cdir = normalize(fv.pt - uSeed * 0.71);
    vec3 fn = bodyToView(normalize(cdir + (fv.id - 0.5) * 0.2), spin);
    p = cdir;
    nl = ast ? normalize(mix(nv, fn, 0.75)) : fn;
  }
  vec3 Lt = Lb - p * dot(Lb, p);
  Lt = dot(Lt, Lt) > 1e-6 ? normalize(Lt) : vec3(0.0);

  Surf s;
  if (uType <= 1) s = terranSurf(p, Lt, dth);
  else if (uType == 2) s = iceSurf(p, Lt, dth);
  else if (uType == 3) s = lavaSurf(p, Lt, dth);
  else if (uType == 4) s = desertSurf(p, Lt, dth);
  else if (uType == 5) s = gasSurf(p, dth);
  else if (uType == 6 || uType == 7) s = rockSurf(p, Lt, dth);
  else if (uType == 8) s = starSurf(p, nv, dth);
  else if (uType == 9) s = crystalSurf(p, spin, dth, nl);
  else s = mechaSurf(p, Lt, dth);

  if (s.emis >= 0) { outColor = fin(pal(s.row, s.emis)); return; }

  float l = dot(nl, uLight) + s.bump * 0.5;
  float sf = shadowAt(P, dth);
  l -= sf;
  int sh = shadeOf(l, dth);
  if (s.spec > 0.0 && sf < 0.3) {
    float sp = pow(max(dot(nl, normalize(uLight + vec3(0.0, 0.0, 1.0))), 0.0), 28.0) * s.spec + (dth - 0.5) * 0.25;
    if (sp > 0.45) sh += 1;
    if (sp > 0.85) sh += 1;
  }
  int row = s.row;
  if (s.glow >= 0 && l < -0.02) { row = s.glowRow; sh = max(sh, s.glow); }
  outColor = fin(pal(row, clamp(sh + uShadeBias, 0, 7)));
}
`;

  const FS_HALO = HEAD + COMMON + `
uniform vec2 uCenter;
uniform float uRadius;
uniform int uMode;
uniform vec3 uLight;
uniform vec4 uA;
uniform sampler2D uPal;
uniform int uRow;
uniform vec3 uSeed;

vec3 pal(int row, int sh) { return texelFetch(uPal, ivec2(clamp(sh, 0, 7), clamp(row, 0, 15)), 0).rgb; }

void main() {
  vec2 fc = gl_FragCoord.xy;
  float dth = bayer4(fc);
  if (dth > uReveal) discard;
  vec2 xy = (fc - uCenter) / uRadius;
  xy.y *= uFlip;
  float r = length(xy);
  vec3 col;
  if (uMode == 0) {
    float w = uA.x;
    if (r < 1.0) {
      float nz = sqrt(1.0 - r * r);
      float lit = clamp(dot(vec3(xy, nz), uLight) * 0.75 + 0.4, 0.0, 1.0);
      if (r < 1.0 - 2.5 / uRadius) discard;
      float f = pow(1.0 - nz, uA.z) * uA.y * lit;
      if (f < dth) discard;
      col = pal(uRow, 3 + int(f * 3.0));
    } else if (r < 1.0 + w) {
      float t = (r - 1.0) / w;
      float lit = clamp(dot(vec3(xy / r, 0.0), uLight) * 0.8 + 0.45, 0.0, 1.0);
      float f = clamp((1.0 - t) * 1.35 - 0.15, 0.0, 1.0);
      f = f * f * lit * uA.w;
      if (f < dth) discard;
      col = pal(uRow, 2 + int(f * 4.0));
    } else discard;
  } else if (uMode == 1) {
    vec2 s = xy / uA.x;
    float rs = length(s);
    if (rs > 1.0 + uA.z) discard;
    if (rs > 1.0) {
      float t = (rs - 1.0) / uA.z;
      float f = (1.0 - t) * (1.0 - t) * 0.85;
      if (f < dth) discard;
      col = pal(15, f > 0.5 ? 7 : 6);
    } else {
      float nz = sqrt(1.0 - rs * rs);
      vec3 n = vec3(s, nz);
      vec2 ld = normalize(uLight.xy + vec2(1e-4, 0.0));
      float hs = dot(n, normalize(vec3(ld * 0.75, 0.66)));
      if (hs > 0.972) { outColor = fin(pal(15, 7)); return; }
      float side = dot(s, ld);
      if (rs > 0.78 && rs < 0.88 && side > 0.62 && abs(dot(s / max(rs, 1e-4), vec2(-ld.y, ld.x))) < 0.42) { outColor = fin(pal(15, 7)); return; }
      vec2 bo = -ld * 0.5 + vec2(ld.y, -ld.x) * 0.18;
      float bd = length(s - bo);
      if (bd < 0.13) {
        if (bd > 0.095) {
          int bi = int(mod(floor(atan(s.y - bo.y, s.x - bo.x) / TAU * 8.0 + uPhase * 8.0 * uA.w), 8.0));
          outColor = fin(pal(13, bi));
          return;
        }
        if (length(s - bo - ld * 0.05) < 0.035) { outColor = fin(pal(15, 7)); return; }
      }
      float fres = pow(1.0 - nz, 2.0);
      float f = fres * uA.y + (rs > 0.955 ? 0.75 : 0.0);
      if (f < dth) discard;
      float ht = atan(s.y, s.x) / TAU * 2.0 + fres * 2.0 + uPhase * uA.w;
      col = rs > 0.975 ? pal(15, 7) : pal(13, int(mod(floor(ht * 8.0), 8.0)));
    }
  } else if (uMode == 2) {
    if (r < 0.98) discard;
    float a = atan(xy.y, xy.x);
    vec3 rp = vec3(cos(a) * uA.y, sin(a) * uA.y, 0.0) + vec3(cos(TAU * uPhase), sin(TAU * uPhase), 0.0) * 0.6 + uSeed;
    float rays = fbm01(rp, 4);
    float len = uA.x * (0.45 + 1.1 * rays * rays);
    float t = (r - 1.0) / len;
    if (t > 1.0) discard;
    float f = pow(1.0 - max(t, 0.0), 1.6) * uA.z;
    if (f < dth) discard;
    col = pal(uRow, clamp(int(f * 6.0) + 2, 1, 7));
  } else if (uMode == 3) {
    if (r < 1.0 || r > uA.x) discard;
    if (r < 1.06) col = pal(uRow, 7);
    else {
      float t = (r - 1.06) / (uA.x - 1.06);
      float a = atan(xy.y, xy.x) + TAU * uPhase * uA.y;
      float sw = fbm01(vec3(cos(a) * 2.2, sin(a) * 2.2, r * 3.0) + uSeed, 4);
      float topW = 0.55 + 0.45 * smoothstep(-0.4, 0.6, xy.y / r);
      float I = pow(1.0 - t, 1.7) * (0.35 + 0.8 * sw) * topW;
      if (I < dth * 0.85) discard;
      col = pal(uRow, clamp(int(I * 7.0) + 1, 1, 7));
    }
  } else {
    if (r < 0.95 || r > uA.x) discard;
    float t = clamp((r - 1.0) / (uA.x - 1.0), 0.0, 1.0);
    float a = atan(xy.y, xy.x);
    float wav = 0.72 + 0.28 * sin(a * 5.0 + TAU * uPhase * 2.0);
    float f = (1.0 - t);
    f = f * f * wav * uA.y;
    if (f < dth) discard;
    col = pal(uRow, clamp(int(f * 5.0) + 3, 0, 7));
  }
  outColor = fin(col);
}
`;

  const FS_RING = HEAD + COMMON + `
uniform vec2 uCenter;
uniform float uRadius;
uniform vec3 uN;
uniform vec3 uU;
uniform vec3 uV;
uniform vec4 uRing;
uniform vec4 uRing2;
uniform int uPass;
uniform vec3 uLight;
uniform vec3 uSeed;
uniform sampler2D uPal;

vec3 pal(int row, int sh) { return texelFetch(uPal, ivec2(clamp(sh, 0, 7), clamp(row, 0, 15)), 0).rgb; }

void main() {
  vec2 fc = gl_FragCoord.xy;
  float dth = bayer4(fc);
  if (dth > uReveal) discard;
  vec2 xy = (fc - uCenter) / uRadius;
  xy.y *= uFlip;
  if (abs(uN.z) < 0.004) discard;
  float z = -(uN.x * xy.x + uN.y * xy.y) / uN.z;
  vec3 P = vec3(xy, z);
  float rho = length(P);
  if (rho < uRing.x || rho > uRing.y) discard;
  if ((uPass == 1) != (z > 0.0)) discard;
  float t = (rho - uRing.x) / (uRing.y - uRing.x);
  if (uRing2.x > 0.5) {
    float ang = atan(dot(P, uV), dot(P, uU));
    float spd = floor(uRing2.z * (1.0 + (1.0 - t) * 2.0));
    float a2 = ang - TAU * uPhase * spd + rho * 1.7;
    float sw = fbm01(vec3(cos(a2) * 1.8, sin(a2) * 1.8, rho * 2.6) + uSeed, 4);
    float I = pow(1.0 - t, 1.25) * (0.35 + 0.85 * sw);
    I *= 1.0 + 0.6 * normalize(cross(uN, P)).z;
    I *= smoothstep(0.0, 0.08, t);
    if (I < dth * 0.9) discard;
    outColor = fin(pal(0, clamp(int(I * 7.0) + 1, 1, 7)));
    return;
  }
  float dens = ringDensity(rho, uRing);
  if (dens * uRing2.y < dth) discard;
  float cn = vnoise1(rho * uRing2.w + uRing.z * 3.1);
  int row = cn < 0.36 ? 0 : (cn < 0.68 ? 1 : 2);
  bool litFace = (dot(uN, uLight) > 0.0) == (uN.z > 0.0);
  float b = dot(P, uLight);
  float c = dot(P, P) - 1.0;
  bool shadow = (b < 0.0 && b * b - c > 0.0);
  int sh = 3 + int(dens * 2.0 + (dth - 0.5) * 0.8) + (litFace ? 1 : -1);
  if (shadow) sh = 1;
  outColor = fin(pal(row, sh));
}
`;

  const VS_SPRITE = `#version 300 es
in vec2 aPos;
in float aSize;
in float aShape;
in vec4 aCol;
uniform vec2 uRes;
out vec4 vCol;
flat out int vShape;
flat out int vSize;
void main() {
  gl_Position = vec4(aPos / uRes * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = aSize;
  vCol = aCol;
  vShape = int(aShape + 0.5);
  vSize = int(aSize + 0.5);
}
`;

  const FS_SPRITE = HEAD + COMMON + `
in vec4 vCol;
flat in int vShape;
flat in int vSize;
void main() {
  float d = bayer4(gl_FragCoord.xy);
  if (d > uReveal) discard;
  int h = vSize / 2;
  ivec2 o = ivec2(floor(gl_PointCoord * float(vSize))) - ivec2(h);
  int ax = abs(o.x), ay = abs(o.y);
  if (vShape == 1) { if (ax != 0 && ay != 0) discard; }
  else if (vShape == 2) { if (!((ax == 0 || ay == 0) || (ax == 1 && ay == 1 && h >= 3))) discard; }
  else if (vShape == 3) { if (float(ax * ax + ay * ay) > (float(h) + 0.35) * (float(h) + 0.35)) discard; }
  else if (vShape == 4) { if (ax + ay > h) discard; }
  else if (vShape == 5) { if (ay != 0) discard; }
  if (vCol.a < 0.999 && vCol.a < d) discard;
  outColor = fin(vCol.rgb);
}
`;

  const FS_BG = HEAD + COMMON + `
uniform vec2 uRes;
uniform vec3 uTop;
uniform vec3 uBot;
uniform vec4 uNeb;
uniform vec3 uNebA;
uniform vec3 uNebB;
uniform vec3 uSeed;
void main() {
  vec2 fc = gl_FragCoord.xy;
  float dth = bayer4(fc);
  float g = clamp(fc.y / uRes.y + (dth - 0.5) * 0.18, 0.0, 1.0);
  vec3 col = mix(uBot, uTop, min(floor(g * 5.0) / 4.0, 1.0));
  if (uNeb.x > 0.0) {
    vec2 q = fc / uRes.y * uNeb.y;
    float w = fbm01(vec3(q, 0.0) + uSeed, 5) * uNeb.x + (dth - 0.5) * 0.08;
    if (w > uNeb.z + 0.12) col = uNebB;
    else if (w > uNeb.z) col = uNebA;
  }
  outColor = fin(col);
}
`;

  // ─── Utilitaires GL ──────────────────────────────────────────
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('Shader : ' + log);
    }
    return s;
  }

  const SPRITE_CAP = 6000;
  const LAYERS = ['far', 'back', 'front', 'top'];

  class SpriteBatch {
    constructor() {
      this.data = {};
      this.count = {};
      for (const l of LAYERS) { this.data[l] = new Float32Array(SPRITE_CAP * 8); this.count[l] = 0; }
    }
    reset(layers) { for (const l of layers || LAYERS) this.count[l] = 0; }
    push(layer, x, y, size, shape, col, alpha) {
      const n = this.count[layer];
      if (n >= SPRITE_CAP) return;
      const s = Math.max(1, Math.round(size));
      const px = s % 2 === 1 ? Math.floor(x) + 0.5 : Math.round(x);
      const py = s % 2 === 1 ? Math.floor(y) + 0.5 : Math.round(y);
      const d = this.data[layer], o = n * 8;
      d[o] = px; d[o + 1] = py; d[o + 2] = s; d[o + 3] = shape;
      d[o + 4] = col[0] / 255; d[o + 5] = col[1] / 255; d[o + 6] = col[2] / 255; d[o + 7] = alpha == null ? 1 : alpha;
      this.count[layer] = n + 1;
    }
  }

  const GOLD = OP.gradRamp([[0.3, 0.08, 60], [0.55, 0.13, 75], [0.78, 0.15, 88], [0.97, 0.06, 100]]);
  const GHOST = OP.gradRamp([[0.3, 0.06, 300], [0.55, 0.1, 295], [0.78, 0.09, 285], [0.96, 0.03, 270]]);

  class Renderer {
    constructor(canvas, o) {
      o = o || {};
      const gl = canvas.getContext('webgl2', {
        alpha: !!o.transparent, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: true, preserveDrawingBuffer: !!o.preserve, powerPreference: 'high-performance'
      });
      if (!gl) throw new Error('WEBGL2_UNAVAILABLE');
      this.gl = gl;
      this.canvas = canvas;
      this.transparent = !!o.transparent;
      this.W = canvas.width;
      this.H = canvas.height;
      this.progBody = this.program(VS_QUAD, FS_BODY, ['aPos']);
      this.progHalo = this.program(VS_QUAD, FS_HALO, ['aPos']);
      this.progRing = this.program(VS_QUAD, FS_RING, ['aPos']);
      this.progBg = this.program(VS_QUAD, FS_BG, ['aPos']);
      this.progSprite = this.program(VS_SPRITE, FS_SPRITE, ['aPos', 'aSize', 'aShape', 'aCol']);

      this.quadVao = gl.createVertexArray();
      gl.bindVertexArray(this.quadVao);
      const qb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, qb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      this.spriteVao = gl.createVertexArray();
      gl.bindVertexArray(this.spriteVao);
      this.spriteBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
      gl.bufferData(gl.ARRAY_BUFFER, SPRITE_CAP * 32 * LAYERS.length, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 32, 8);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 32, 16);
      gl.bindVertexArray(null);

      this.batch = new SpriteBatch();
      this.texCache = new WeakMap();
      this.goldRows = OP.basePalette(); this.goldRows[0] = GOLD;
      this.ghostRows = OP.basePalette(); this.ghostRows[0] = GHOST;
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
    }

    program(vs, fs, attribs) {
      const gl = this.gl;
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
      gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
      attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Programme : ' + gl.getProgramInfoLog(p));
      return { p, cache: {} };
    }

    loc(prog, name) {
      let l = prog.cache[name];
      if (l === undefined) { l = this.gl.getUniformLocation(prog.p, name); prog.cache[name] = l; }
      return l;
    }

    resize(w, h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.W = w;
      this.H = h;
    }

    paletteTex(rows) {
      let t = this.texCache.get(rows);
      if (t) return t;
      const gl = this.gl;
      const data = new Uint8Array(8 * 16 * 4);
      for (let y = 0; y < 16; y++) {
        const row = rows[y] || rows[0];
        for (let x = 0; x < 8; x++) {
          const c = row[x], o = (y * 8 + x) * 4;
          data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
        }
      }
      t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 8, 16, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.texCache.set(rows, t);
      return t;
    }

    bindPal(prog, rows) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.paletteTex(rows));
      gl.uniform1i(this.loc(prog, 'uPal'), 0);
    }

    common(prog, st) {
      const gl = this.gl;
      gl.uniform1f(this.loc(prog, 'uReveal'), st.reveal);
      gl.uniform1f(this.loc(prog, 'uPhase'), st.phase);
      gl.uniform1f(this.loc(prog, 'uFlash'), st.flash);
      gl.uniform1f(this.loc(prog, 'uDim'), st.dim);
      gl.uniform1f(this.loc(prog, 'uFlip'), st.flip);
    }

    clip(cx, cy, r) {
      const x0 = Math.max(0, Math.floor(cx - r - 2));
      const y0 = Math.max(0, Math.floor(cy - r - 2));
      const x1 = Math.min(this.W, Math.ceil(cx + r + 2));
      const y1 = Math.min(this.H, Math.ceil(cy + r + 2));
      this.gl.scissor(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
      return x1 > x0 && y1 > y0;
    }

    quad() {
      this.gl.bindVertexArray(this.quadVao);
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }

    clear(rgb) {
      const gl = this.gl;
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, this.W, this.H);
      if (rgb) gl.clearColor(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1);
      else gl.clearColor(0, 0, 0, this.transparent ? 0 : 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    // ─── Passes ───────────────────────────────────────────────
    bodyPass(b, layer, P) {
      const gl = this.gl, pr = this.progBody;
      const ext = layer === 1 ? P.r : P.r * (b.bound || 1);
      if (!this.clip(P.cx, P.cy, ext)) return;
      gl.useProgram(pr.p);
      this.common(pr, P.st);
      const U = (n) => this.loc(pr, n);
      const src = layer === 1 ? b.clouds : b;
      if (!b.M32) b.M32 = new Float32Array(b.M || (b.M = OP.tiltMatrix(b.roll, b.pitch)));
      gl.uniform2f(U('uCenter'), P.cx, P.cy);
      gl.uniform1f(U('uRadius'), P.r);
      gl.uniform1i(U('uType'), b.shader);
      gl.uniform1i(U('uLayer'), layer);
      gl.uniform1i(U('uOct'), P.r < 16 ? 3 : P.r < 34 ? 4 : 5);
      gl.uniformMatrix3fv(U('uTilt'), false, b.M32);
      gl.uniform1f(U('uSpin'), P.spin);
      gl.uniform3fv(U('uLight'), P.light);
      gl.uniform3fv(U('uSeed'), src.seed);
      gl.uniform4fv(U('uA'), src.A);
      gl.uniform4fv(U('uB'), src.B);
      gl.uniform4fv(U('uC'), b.C);
      gl.uniform4fv(U('uD'), src.D);
      gl.uniform1f(U('uFacet'), layer === 0 ? b.facet : 0);
      gl.uniform4fv(U('uOcc'), P.occ);
      gl.uniform1i(U('uOccN'), P.occN);
      const ring = P.ring;
      if (ring) {
        gl.uniform3fv(U('uRingN'), P.ringN);
        gl.uniform4f(U('uRing'), ring.inner, ring.outer, ring.seed, ring.freq);
        gl.uniform1f(U('uRingA'), ring.opacity);
      } else {
        gl.uniform4f(U('uRing'), 0, 0, 0, 0);
      }
      gl.uniform1f(U('uUnit'), P.unit);
      gl.uniform1i(U('uShadeBias'), P.bias || 0);
      this.bindPal(pr, b.pal);
      this.quad();
    }

    haloPass(mode, cx, cy, r, ext, A, rows, row, seed, light, st) {
      this.gl.enable(this.gl.SCISSOR_TEST);
      if (!this.clip(cx, cy, r * ext)) return;
      const gl = this.gl, pr = this.progHalo;
      gl.useProgram(pr.p);
      this.common(pr, st);
      gl.uniform2f(this.loc(pr, 'uCenter'), cx, cy);
      gl.uniform1f(this.loc(pr, 'uRadius'), r);
      gl.uniform1i(this.loc(pr, 'uMode'), mode);
      gl.uniform3fv(this.loc(pr, 'uLight'), light);
      gl.uniform4fv(this.loc(pr, 'uA'), A);
      gl.uniform1i(this.loc(pr, 'uRow'), row);
      gl.uniform3fv(this.loc(pr, 'uSeed'), seed);
      this.bindPal(pr, rows);
      this.quad();
    }

    ringPass(g, pass, P) {
      const ring = g.ring;
      if (!this.clip(P.cx, P.cy, P.R * ring.outer)) return;
      const gl = this.gl, pr = this.progRing;
      gl.useProgram(pr.p);
      this.common(pr, P.st);
      const U = (n) => this.loc(pr, n);
      gl.uniform2f(U('uCenter'), P.cx, P.cy);
      gl.uniform1f(U('uRadius'), P.R);
      gl.uniform3fv(U('uN'), g.ringN);
      gl.uniform3fv(U('uU'), g.ringU);
      gl.uniform3fv(U('uV'), g.ringV);
      gl.uniform4f(U('uRing'), ring.inner, ring.outer, ring.seed, ring.freq);
      gl.uniform4f(U('uRing2'), ring.mode, ring.opacity, ring.cycles, ring.colorFreq);
      gl.uniform1i(U('uPass'), pass);
      gl.uniform3fv(U('uLight'), P.light);
      gl.uniform3fv(U('uSeed'), g.body.seed);
      this.bindPal(pr, ring.pal);
      this.quad();
    }

    uploadBatch(layers) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf);
      for (const l of layers) {
        const n = this.batch.count[l];
        if (n) gl.bufferSubData(gl.ARRAY_BUFFER, LAYERS.indexOf(l) * SPRITE_CAP * 32, this.batch.data[l], 0, n * 8);
      }
    }

    drawLayer(layer, st) {
      const n = this.batch.count[layer];
      if (!n) return;
      const gl = this.gl, pr = this.progSprite;
      const scissor = gl.isEnabled(gl.SCISSOR_TEST);
      gl.disable(gl.SCISSOR_TEST);
      gl.useProgram(pr.p);
      this.common(pr, st);
      gl.uniform2f(this.loc(pr, 'uRes'), this.W, this.H);
      gl.bindVertexArray(this.spriteVao);
      gl.drawArrays(gl.POINTS, LAYERS.indexOf(layer) * SPRITE_CAP, n);
      if (scissor) gl.enable(gl.SCISSOR_TEST);
    }

    // ─── Système complet ──────────────────────────────────────
    // o : { cx, cy, R, phase, reveal, flash, dim, flip, golden, ghost, shield, light }
    drawSystem(g, o) {
      const gl = this.gl;
      const st = {
        reveal: o.reveal == null ? 1 : o.reveal,
        phase: o.phase || 0,
        flash: o.flash || 0,
        dim: o.dim == null ? 1 : o.dim,
        flip: o.flip ? -1 : 1
      };
      if (st.reveal <= 0.001) return;
      gl.viewport(0, 0, this.W, this.H);
      const b = g.body;
      if (!b.M) b.M = OP.tiltMatrix(b.roll, b.pitch);
      const cx = Math.round(o.cx), cy = Math.round(o.cy), R = o.R;
      const phase = st.phase;
      const light = o.light || g.light;
      const isStar = b.shader === OP.SH.STAR;
      const P = { cx, cy, R, flip: st.flip, phase, light, st, golden: o.golden, ghost: o.ghost };

      const moons = g.moons.map((m) => {
        const ang = TAU * (m.phase0 + m.cycles * phase);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const pos = [
          m.a * (ca * m.U[0] + sa * m.V[0]),
          m.a * (ca * m.U[1] + sa * m.V[1]),
          m.a * (ca * m.U[2] + sa * m.V[2])
        ];
        const rm = Math.max(2, m.size * R);
        return { m, pos, ang, rm, su: rm / R };
      });

      this.batch.reset(['back', 'front', 'top']);
      this.systemSprites(g, P, moons);
      this.uploadBatch(['back', 'front', 'top']);
      gl.enable(gl.SCISSOR_TEST);

      const occ = new Float32Array(16);
      let occN = 0;
      if (!isStar) {
        for (const ms of moons) {
          if (occN >= 4) break;
          occ[occN * 4] = ms.pos[0]; occ[occN * 4 + 1] = ms.pos[1]; occ[occN * 4 + 2] = ms.pos[2]; occ[occN * 4 + 3] = ms.su;
          occN++;
        }
      }
      const bandRing = g.ring && g.ring.mode === 0 ? g.ring : null;
      const spin = TAU * b.spinCycles * phase + b.spinOffset;

      if (g.ring) this.ringPass(g, 0, P);
      this.drawLayer('back', st);
      moons.filter((ms) => ms.pos[2] < 0).sort((a, c) => a.pos[2] - c.pos[2]).forEach((ms) => this.moonPass(g, ms, P, isStar));

      if (o.golden) this.haloPass(4, cx, cy, R, 1.5, [1.5, 0.95, 0, 0], this.goldRows, 0, b.seed, light, st);
      if (o.ghost) this.haloPass(4, cx, cy, R, 1.45, [1.45, 0.8, 0, 0], this.ghostRows, 0, b.seed, light, st);
      if (b.corona) this.haloPass(2, cx, cy, R, 1 + b.corona.len * 1.6, [b.corona.len, b.corona.freq, b.corona.power, 0], b.pal, 0, b.seed, light, st);
      if (b.lens) this.haloPass(3, cx, cy, R, b.lens.outer, [b.lens.outer, b.lens.cycles, 0, 0], b.pal, 9, b.seed, light, st);

      const base = { cx, cy, light, occ, occN, st, ring: bandRing, ringN: g.ringN, bias: 0 };
      this.bodyPass(b, 0, Object.assign({}, base, { r: R, spin, unit: 1 }));
      if (b.clouds) {
        const cspin = TAU * (b.spinCycles + b.clouds.extraCycles) * phase + b.spinOffset;
        this.bodyPass(b, 1, Object.assign({}, base, { r: R * b.clouds.mul, spin: cspin, unit: b.clouds.mul }));
      }
      if (b.atmo) this.haloPass(0, cx, cy, R, 1 + b.atmo.w, [b.atmo.w, b.atmo.inner, b.atmo.pow, b.atmo.outer], b.pal, 12, b.seed, light, st);
      if (b.shell) this.haloPass(1, cx, cy, R, b.shell.rs * (1 + b.shell.glow), [b.shell.rs, b.shell.rim, b.shell.glow, b.shell.cycles], b.pal, 13, b.seed, light, st);
      if (o.shield) this.haloPass(1, cx, cy, R, 1.3, [1.2, 1.1, 0.08, 1], b.pal, 13, b.seed, light, st);

      if (g.ring) this.ringPass(g, 1, P);
      this.drawLayer('front', st);
      moons.filter((ms) => ms.pos[2] >= 0).sort((a, c) => a.pos[2] - c.pos[2]).forEach((ms) => this.moonPass(g, ms, P, isStar));
      this.drawLayer('top', st);
      gl.disable(gl.SCISSOR_TEST);
    }

    moonPass(g, ms, P, isStar) {
      const m = ms.m, mb = m.body;
      if (!mb.M) mb.M = OP.tiltMatrix(mb.roll, mb.pitch);
      const cx = Math.round(P.cx + ms.pos[0] * P.R);
      const cy = Math.round(P.cy + ms.pos[1] * P.R * P.flip);
      let light = P.light;
      const occ = new Float32Array(16);
      let occN = 0;
      if (isStar) {
        const l = Math.hypot(ms.pos[0], ms.pos[1], ms.pos[2]) || 1;
        light = [-ms.pos[0] / l, -ms.pos[1] / l, -ms.pos[2] / l];
      } else {
        occ[0] = -ms.pos[0] / ms.su; occ[1] = -ms.pos[1] / ms.su; occ[2] = -ms.pos[2] / ms.su; occ[3] = 1 / ms.su;
        occN = 1;
      }
      const spin = TAU * mb.spinCycles * P.phase + mb.spinOffset;
      this.bodyPass(mb, 0, { cx, cy, r: ms.rm, spin, light, occ, occN, st: P.st, ring: null, unit: 1, bias: 0 });
    }

    systemSprites(g, P, moons) {
      const S = this.batch;
      const { cx, cy, R, flip, phase, light } = P;
      const put = (layer, X, Y, size, shape, col, alpha) => S.push(layer, cx + X * R, cy + Y * R * flip, size, shape, col, alpha);
      const sizeK = clamp(R / 60, 0.35, 1);

      if (g.debris) {
        const d = g.debris, U = g.debrisU, V = g.debrisV, N = g.debrisN;
        const n = Math.round(d.parts.length * clamp(R / 60, 0.3, 1));
        for (let i = 0; i < n; i++) {
          const p = d.parts[i];
          const a = p.a + TAU * p.cyc * phase;
          const ca = Math.cos(a), sa = Math.sin(a);
          const X = p.r * (ca * U[0] + sa * V[0]) + p.h * N[0];
          const Y = p.r * (ca * U[1] + sa * V[1]) + p.h * N[1];
          const Z = p.r * (ca * U[2] + sa * V[2]) + p.h * N[2];
          const bl = X * light[0] + Y * light[1] + Z * light[2];
          const shadow = bl < 0 && bl * bl - (X * X + Y * Y + Z * Z - 1) > 0;
          const lit = bl / p.r;
          const sh = shadow ? 1 : clamp(p.shade + (lit > 0.3 ? 1 : lit < -0.3 ? -1 : 0), 1, 6);
          const size = Math.max(1, Math.round(p.size * sizeK));
          put(Z > 0 ? 'front' : 'back', X, Y, size, size >= 3 ? 3 : 0, d.ramps[p.row][sh], 1);
        }
      }

      for (const ms of moons) {
        if (!ms.m.trail) continue;
        const m = ms.m;
        const col = m.body.pal[m.body.shader === OP.SH.GAS ? 0 : 5][6];
        const seen = new Set();
        for (let j = 1; j <= 44; j++) {
          const ang = ms.ang - (j / 44) * 1.1;
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const X = m.a * (ca * m.U[0] + sa * m.V[0]);
          const Y = m.a * (ca * m.U[1] + sa * m.V[1]);
          const Z = m.a * (ca * m.U[2] + sa * m.V[2]);
          const px = Math.floor(cx + X * R), py = Math.floor(cy + Y * R * flip);
          const key = px * 4096 + py;
          if (seen.has(key)) continue;
          seen.add(key);
          if (Math.hypot(X - ms.pos[0], Y - ms.pos[1]) * R < ms.rm + 1.5) continue;
          put(Z > 0 ? 'front' : 'back', X, Y, 1, 0, col, 0.85 * (1 - j / 44));
        }
      }

      for (const s of g.sats) {
        const ang = TAU * (s.ph + s.cyc * phase);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const X = s.a * (ca * s.U[0] + sa * s.V[0]);
        const Y = s.a * (ca * s.U[1] + sa * s.V[1]);
        const Z = s.a * (ca * s.U[2] + sa * s.V[2]);
        const bl = X * light[0] + Y * light[1] + Z * light[2];
        const dark = bl < 0 && bl * bl - (X * X + Y * Y + Z * Z - 1) > 0;
        const layer = Z > 0 ? 'front' : 'back';
        const bx = cx + X * R, by = cy + Y * R * flip;
        S.push(layer, bx, by, 1, 0, dark ? [90, 92, 104] : [222, 226, 236], 1);
        const pc = dark ? s.panel.map((v) => v * 0.45) : s.panel;
        S.push(layer, bx - 2, by, 1, 0, pc, 1);
        S.push(layer, bx - 1, by, 1, 0, pc, 1);
        S.push(layer, bx + 1, by, 1, 0, pc, 1);
        S.push(layer, bx + 2, by, 1, 0, pc, 1);
        if (((s.ph + phase * 8) % 1) < 0.25) S.push(layer, bx, by + 1, 1, 0, [255, 90, 80], 1);
      }

      if (g.fx.shards) {
        const pal = g.body.pal;
        for (const s of g.fx.shards) {
          const ang = TAU * (s.ph + s.cyc * phase);
          const ca = Math.cos(ang), sa = Math.sin(ang);
          const X = s.a * (ca * s.U[0] + sa * s.V[0]);
          const Y = s.a * (ca * s.U[1] + sa * s.V[1]);
          const Z = s.a * (ca * s.U[2] + sa * s.V[2]);
          const size = Math.max(1, Math.round(s.size * sizeK));
          put(Z > 0 ? 'front' : 'back', X, Y, size, size >= 3 ? 4 : 0, pal[s.row][Z > 0 ? 6 : 4], 1);
        }
      }

      if (g.fx.sparks) {
        const b = g.body, c = Math.cos(b.A[1]), s = Math.sin(b.A[1]), asp = b.A[0];
        for (const sp of g.fx.sparks) {
          const u = (sp.ph + sp.cyc * phase) % 1;
          const r = 0.95 + 0.45 * u;
          const a = sp.a + sp.spin * u;
          const ex = Math.cos(a) * r * asp, ey = Math.sin(a) * r;
          const X = c * ex - s * ey, Y = s * ex + c * ey;
          put('top', X, Y, Math.max(1, Math.round(sp.size * sizeK)), 0, b.pal[0][u < 0.35 ? 7 : u < 0.7 ? 6 : 5], 1 - u);
        }
      }

      if (g.fx.infall && g.body.disk) {
        const d = g.body.disk, U = g.ringU, V = g.ringV;
        const hot = g.ring.pal[0];
        for (const p of g.fx.infall) {
          const u = (p.ph + p.cyc * phase) % 1;
          const rho = d.outer * 1.05 + (d.inner * 0.9 - d.outer * 1.05) * u;
          const a = p.a + u * TAU * 1.2;
          const ca = Math.cos(a), sa = Math.sin(a);
          const X = rho * (ca * U[0] + sa * V[0]), Y = rho * (ca * U[1] + sa * V[1]), Z = rho * (ca * U[2] + sa * V[2]);
          put(Z > 0 ? 'front' : 'back', X, Y, Math.max(1, Math.round(p.size * sizeK)), 0, hot[clamp(3 + Math.floor(u * 5), 0, 7)], u < 0.9 ? 1 : 0.4);
        }
      }

      for (const sp of g.sparkles) {
        const tw = Math.sin(TAU * (sp.cyc * phase + sp.ph));
        if (tw <= 0) continue;
        const size = tw > 0.75 ? 5 : tw > 0.4 ? 3 : 1;
        put('top', Math.cos(sp.a) * sp.r, Math.sin(sp.a) * sp.r, size, size > 1 ? 2 : 0, sp.col, 1);
      }

      if (P.golden) {
        const k = 1.32;
        for (let i = 0; i < 14; i++) {
          const ang = TAU * (i / 14 + phase * 2);
          const X = Math.cos(ang) * k, Z = Math.sin(ang) * k, Y = Z * -0.28 + X * 0.08;
          put(Z > 0 ? 'front' : 'back', X, Y, i % 3 === 0 ? 2 : 1, 0, GOLD[i % 3 === 0 ? 7 : 6], 1);
        }
        for (let i = 0; i < 3; i++) {
          const tw = Math.sin(TAU * (phase * 3 + i / 3));
          if (tw <= 0.2) continue;
          const a = i * 2.1 + 0.6;
          put('top', Math.cos(a) * 1.25, Math.sin(a) * 1.25, tw > 0.7 ? 5 : 3, 2, GOLD[7], 1);
        }
      }
    }

    // ─── Décor (atelier) ──────────────────────────────────────
    drawBackground(field, st) {
      const gl = this.gl, pr = this.progBg;
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, this.W, this.H);
      gl.useProgram(pr.p);
      this.common(pr, st || { reveal: 1, phase: 0, flash: 0, dim: 1, flip: 1 });
      const th = field.theme;
      gl.uniform2f(this.loc(pr, 'uRes'), this.W, this.H);
      gl.uniform3f(this.loc(pr, 'uTop'), th.top[0] / 255, th.top[1] / 255, th.top[2] / 255);
      gl.uniform3f(this.loc(pr, 'uBot'), th.bot[0] / 255, th.bot[1] / 255, th.bot[2] / 255);
      const nb = field.nebula;
      if (nb) {
        const a = th.stars[0], b = th.stars[1];
        const mix = (c, k) => [(th.bot[0] + (c[0] - th.bot[0]) * k) / 255, (th.bot[1] + (c[1] - th.bot[1]) * k) / 255, (th.bot[2] + (c[2] - th.bot[2]) * k) / 255];
        gl.uniform4f(this.loc(pr, 'uNeb'), nb.strength, nb.scale, nb.thr, 0);
        gl.uniform3fv(this.loc(pr, 'uNebA'), mix(a, nb.a));
        gl.uniform3fv(this.loc(pr, 'uNebB'), mix(b, nb.a * 1.8));
        gl.uniform3fv(this.loc(pr, 'uSeed'), nb.seed);
      } else {
        gl.uniform4f(this.loc(pr, 'uNeb'), 0, 0, 0, 0);
      }
      this.quad();
    }

    drawStars(field, phase, st, count, skip) {
      const S = this.batch;
      S.reset(['far']);
      const th = field.theme, bg = th.bot;
      const n = Math.min(field.stars.length, count == null ? field.stars.length : count);
      const mix = (c, k) => [bg[0] + (c[0] - bg[0]) * k, bg[1] + (c[1] - bg[1]) * k, bg[2] + (c[2] - bg[2]) * k];
      for (let i = 0; i < n; i++) {
        const s = field.stars[i];
        const x = s.x * this.W, y = s.y * this.H;
        if (skip && skip(x, y)) continue;
        const tw = s.tw ? Math.round((0.5 + 0.5 * Math.sin(TAU * (s.tw * phase + s.ph))) * 3) / 3 : 1;
        const col = th.stars[s.col];
        if (s.kind === 0) S.push('far', x, y, 1, 0, mix(col, s.dim * (0.35 + 0.4 * tw)), 1);
        else if (s.kind === 1) S.push('far', x, y, 1, 0, mix(col, 0.6 + 0.4 * tw), 1);
        else if (s.kind === 2) {
          if (tw > 0.4) S.push('far', x, y, 3, 1, mix(col, 0.55), 1);
          S.push('far', x, y, 1, 0, col, 1);
        } else {
          const sz = tw > 0.7 ? 5 : tw > 0.3 ? 3 : 1;
          if (sz > 1) S.push('far', x, y, sz, 2, mix(col, 0.7), 1);
          S.push('far', x, y, 1, 0, [255, 255, 255], 1);
        }
      }
      this.uploadBatch(['far']);
      this.drawLayer('far', st || { reveal: 1, phase, flash: 0, dim: 1, flip: 1 });
    }

    // Particules libres du jeu : [{x, y, size, shape, col, a}]
    drawPoints(list, st) {
      const S = this.batch;
      S.reset(['top']);
      for (const p of list) S.push('top', p.x, p.y, p.size, p.shape || 0, p.col, p.a == null ? 1 : p.a);
      this.uploadBatch(['top']);
      this.drawLayer('top', st || { reveal: 1, phase: 0, flash: 0, dim: 1, flip: 1 });
    }

    drawComets(g, phase, layerFront, st) {
      const S = this.batch;
      S.reset(['top']);
      const diag = Math.hypot(this.W, this.H);
      for (const c of g.comets) {
        if (c.front !== layerFront) continue;
        const u = (phase - c.t0 + 1) % 1;
        if (u > c.dur) continue;
        const k = u / c.dur;
        const sx = this.W / 2 + Math.cos(c.ang) * diag * 0.6, sy = this.H / 2 + Math.sin(c.ang) * diag * 0.6;
        const dirA = c.ang + Math.PI + c.dir;
        const dx = Math.cos(dirA), dy = Math.sin(dirA);
        const hx = sx + dx * diag * 1.2 * k, hy = sy + dy * diag * 1.2 * k;
        for (let i = c.len; i >= 0; i--) {
          const t = i / c.len;
          const col = c.rainbow ? OP.oklch(0.86, 0.13, c.hue + t * 300) : OP.oklch(0.95 - t * 0.35, 0.05 + t * 0.07, 230 + t * 60);
          S.push('top', hx - dx * i, hy - dy * i, i < c.len * 0.3 ? 2 : 1, 0, col, 1 - t * 0.9);
        }
        S.push('top', hx, hy, 3, 1, [255, 255, 255], 1);
      }
      this.uploadBatch(['top']);
      this.drawLayer('top', st);
    }

    drawFar(g, phase, st) {
      if (!g.far) return;
      const f = g.far, b = f.body;
      if (!b.M) b.M = OP.tiltMatrix(b.roll, b.pitch);
      const r = Math.max(3, f.size * Math.min(this.W, this.H) * 0.5 * 0.5);
      const P = { cx: Math.round(f.x * this.W), cy: Math.round(f.y * this.H), r, spin: TAU * phase + b.spinOffset, light: g.light, occ: new Float32Array(16), occN: 0, st, ring: null, unit: 1, bias: -1 };
      this.gl.enable(this.gl.SCISSOR_TEST);
      this.bodyPass(b, 0, P);
      this.gl.disable(this.gl.SCISSOR_TEST);
    }

    // Scène complète de l'atelier.
    drawScene(g, field, L, phase, reveal) {
      const st = { reveal: 1, phase, flash: 0, dim: 1, flip: 1 };
      this.clear();
      this.drawBackground(field, st);
      const rst = Object.assign({}, st, { reveal });
      this.drawStars(field, phase, rst, L.starCount);
      this.drawFar(g, phase, rst);
      if (g.comets.length) this.drawComets(g, phase, false, rst);
      this.drawSystem(g, { cx: L.cx, cy: L.cy, R: L.R, phase, reveal });
      if (g.comets.length) this.drawComets(g, phase, true, rst);
    }

    readRect(x, y, w, h) {
      const gl = this.gl;
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const out = new Uint8Array(w * h * 4);
      for (let row = 0; row < h; row++) out.set(buf.subarray((h - 1 - row) * w * 4, (h - row) * w * 4), row * w * 4);
      return out;
    }
  }

  // ─── Encodeur GIF (LZW, palette ≤ 256, boucle infinie) ─────────
  class ByteWriter {
    constructor() { this.buf = new Uint8Array(1 << 20); this.n = 0; }
    ensure(k) {
      if (this.n + k <= this.buf.length) return;
      let c = this.buf.length * 2;
      while (c < this.n + k) c *= 2;
      const nb = new Uint8Array(c);
      nb.set(this.buf.subarray(0, this.n));
      this.buf = nb;
    }
    u8(v) { this.ensure(1); this.buf[this.n++] = v & 255; }
    u16(v) { this.u8(v); this.u8(v >> 8); }
    str(s) { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); }
    arr(a, len) { this.ensure(len); this.buf.set(a.subarray(0, len), this.n); this.n += len; }
    bytes() { return this.buf.slice(0, this.n); }
  }

  const LZW_CODE = new Int32Array(4096 * 256);
  const LZW_STAMP = new Int32Array(4096 * 256);
  let lzwEpoch = 0;

  function lzwEncode(indices, minCodeSize, out) {
    out.u8(minCodeSize);
    const clearCode = 1 << minCodeSize, eoi = clearCode + 1;
    let codeSize = minCodeSize + 1, nextCode = eoi + 1;
    let cur = 0, curBits = 0;
    const block = new Uint8Array(255);
    let blockLen = 0;
    const byte = (v) => {
      block[blockLen++] = v;
      if (blockLen === 255) { out.u8(255); out.arr(block, 255); blockLen = 0; }
    };
    const emit = (code) => {
      cur |= code << curBits;
      curBits += codeSize;
      while (curBits >= 8) { byte(cur & 255); cur >>>= 8; curBits -= 8; }
    };
    lzwEpoch++;
    emit(clearCode);
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const key = (prefix << 8) | k;
      if (LZW_STAMP[key] === lzwEpoch) { prefix = LZW_CODE[key]; continue; }
      emit(prefix);
      if (nextCode === 4096) {
        emit(clearCode);
        lzwEpoch++;
        codeSize = minCodeSize + 1;
        nextCode = eoi + 1;
      } else {
        if (nextCode >= (1 << codeSize)) codeSize++;
        LZW_STAMP[key] = lzwEpoch;
        LZW_CODE[key] = nextCode++;
      }
      prefix = k;
    }
    emit(prefix);
    emit(eoi);
    if (curBits > 0) byte(cur & 255);
    if (blockLen > 0) { out.u8(blockLen); out.arr(block, blockLen); }
    out.u8(0);
  }

  function medianCut(hist, maxColors) {
    const cols = [];
    hist.forEach((n, k) => cols.push([(k >> 16) & 255, (k >> 8) & 255, k & 255, n]));
    const stats = (box) => {
      const mn = [255, 255, 255], mx = [0, 0, 0];
      let count = 0;
      for (const c of box.c) {
        for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
        count += c[3];
      }
      const r = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
      box.ch = r[0] >= r[1] && r[0] >= r[2] ? 0 : r[1] >= r[2] ? 1 : 2;
      box.range = r[box.ch];
      box.count = count;
      return box;
    };
    const boxes = [stats({ c: cols })];
    while (boxes.length < maxColors) {
      let best = null, score = -1;
      for (const b of boxes) {
        if (b.c.length < 2 || b.range === 0) continue;
        const s = b.range * Math.sqrt(b.count);
        if (s > score) { score = s; best = b; }
      }
      if (!best) break;
      const ch = best.ch;
      best.c.sort((a, b) => a[ch] - b[ch]);
      let acc = 0, k = 0;
      for (; k < best.c.length - 2; k++) { acc += best.c[k][3]; if (acc >= best.count / 2) break; }
      boxes.splice(boxes.indexOf(best), 1, stats({ c: best.c.slice(0, k + 1) }), stats({ c: best.c.slice(k + 1) }));
    }
    return boxes.map((b) => {
      let r = 0, g = 0, bl = 0, n = 0;
      for (const c of b.c) { r += c[0] * c[3]; g += c[1] * c[3]; bl += c[2] * c[3]; n += c[3]; }
      return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)];
    });
  }

  // frames : tableaux RGBA (haut → bas) de w × h. Résultat : Blob image/gif.
  async function encodeGif(frames, w, h, o) {
    o = o || {};
    const scale = o.scale || 1, delay = o.delay || 8, progress = o.onProgress || (() => {});
    const hist = new Map();
    const step = Math.max(1, Math.floor(frames.length / 30));
    for (let f = 0; f < frames.length; f += step) {
      const px = frames[f];
      for (let i = 0; i < px.length; i += 4) {
        const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
        hist.set(key, (hist.get(key) || 0) + 1);
      }
    }
    const palette = hist.size <= 256 ? [...hist.keys()].map((k) => [(k >> 16) & 255, (k >> 8) & 255, k & 255]) : medianCut(hist, 256);
    while (palette.length < 256) palette.push([0, 0, 0]);
    const lookup = new Map();
    palette.forEach((c, i) => { const k = (c[0] << 16) | (c[1] << 8) | c[2]; if (!lookup.has(k)) lookup.set(k, i); });
    const indexOf = (r, g, b) => {
      const k = (r << 16) | (g << 8) | b;
      let v = lookup.get(k);
      if (v === undefined) {
        let best = 1e9;
        for (let i = 0; i < 256; i++) {
          const c = palette[i], d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
          if (d < best) { best = d; v = i; }
        }
        lookup.set(k, v);
      }
      return v;
    };
    const W = w * scale, H = h * scale;
    const out = new ByteWriter();
    out.str('GIF89a');
    out.u16(W); out.u16(H);
    out.u8(0xf7); out.u8(0); out.u8(0);
    for (const c of palette) { out.u8(c[0]); out.u8(c[1]); out.u8(c[2]); }
    out.u8(0x21); out.u8(0xff); out.u8(11); out.str('NETSCAPE2.0'); out.u8(3); out.u8(1); out.u16(0); out.u8(0);
    const idx = new Uint8Array(W * H);
    for (let f = 0; f < frames.length; f++) {
      const px = frames[f];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const v = indexOf(px[i], px[i + 1], px[i + 2]);
          for (let sy = 0; sy < scale; sy++) {
            const row = (y * scale + sy) * W + x * scale;
            for (let sx = 0; sx < scale; sx++) idx[row + sx] = v;
          }
        }
      }
      out.u8(0x21); out.u8(0xf9); out.u8(4); out.u8(0x04); out.u16(delay); out.u8(0); out.u8(0);
      out.u8(0x2c); out.u16(0); out.u16(0); out.u16(W); out.u16(H); out.u8(0);
      lzwEncode(idx, 8, out);
      progress((f + 1) / frames.length);
      if (f % 3 === 2) await new Promise((r) => setTimeout(r, 0));
    }
    out.u8(0x3b);
    return new Blob([out.bytes()], { type: 'image/gif' });
  }

  OP.Renderer = Renderer;
  OP.encodeGif = encodeGif;
  OP.GOLD = GOLD;
})(typeof window !== 'undefined' ? window : globalThis);
