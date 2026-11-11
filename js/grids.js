// Сетки композиции: геометрия, подсказки, примеры.
// Каждая сетка рисуется в координатах кадра (w × h пикселей) и отдаёт SVG-разметку.
// Классы линий: m — основная, s — пунктир, pt — точка, shade — затемнение,
// acc — янтарная, ok — зелёная, lbl — подпись.

export const PHI = (1 + Math.sqrt(5)) / 2;
const r1 = (n) => Math.round(n * 10) / 10;

const L = (x1, y1, x2, y2, c = 'm') =>
  `<line class="${c}" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}"/>`;
const C = (cx, cy, r, c = 'pt') => `<circle class="${c}" cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}"/>`;
const E = (cx, cy, rx, ry, c = 's') =>
  `<ellipse class="${c}" cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}"/>`;
const P = (d, c = 'm') => `<path class="${c}" d="${d}"/>`;
const R = (x, y, w, h, c = 'shade') =>
  `<rect class="${c}" x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}"/>`;
const poly = (pts, close = false) =>
  'M' + pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L') + (close ? 'Z' : '');
const T = (x, y, s, fs, anchor = 'middle') =>
  `<text class="lbl" x="${r1(x)}" y="${r1(y)}" font-size="${r1(fs)}" text-anchor="${anchor}">${s}</text>`;

// Затемнить всё, кроме прямоугольника (поля вокруг спирали, рамка в рамке).
const outside = (w, h, x, y, rw, rh, c = 'shade') =>
  `<path class="${c}" fill-rule="evenodd" d="M0 0H${r1(w)}V${r1(h)}H0Z M${r1(x)} ${r1(y)}h${r1(rw)}v${r1(rh)}h${r1(-rw)}Z"/>`;

function arrow(x1, y1, x2, y2, size, c = 'm') {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p1 = [x2 - size * Math.cos(a - 0.5), y2 - size * Math.sin(a - 0.5)];
  const p2 = [x2 - size * Math.cos(a + 0.5), y2 - size * Math.sin(a + 0.5)];
  return L(x1, y1, x2, y2, c) + P(poly([p1, [x2, y2], p2]), c);
}

// Основание перпендикуляра из точки P на прямую AB.
export function foot(P0, A, B) {
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const t = ((P0[0] - A[0]) * dx + (P0[1] - A[1]) * dy) / (dx * dx + dy * dy);
  return [A[0] + t * dx, A[1] + t * dy];
}

// Луч из точки до края кадра.
function rayToBox(px, py, dx, dy, w, h) {
  const ts = [];
  if (dx > 1e-9) ts.push((w - px) / dx);
  if (dx < -1e-9) ts.push(-px / dx);
  if (dy > 1e-9) ts.push((h - py) / dy);
  if (dy < -1e-9) ts.push(-py / dy);
  const t = Math.min(...ts.filter((v) => v > 1e-6));
  return [px + dx * t, py + dy * t];
}

/* ---------- Золотая спираль ---------- */
// Строится в золотом прямоугольнике φ × 1, потом вписывается в кадр с полями.
let SPIRAL_UNIT = null;
function spiralUnit() {
  if (SPIRAL_UNIT) return SPIRAL_UNIT;
  let x = 0, y = 0, w = PHI, h = 1, px = 0, py = 1;
  const pts = [[px, py]], cuts = [];
  const eq = (a, b) => Math.abs(a - b) < 1e-9;
  for (let i = 0; i < 16; i++) {
    const s = Math.min(w, h), d = i % 4;
    let cx, cy, ex, ey;
    if (d === 0) { // квадрат слева
      const sx = x + s; cx = sx; cy = py; ex = sx; ey = eq(py, y) ? y + s : y;
      cuts.push([sx, y, sx, y + h]); x += s; w -= s;
    } else if (d === 1) { // сверху
      const sy = y + s; cx = px; cy = sy; ex = eq(px, x) ? x + s : x; ey = sy;
      cuts.push([x, sy, x + w, sy]); y += s; h -= s;
    } else if (d === 2) { // справа
      const sx = x + w - s; cx = sx; cy = py; ex = sx; ey = eq(py, y) ? y + s : y;
      cuts.push([sx, y, sx, y + h]); w -= s;
    } else { // снизу
      const sy = y + h - s; cx = px; cy = sy; ex = eq(px, x) ? x + s : x; ey = sy;
      cuts.push([x, sy, x + w, sy]); h -= s;
    }
    const a0 = Math.atan2(py - cy, px - cx);
    let da = Math.atan2(ey - cy, ex - cx) - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da <= -Math.PI) da += 2 * Math.PI;
    const steps = Math.max(4, 18 - i);
    for (let k = 1; k <= steps; k++) {
      const a = a0 + (da * k) / steps;
      pts.push([cx + s * Math.cos(a), cy + s * Math.sin(a)]);
    }
    px = ex; py = ey;
  }
  SPIRAL_UNIT = { pts, cuts: cuts.slice(0, 7), pole: [px, py] };
  return SPIRAL_UNIT;
}

export function spiralGeom(w, h, v = 0) {
  const u = spiralUnit();
  const portrait = h > w;
  const UW = portrait ? 1 : PHI, UH = portrait ? PHI : 1;
  let rw, rh;
  if (w / h > UW / UH) { rh = h; rw = (h * UW) / UH; } else { rw = w; rh = (w * UH) / UW; }
  const rx = (w - rw) / 2, ry = (h - rh) / 2;
  const fx = v & 1, fy = v & 2;
  const map = ([x, y]) => {
    if (portrait) [x, y] = [y, x];
    if (fx) x = UW - x;
    if (fy) y = UH - y;
    return [rx + (x / UW) * rw, ry + (y / UH) * rh];
  };
  return {
    rect: [rx, ry, rw, rh],
    pts: u.pts.map(map),
    cuts: u.cuts.map((c) => [...map([c[0], c[1]]), ...map([c[2], c[3]])]),
    pole: map(u.pole),
  };
}

/* ---------- Динамическая симметрия ---------- */
export function dynGeom(w, h) {
  const TL = [0, 0], TR = [w, 0], BL = [0, h], BR = [w, h];
  const recips = [], eyes = [];
  [[TR, TL, BR], [BL, TL, BR], [TL, BL, TR], [BR, BL, TR]].forEach(([c, a, b]) => {
    const f = foot(c, a, b);
    eyes.push(f);
    recips.push([c, rayToBox(c[0], c[1], f[0] - c[0], f[1] - c[1], w, h)]);
  });
  return { diags: [[TL, BR], [BL, TR]], recips, eyes };
}

function triangleVerts(w, h, v) {
  return v === 0
    ? [[w * 0.5, h * 0.3], [w * 0.24, h * 0.7], [w * 0.76, h * 0.7]]
    : [[w * 0.24, h * 0.3], [w * 0.76, h * 0.3], [w * 0.5, h * 0.7]];
}

function oddPoints(w, h, v) {
  return v === 0
    ? [[w * 0.3, h * 0.62], [w * 0.52, h * 0.44], [w * 0.72, h * 0.66]]
    : [[w * 0.2, h * 0.6], [w * 0.36, h * 0.44], [w * 0.52, h * 0.56], [w * 0.68, h * 0.4], [w * 0.82, h * 0.58]];
}

function portraitGeom(w, h, v) {
  const cx = [0.5, 0.4, 0.6][v] * w;
  const eyeY = h / 3, headTop = h * 0.12;
  let ry = (eyeY - headTop) / 0.45 / 2;
  let rx = ry * 0.74;
  if (rx > w * 0.3) { const k = (w * 0.3) / rx; rx *= k; }
  return { cx, cy: headTop + ry, rx, ry, eyeY, headTop };
}

const negPos = (w, h, v) => [[w / 3, (2 * h) / 3], [(2 * w) / 3, (2 * h) / 3], [w / 3, h / 3], [(2 * w) / 3, h / 3]][v];

/* ---------- Отрисовка сеток ---------- */
// ctx: { pr — радиус точки, fs — размер подписи, roll — наклон телефона (°),
//        hasRoll — есть ли данные датчика, target — [x, y] в пикселях для ведущих линий }
const DRAW = {
  none: () => '',

  thirds(w, h, v, k) {
    const xs = [w / 3, (2 * w) / 3], ys = [h / 3, (2 * h) / 3];
    return xs.map((x) => L(x, 0, x, h)).join('') + ys.map((y) => L(0, y, w, y)).join('') +
      xs.map((x) => ys.map((y) => C(x, y, k.pr)).join('')).join('');
  },

  phi(w, h, v, k) {
    const a = 1 / PHI / PHI, b = 1 / PHI; // 0,382 и 0,618
    const xs = [w * a, w * b], ys = [h * a, h * b];
    return xs.map((x) => L(x, 0, x, h)).join('') + ys.map((y) => L(0, y, w, y)).join('') +
      xs.map((x) => ys.map((y) => C(x, y, k.pr)).join('')).join('');
  },

  spiral(w, h, v, k) {
    const g = spiralGeom(w, h, v);
    const [rx, ry, rw, rh] = g.rect;
    let s = '';
    if (rx > 0.5 || ry > 0.5) s += outside(w, h, rx, ry, rw, rh) + R(rx, ry, rw, rh, 's');
    s += g.cuts.map((c) => L(c[0], c[1], c[2], c[3], 's')).join('');
    s += P(poly(g.pts));
    s += C(g.pole[0], g.pole[1], k.pr * 1.15);
    return s;
  },

  center(w, h, v, k) {
    const m = Math.min(w, h), cx = w / 2, cy = h / 2, a = m * 0.06;
    return L(cx - a, cy, cx + a, cy) + L(cx, cy - a, cx, cy + a) +
      `<circle class="s" cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(m * 0.2)}"/>` + C(cx, cy, k.pr * 0.8);
  },

  symmetry(w, h, v, k) {
    let s = L(w / 2, 0, w / 2, h);
    if (v === 0) return s + L(0, h / 2, w, h / 2, 's');
    const ix = w * 0.36, iy = h * 0.38, iw = w * 0.28, ih = h * 0.24;
    s += L(0, 0, ix, iy, 's') + L(w, 0, ix + iw, iy, 's') + L(0, h, ix, iy + ih, 's') + L(w, h, ix + iw, iy + ih, 's');
    s += R(ix, iy, iw, ih, 's') + C(w / 2, iy + ih / 2, k.pr);
    return s;
  },

  dynamic(w, h, v, k) {
    if (v === 2) { // гармоническая арматура, 14 линий
      const TL = [0, 0], TR = [w, 0], BL = [0, h], BR = [w, h];
      const Tm = [w / 2, 0], Bm = [w / 2, h], Lm = [0, h / 2], Rm = [w, h / 2];
      const seg = [[TL, BR], [BL, TR], [TL, Bm], [TL, Rm], [TR, Bm], [TR, Lm], [BL, Tm], [BL, Rm], [BR, Tm], [BR, Lm]];
      return seg.map(([a, b]) => L(a[0], a[1], b[0], b[1])).join('') +
        P(poly([Tm, Rm, Bm, Lm], true), 's');
    }
    const g = dynGeom(w, h);
    let s = g.diags.map(([a, b]) => L(a[0], a[1], b[0], b[1])).join('');
    s += g.recips.map(([a, b]) => L(a[0], a[1], b[0], b[1])).join('');
    if (v === 1) {
      g.eyes.forEach((e) => { s += L(e[0], 0, e[0], h, 's') + L(0, e[1], w, e[1], 's'); });
    }
    s += g.eyes.map((e) => C(e[0], e[1], k.pr)).join('');
    return s;
  },

  goldtri(w, h, v, k) {
    const TL = [0, 0], TR = [w, 0], BL = [0, h], BR = [w, h];
    const [A, B, c1, c2] = v === 0 ? [BL, TR, TL, BR] : [TL, BR, TR, BL];
    const f1 = foot(c1, A, B), f2 = foot(c2, A, B);
    return L(A[0], A[1], B[0], B[1]) + L(c1[0], c1[1], f1[0], f1[1]) + L(c2[0], c2[1], f2[0], f2[1]) +
      C(f1[0], f1[1], k.pr) + C(f2[0], f2[1], k.pr);
  },

  diagonals(w, h, v, k) {
    const a = L(0, h, w, 0), b = L(0, 0, w, h);
    return (v === 0 ? a : v === 1 ? b : a + b + C(w / 2, h / 2, k.pr * 0.8));
  },

  leading(w, h, v, k) {
    const [tx, ty] = k.target || [(2 * w) / 3, h / 3];
    const m = Math.min(w, h), gap = m * 0.07;
    const from = [[0, h], [w, h], [0, 0], [w, 0], [w * 0.3, h], [w * 0.7, h], [0, h * 0.62], [w, h * 0.62]];
    let s = '';
    from.forEach(([x, y], i) => {
      const d = Math.hypot(tx - x, ty - y) || 1;
      const ex = tx - ((tx - x) / d) * gap, ey = ty - ((ty - y) / d) * gap;
      s += L(x, y, ex, ey, i < 2 || i > 3 ? 'm' : 's');
    });
    s += `<circle class="m acc" cx="${r1(tx)}" cy="${r1(ty)}" r="${r1(gap * 0.75)}"/>` + C(tx, ty, k.pr * 0.8, 'pt');
    return s;
  },

  triangle(w, h, v, k) {
    const t = triangleVerts(w, h, v);
    return P(poly(t, true)) + t.map((p) => C(p[0], p[1], k.pr * 1.2)).join('');
  },

  radial(w, h, v, k) {
    const cx = w / 2, cy = h / 2, m = Math.min(w, h);
    let s = '';
    for (let i = 1; i <= 4; i++) s += `<circle class="${i % 2 ? 's' : 'm'}" cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(m * 0.12 * i)}"/>`;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const e = rayToBox(cx, cy, Math.cos(a), Math.sin(a), w, h);
      s += L(cx + Math.cos(a) * m * 0.12, cy + Math.sin(a) * m * 0.12, e[0], e[1], 's');
    }
    return s + C(cx, cy, k.pr);
  },

  odd(w, h, v, k) {
    const pts = oddPoints(w, h, v);
    return P(poly(pts), 's') + pts.map((p) => `<circle class="m" cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r1(Math.min(w, h) * 0.055)}"/>` + C(p[0], p[1], k.pr * 0.6)).join('');
  },

  frame(w, h, v, k) {
    const [x, y, rw, rh] = v === 0 ? [w * 0.3, h * 0.2, w * 0.4, h * 0.66] : [w * 0.16, h * 0.18, w * 0.68, h * 0.5];
    return outside(w, h, x, y, rw, rh) + R(x, y, rw, rh, 'm') + C(x + rw / 2, y + rh * (v === 0 ? 0.42 : 0.5), k.pr);
  },

  foreground(w, h, v, k) {
    const mir = v === 1;
    const X = (x) => (mir ? w - x : x);
    if (v === 2) {
      return R(0, 0, w * 0.14, h, 'shade') + R(0, 0, w * 0.14, h, 's') + C((2 * w) / 3, h / 3, k.pr) +
        T(w * 0.07, h * 0.5, 'тёмный край', k.fs, 'middle').replace('<text', `<text transform="rotate(-90 ${r1(w * 0.07)} ${r1(h * 0.5)})"`);
    }
    const wedge = [[X(0), h], [X(0), h * 0.6], [X(w * 0.42), h]];
    const sx = mir ? w / 3 : (2 * w) / 3;
    return P(poly(wedge, true), 'shade') + P(poly(wedge, true), 's') + C(sx, h / 3, k.pr * 1.15) +
      T(X(w * 0.12), h * 0.9, 'близко', k.fs, mir ? 'end' : 'start');
  },

  negative(w, h, v, k) {
    const [sx, sy] = negPos(w, h, v);
    const m = Math.min(w, h);
    const lx = sx < w / 2 ? w * 0.68 : w * 0.32, ly = sy > h / 2 ? h * 0.3 : h * 0.7;
    return `<circle class="m acc" cx="${r1(sx)}" cy="${r1(sy)}" r="${r1(m * 0.06)}"/>` + C(sx, sy, k.pr) +
      L(w / 3, 0, w / 3, h, 's') + L((2 * w) / 3, 0, (2 * w) / 3, h, 's') + L(0, h / 3, w, h / 3, 's') + L(0, (2 * h) / 3, w, (2 * h) / 3, 's') +
      T(lx, ly, 'пусто', k.fs * 1.2);
  },

  fill(w, h, v, k) {
    const i = Math.min(w, h) * 0.04, a = Math.min(w, h) * 0.1;
    const corners = [[i, i, 1, 1], [w - i, i, -1, 1], [i, h - i, 1, -1], [w - i, h - i, -1, -1]];
    return corners.map(([x, y, dx, dy]) => P(`M${r1(x)} ${r1(y + dy * a)}V${r1(y)}H${r1(x + dx * a)}`)).join('') +
      R(i * 2.2, i * 2.2, w - i * 4.4, h - i * 4.4, 's');
  },

  reflection(w, h, v, k) {
    const y = v === 0 ? h / 2 : (2 * h) / 3;
    const m = Math.min(w, h) * 0.07;
    return L(0, y, w, y) + arrow(w * 0.5, y - m * 0.4, w * 0.5, y - m * 1.6, m * 0.35, 's') +
      arrow(w * 0.5, y + m * 0.4, w * 0.5, y + m * 1.6, m * 0.35, 's') +
      T(w * 0.04, y - m * 0.3, 'вода, стекло', k.fs, 'start');
  },

  ma(w, h, v, k) {
    const mir = v === 1;
    const X = (x) => (mir ? w - x : x);
    const m = Math.min(w, h);
    const px = X(w * 0.87), py = h * 0.42;
    return L(X(w * 0.76), 0, X(w * 0.76), h, 's') + C(px, py, k.pr * 1.2) +
      arrow(px, py, X(w * 0.985), py, m * 0.035, 'm acc') +
      T(X(w * 0.38), h * 0.5, 'пустота за спиной', k.fs * 1.1);
  },

  horizon(w, h, v, k) {
    const y = v === 0 ? (2 * h) / 3 : h / 3;
    return L(0, y, w, y) + L(0, v === 0 ? h / 3 : (2 * h) / 3, w, v === 0 ? h / 3 : (2 * h) / 3, 's') +
      T(w * 0.04, y - k.fs * 0.6, 'горизонт', k.fs, 'start');
  },

  portrait(w, h, v, k) {
    const g = portraitGeom(w, h, v);
    let s = L(0, g.eyeY, w, g.eyeY) + L(0, g.headTop, w, g.headTop, 's') + E(g.cx, g.cy, g.rx, g.ry, 's');
    s += T(w * 0.03, g.eyeY - k.fs * 0.5, 'глаза', k.fs, 'start') + T(w * 0.03, g.headTop - k.fs * 0.45, 'макушка', k.fs, 'start');
    if (v > 0) {
      const dir = v === 1 ? 1 : -1, x0 = g.cx + dir * (g.rx + w * 0.03);
      s += arrow(x0, g.cy, x0 + dir * w * 0.2, g.cy, Math.min(w, h) * 0.03, 'm acc');
    }
    return s;
  },

  dutch(w, h, v, k) {
    const cx = w / 2, cy = h / 2, R0 = Math.hypot(w, h) / 2;
    const ang = v === 0 ? -15 : 15;
    const line = (deg, c) => {
      const a = (deg * Math.PI) / 180;
      return L(cx - Math.cos(a) * R0, cy - Math.sin(a) * R0, cx + Math.cos(a) * R0, cy + Math.sin(a) * R0, c);
    };
    let s = '';
    const ok = k.hasRoll && Math.abs(-k.roll - ang) < 1.2;
    s += line(ang, ok ? 'm ok' : 'm acc');
    if (k.hasRoll) s += line(-k.roll, 's');
    const a = (ang * Math.PI) / 180;
    s += T(cx + Math.cos(a) * w * 0.3, cy + Math.sin(a) * w * 0.3 - k.fs * 0.8, ok ? 'есть 15°' : '15°', k.fs * 1.1);
    return s;
  },

  safe(w, h, v, k) {
    const top = h * 0.12, bot = h * 0.22, side = w * 0.15;
    return R(0, 0, w, top) + R(0, h - bot, w, bot) + R(w - side, h * 0.45, side, h * 0.55 - bot) +
      P(poly([[w * 0.04, top], [w - side, top], [w - side, h * 0.45], [w * 0.96, h * 0.45], [w * 0.96, h - bot], [w * 0.04, h - bot]], true), 's') +
      T(w / 2, h - bot / 2, 'подпись и ник', k.fs) + T(w - side / 2, h * 0.62, 'кнопки', k.fs * 0.9);
  },
};

/* ---------- Справочник сеток ---------- */
export const GROUPS = [
  { name: 'Каркас', ids: ['none', 'thirds', 'phi', 'spiral', 'center', 'symmetry', 'dynamic', 'goldtri', 'diagonals'] },
  { name: 'Линии и группы', ids: ['leading', 'triangle', 'radial', 'odd'] },
  { name: 'Глубина и акцент', ids: ['frame', 'foreground', 'negative', 'fill', 'reflection', 'ma'] },
  { name: 'Горизонт, портрет, формат', ids: ['horizon', 'portrait', 'dutch', 'safe'] },
];

export const GRIDS = {
  none: { name: 'Без сетки', short: 'Нет', variants: 1 },
  thirds: {
    name: 'Правило третей', short: 'Трети', variants: 1,
    where: 'Главное ставь на пересечение линий, горизонт — на верхнюю или нижнюю линию.',
    when: 'Спокойный, естественный кадр: герой в своём мире.',
  },
  phi: {
    name: 'Фи-сетка', short: 'Фи', variants: 1,
    where: 'Как трети, но линии ближе к центру: 0,38 и 0,62 кадра. Главное — на пересечение.',
    when: 'Кадр выглядит собраннее и «дороже», чем на третях.',
  },
  spiral: {
    name: 'Золотая спираль', short: 'Спираль', variants: 4,
    where: 'Главное — в точку, где спираль закручивается. Остальное раскладывай вдоль витка.',
    when: 'Один главный объект: лицо, чашка, человек на лестнице.',
    note: 'Поля по краям: золотой прямоугольник уже экрана.',
    varHint: 'Тап — развернуть спираль.',
  },
  center: {
    name: 'Центр', short: 'Центр', variants: 1,
    where: 'Объект строго в середине, взгляд — в камеру.',
    when: 'Прямота и напряжение. Сильнее всего с пустотой вокруг.',
    warn: 'Не смешивай с третями: получится два центра внимания.',
  },
  symmetry: {
    name: 'Симметрия', short: 'Симметрия', variants: 2,
    where: 'Совмести ось кадра с осью сцены: дверь, коридор, лицо, фасад. Держи уровень зелёным.',
    when: 'Порядок, ритуал, давление.',
    warn: 'Наклон горизонта убивает симметрию.',
    varHint: 'Второй вариант — с точкой схода для коридоров и дорог.',
  },
  dynamic: {
    name: 'Динамическая симметрия', short: 'Динамика', variants: 3,
    where: 'Диагонали и перпендикуляры к ним из углов. Главное — в «глаза», где линии сходятся под прямым углом; руки, тени, края — вдоль диагоналей.',
    when: 'Улица, движение, жест. Кадр живой, но собранный.',
    varHint: 'Тап — сетка через «глаза», потом арматура из 14 линий.',
  },
  goldtri: {
    name: 'Золотой треугольник', short: 'Треуг. φ', variants: 2,
    where: 'Главная линия сцены — по диагонали, объекты — в точки, где к ней подходят перпендикуляры.',
    when: 'Диагональные сцены: лестница, склон, рука, дорога.',
    varHint: 'Тап ещё раз — другая диагональ.',
  },
  diagonals: {
    name: 'Диагонали', short: 'Диагонали', variants: 3,
    where: 'Ключевые элементы — вдоль диагонали. Снизу-слева вверх-направо читается как подъём.',
    when: 'Движение, динамика, спорт.',
    varHint: 'Тап — другая диагональ или обе сразу.',
  },
  leading: {
    name: 'Ведущие линии', short: 'Линии', variants: 1,
    where: 'Дорога, перила, рельсы, швы плитки ведут от краёв к герою. Перетащи кружок туда, где стоит главное.',
    when: 'Повести взгляд к герою и показать, где он. Сильнее, если герой идёт вдоль линии.',
  },
  triangle: {
    name: 'Треугольник', short: 'Треугольник', variants: 2,
    where: 'Три объекта или три точки (голова и две руки) складываются в треугольник.',
    when: 'Группа из трёх людей, натюрморт. Устойчиво и с направлением.',
    varHint: 'Тап — перевернуть треугольник.',
  },
  radial: {
    name: 'Радиальная', short: 'Радиус', variants: 1,
    where: 'Линии сцены сходятся к центру: лестница-улитка, купол, туннель, цветок.',
    when: 'Затянуть взгляд в одну точку.',
  },
  odd: {
    name: 'Нечётное число', short: 'Нечётные', variants: 2,
    where: 'Три или пять объектов, не в ряд, а со сдвигом по высоте.',
    when: 'Предметка, еда, люди. Нечётная группа живее чётной.',
    varHint: 'Тап — пять объектов.',
  },
  frame: {
    name: 'Рамка в рамке', short: 'Рамка', variants: 2,
    where: 'Снимай сквозь дверь, окно, арку, ветки. Герой — внутри рамки.',
    when: 'Изоляция, подглядывание, глубина.',
    varHint: 'Тап — окно вместо двери.',
  },
  foreground: {
    name: 'Передний план', short: 'Передний', variants: 3,
    where: 'Близкий к камере предмет у края кадра — ветка, плечо, бокал, он размыт. Герой вдали на точке третей.',
    when: 'Объём и глубина.',
    varHint: 'Тап — с другой стороны; третий — тёмный край (репуссуар), он толкает взгляд внутрь.',
  },
  negative: {
    name: 'Негативное пространство', short: 'Пустота', variants: 4,
    where: 'Маленький герой в точке третей, остальное — пусто. Фон чистый: небо, стена, вода, туман.',
    when: 'Одиночество, воздух, минимализм.',
    warn: 'На листве, толпе и шумном фоне пустоты нет.',
    varHint: 'Тап — герой в другом углу.',
  },
  fill: {
    name: 'Кадр вплотную', short: 'Вплотную', variants: 1,
    where: 'Объект касается краёв кадра: лицо, фактура, деталь. Фона почти нет.',
    when: 'Деталь, эмоция, фактура. Реклама и fashion.',
    warn: 'Если всё в кадре одинаково резкое и заполненное, глазу некуда смотреть.',
  },
  reflection: {
    name: 'Отражение', short: 'Отражение', variants: 2,
    where: 'Линию воды, стекла или зеркала ставь на центр — будет зеркало.',
    when: 'Лужи после дождя, витрины, озеро. Двойной смысл, тишина.',
    varHint: 'Тап — линия на нижней трети, отражение меньше.',
  },
  ma: {
    name: 'Взгляд в край (ма)', short: 'Край', variants: 2,
    where: 'Герой у самого края, смотрит наружу. За спиной большая пустота.',
    when: 'Тревога, ожидание, недосказанность. Приём японского кино и аниме.',
    varHint: 'Тап — другой край.',
  },
  horizon: {
    name: 'Горизонт на трети', short: 'Горизонт', variants: 2,
    where: 'Горизонт на нижней линии, если главное — небо; на верхней, если главное — земля или вода.',
    when: 'Пейзаж, море, город. Включи уровень сверху: зелёная линия — ровно.',
    varHint: 'Тап — горизонт на верхней трети.',
  },
  portrait: {
    name: 'Портрет', short: 'Портрет', variants: 3,
    where: 'Глаза — на верхнюю линию третей, над макушкой — небольшой запас. Смотрит в сторону — оставь больше места перед лицом.',
    when: 'Крупный план и портрет по грудь.',
    varHint: 'Тап — взгляд вправо, потом влево.',
  },
  dutch: {
    name: 'Голландский угол', short: 'Наклон', variants: 2, live: true,
    where: 'Наклоняй телефон, пока пунктир горизонта не ляжет на линию 15°. Совпало — линия станет зелёной.',
    when: 'Тревога, дезориентация, клип.',
    warn: 'Не смешивай с симметрией. Без датчика наклона пунктира нет.',
    varHint: 'Тап — наклон в другую сторону.',
  },
  safe: {
    name: 'Зона Reels', short: 'Reels', variants: 1,
    where: 'Главное держи внутри рамки: сверху и снизу всё закроют подписи, справа — кнопки.',
    when: 'Вертикаль под Reels, TikTok, Shorts. Ставь формат 9:16. Границы примерные.',
  },
};

export const ORDER = GROUPS.flatMap((g) => g.ids);

export function drawGrid(id, w, h, v = 0, ctx = {}) {
  const m = Math.min(w, h);
  const k = { pr: Math.max(2.4, m * 0.012), fs: Math.max(10, Math.min(13, m * 0.03)), roll: 0, hasRoll: false, ...ctx };
  const fn = DRAW[id] || DRAW.none;
  return fn(w, h, v % (GRIDS[id]?.variants || 1), k);
}

/* ---------- Примеры-иллюстрации (300 × 400) ---------- */
const PAL = {
  sky1: '#B9CCCF', sky2: '#EBD9BA', ground: '#6C7A62', hill: '#8E9B83', fig: '#2A2420',
  sun: '#F2AF47', wall: '#DCCCB2', wall2: '#C9B79B', door: '#3A332D', water: '#8BA6AC', floor: '#A8957A', skin: '#D8B394',
};
let uid = 0;

function sky(id, a = PAL.sky1, b = PAL.sky2) {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="300" height="400" fill="url(#${id})"/>`;
}
const rect = (x, y, w, h, f) => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="${f}"/>`;
const fillPath = (d, f, extra = '') => `<path d="${d}" fill="${f}" ${extra}/>`;
const dot = (x, y, r, f) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(r)}" fill="${f}"/>`;

// Силуэт человека: x — центр, feet — уровень ступней, ht — рост.
function person(x, feet, ht, col = PAL.fig) {
  const r = ht * 0.12, hy = feet - ht + r, sy = feet - ht * 0.74, hip = feet - ht * 0.4;
  const d = `M${r1(x - ht * 0.17)} ${r1(sy)}Q${r1(x)} ${r1(sy - ht * 0.06)} ${r1(x + ht * 0.17)} ${r1(sy)}L${r1(x + ht * 0.12)} ${r1(hip)}L${r1(x + ht * 0.1)} ${r1(feet)}L${r1(x + ht * 0.025)} ${r1(feet)}L${r1(x)} ${r1(hip + ht * 0.1)}L${r1(x - ht * 0.025)} ${r1(feet)}L${r1(x - ht * 0.1)} ${r1(feet)}L${r1(x - ht * 0.12)} ${r1(hip)}Z`;
  return dot(x, hy, r, col) + fillPath(d, col);
}
// Человек, у которого голова стоит в точке (hx, hy).
const personHead = (hx, hy, ht, col) => person(hx, hy + ht * 0.88, ht, col);

const SCENES = {
  none: (id) => sky(id),
  thirds: (id) => sky(id) + fillPath('M0 262Q90 236 170 256T300 250V400H0Z', PAL.hill) + rect(0, 267, 300, 133, PAL.ground) +
    dot(200, 133, 17, PAL.sun) + person(100, 300, 100),
  phi: (id) => sky(id) + rect(0, 247, 300, 153, PAL.ground) + dot(185, 153, 16, PAL.sun) + personHead(115, 153, 96),
  spiral: (id, v) => {
    const g = spiralGeom(300, 400, v);
    const [px, py] = g.pole;
    return sky(id, '#D8C7AE', '#EFE3CF') + rect(0, py + 70, 300, 400, PAL.wall2) +
      `<path d="${poly(g.pts.slice(0, 40))}" fill="none" stroke="#B49C7C" stroke-width="10" stroke-linecap="round"/>` +
      personHead(px, py, 84);
  },
  center: (id) => rect(0, 0, 300, 400, PAL.wall) + rect(0, 330, 300, 70, PAL.floor) + rect(108, 110, 84, 220, PAL.door) +
    person(150, 330, 118, '#F1E6D3'),
  symmetry: (id, v) => {
    const s = rect(0, 0, 300, 400, '#E7DAC5') + fillPath('M0 0L108 152V248L0 400Z', '#CDBCA0') + fillPath('M300 0L192 152V248L300 400Z', '#C1AE90') +
      fillPath('M0 400L108 248H192L300 400Z', PAL.floor) + rect(108, 152, 84, 96, '#F3E9D7');
    return s + person(150, 248, 52);
  },
  dynamic: (id, v) => {
    const g = dynGeom(300, 400);
    const e = g.eyes[1];
    return sky(id, '#E3D3B8', '#D2BE9E') + fillPath('M0 0L300 400H170L0 160Z', '#B8A283') + personHead(e[0], e[1], 70);
  },
  goldtri: (id, v) => {
    const TL = [0, 0], TR = [300, 0], BL = [0, 400], BR = [300, 400];
    const [A, B, c1] = v === 0 ? [BL, TR, TL] : [TL, BR, TR];
    const f = foot(c1, A, B);
    const slope = v === 0 ? 'M0 400L300 0V400Z' : 'M0 0L300 400H0Z';
    return sky(id) + fillPath(slope, PAL.ground) + person(f[0], f[1] + 6, 64);
  },
  diagonals: (id, v) => {
    const road = v === 1 ? 'M0 -20L60 -20L300 380V420H260Z' : 'M-20 400L240 -20H300V30L40 420Z';
    return rect(0, 0, 300, 400, PAL.ground) + fillPath(road, '#D9C9AC') + person(150, 214, 46);
  },
  leading: (id) => {
    const tx = 200, ty = 133;
    return sky(id) + rect(0, ty, 300, 400, PAL.ground) + fillPath(`M60 400L${tx - 3} ${ty}H${tx + 3}L280 400Z`, '#CDBB9C') +
      `<path d="M0 330L${tx} ${ty}M300 330L${tx} ${ty}" stroke="#4E5A47" stroke-width="3" fill="none"/>` + person(tx, ty + 14, 26);
  },
  triangle: (id, v) => {
    const t = triangleVerts(300, 400, v);
    return rect(0, 0, 300, 400, PAL.wall) + rect(0, 300, 300, 100, PAL.floor) +
      t.map((p, i) => personHead(p[0], p[1], 92, i === 0 ? '#3D352F' : PAL.fig)).join('');
  },
  radial: () => {
    let s = rect(0, 0, 300, 400, '#2F2A25');
    const cols = ['#E8DCC6', '#B9A688', '#DCCDB3', '#9F8C70', '#CDBB9F', '#6E604F'];
    for (let i = 6; i >= 1; i--) s += dot(150, 200, i * 30, cols[(6 - i) % cols.length]);
    return s + dot(150, 200, 10, PAL.fig);
  },
  odd: (id, v) => {
    const pts = oddPoints(300, 400, v);
    return rect(0, 0, 300, 400, '#E9DDC9') + rect(0, 150, 300, 250, '#B79E7E') +
      pts.map((p) => `<ellipse cx="${r1(p[0])}" cy="${r1(p[1] + 14)}" rx="24" ry="8" fill="#8A7458"/>` + rect(p[0] - 18, p[1] - 24, 36, 38, '#F5EEE2') + `<ellipse cx="${r1(p[0])}" cy="${r1(p[1] - 24)}" rx="18" ry="6" fill="#5B4636"/>`).join('');
  },
  frame: (id, v) => {
    const [x, y, w, h] = v === 0 ? [90, 80, 120, 264] : [48, 72, 204, 200];
    return rect(0, 0, 300, 400, '#5B4E43') + `<g>${sky(id)}</g>`.replace('<rect width="300" height="400"', `<rect x="${x}" y="${y}" width="${w}" height="${h}"`) +
      rect(x, y + h * 0.72, w, h * 0.28, PAL.ground) + person(x + w / 2, y + h * 0.86, h * 0.46);
  },
  foreground: (id, v) => {
    const mir = v === 1;
    const fid = `blur${id}`;
    const leaf = v === 2 ? rect(0, 0, 42, 400, '#1E1A17') : fillPath(mir ? 'M300 400V230Q230 260 170 400Z' : 'M0 400V230Q70 260 130 400Z', '#2D3A2A', `filter="url(#${fid})"`);
    return `<defs><filter id="${fid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter></defs>` +
      sky(id) + rect(0, 220, 300, 180, PAL.ground) + personHead(mir ? 100 : 200, 133, 70) + leaf;
  },
  negative: (id, v) => {
    const [x, y] = negPos(300, 400, v);
    return sky(id, '#C9D5D5', '#EFE6D6') + personHead(x, y, 30);
  },
  fill: () => rect(0, 0, 300, 400, '#3A2C24') + `<ellipse cx="150" cy="215" rx="150" ry="205" fill="${PAL.skin}"/>` +
    fillPath('M0 60Q150 -40 300 60V0H0Z', '#2A1F19') + dot(98, 180, 11, PAL.fig) + dot(202, 180, 11, PAL.fig) +
    fillPath('M70 150Q98 138 126 150', 'none', 'stroke="#5A3F30" stroke-width="7" stroke-linecap="round"') +
    fillPath('M174 150Q202 138 230 150', 'none', 'stroke="#5A3F30" stroke-width="7" stroke-linecap="round"') +
    fillPath('M110 300Q150 322 190 300', 'none', 'stroke="#8C5545" stroke-width="9" stroke-linecap="round"'),
  reflection: (id, v) => {
    const y = v === 0 ? 200 : 267;
    const city = [[20, 60], [62, 95], [108, 50], [150, 120], [196, 70], [240, 100]];
    let top = '', bot = '';
    city.forEach(([x, hh]) => { top += rect(x, y - hh, 38, hh, '#4F5A60'); bot += rect(x, y, 38, hh * 0.9, '#6E8288'); });
    return sky(id) + top + rect(0, y, 300, 400 - y, PAL.water) + `<g opacity=".7">${bot}</g>` +
      [0.15, 0.35, 0.6].map((t) => rect(40 + t * 120, y + 14 + t * 90, 90, 2, '#C7D6D8')).join('');
  },
  ma: (id, v) => {
    const mir = v === 1;
    const x = mir ? 38 : 262;
    const nose = mir ? `M${x - 13} 196l-9 5l9 3Z` : `M${x + 13} 196l9 5l-9 3Z`;
    return rect(0, 0, 300, 400, '#E6DCCB') + rect(0, 330, 300, 70, '#CBBDA6') + person(x, 330, 150) + fillPath(nose, PAL.fig);
  },
  horizon: (id, v) => {
    const y = v === 0 ? 267 : 133;
    return sky(id, '#C8D4D2', '#F0D9B0') + dot(110, y - 40, 22, PAL.sun) + rect(0, y, 300, 400 - y, '#5F8088') +
      rect(0, y, 300, 3, '#E9D8B6');
  },
  portrait: (id, v) => {
    const g = portraitGeom(300, 400, v);
    const dir = v === 1 ? 1 : v === 2 ? -1 : 0;
    const ex = g.rx * 0.36;
    return rect(0, 0, 300, 400, '#CFC3AF') +
      fillPath(`M${r1(g.cx - g.rx * 2.1)} 400Q${r1(g.cx - g.rx * 1.9)} ${r1(g.cy + g.ry * 1.3)} ${r1(g.cx)} ${r1(g.cy + g.ry * 1.25)}Q${r1(g.cx + g.rx * 1.9)} ${r1(g.cy + g.ry * 1.3)} ${r1(g.cx + g.rx * 2.1)} 400Z`, '#3E3A36') +
      `<ellipse cx="${r1(g.cx)}" cy="${r1(g.cy)}" rx="${r1(g.rx)}" ry="${r1(g.ry)}" fill="${PAL.skin}"/>` +
      fillPath(`M${r1(g.cx - g.rx)} ${r1(g.cy - g.ry * 0.2)}Q${r1(g.cx)} ${r1(g.cy - g.ry * 1.45)} ${r1(g.cx + g.rx)} ${r1(g.cy - g.ry * 0.2)}Q${r1(g.cx)} ${r1(g.cy - g.ry * 0.75)} ${r1(g.cx - g.rx)} ${r1(g.cy - g.ry * 0.2)}Z`, '#2A1F19') +
      dot(g.cx - ex + dir * ex * 0.5, g.eyeY, 5, PAL.fig) + dot(g.cx + ex + dir * ex * 0.5, g.eyeY, 5, PAL.fig);
  },
  dutch: (id, v) => {
    const a = v === 0 ? -15 : 15;
    let city = '';
    [[10, 120], [58, 170], [104, 90], [150, 210], [200, 140], [246, 180], [290, 110]].forEach(([x, hh]) => { city += rect(x - 20, 260 - hh, 42, hh + 200, '#4A4E52'); });
    return sky(id) + `<g transform="rotate(${a} 150 200)">${rect(-100, 260, 500, 300, '#5B5F5A')}${city}</g>`;
  },
  safe: (id) => sky(id) + rect(0, 300, 300, 100, PAL.ground) + person(150, 290, 140) +
    rect(16, 18, 60, 10, 'rgba(255,255,255,.75)') + rect(16, 330, 150, 9, 'rgba(255,255,255,.8)') + rect(16, 348, 210, 8, 'rgba(255,255,255,.6)') +
    [200, 236, 272].map((y) => dot(275, y, 10, 'rgba(255,255,255,.8)')).join(''),
};

export function drawScene(id, v = 0) {
  const n = `s${++uid}`;
  const fn = SCENES[id] || SCENES.none;
  return fn(n, v % (GRIDS[id]?.variants || 1));
}
