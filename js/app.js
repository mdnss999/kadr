import { GRIDS, GROUPS, ORDER, drawGrid, drawScene } from './grids.js';

const $ = (s) => document.querySelector(s);
const els = {
  frame: $('#frame'), video: $('#video'), still: $('#still'), overlay: $('#overlay'), stage: $('#stage'),
  level: $('#level'), levelVal: $('#levelVal'), count: $('#count'), flash: $('#flash'), help: $('#btnHelp'),
  empty: $('#empty'), emptyTitle: $('#emptyTitle'), emptyText: $('#emptyText'),
  card: $('#card'), cardEx: $('#cardEx'), cardTitle: $('#cardTitle'), cardWhere: $('#cardWhere'),
  cardWhen: $('#cardWhen'), cardWarn: $('#cardWarn'), cardVar: $('#cardVar'),
  toast: $('#toast'), toastText: $('#toastText'), toastAct: $('#toastAct'),
  carousel: $('#carousel'), gridName: $('#gridName'), dots: $('#dots'), zoom: $('#zoom'),
  aspect: $('#btnAspect'), levelBtn: $('#btnLevel'), timer: $('#btnTimer'), timerVal: $('#timerVal'),
  shutter: $('#btnShutter'), thumbImg: $('#thumbImg'), reviewBar: $('#reviewBar'),
  settings: $('#settings'), gallery: $('#gallery'), gGrid: $('#gGrid'), gEmpty: $('#gEmpty'),
  viewer: $('#viewer'), viewImg: $('#viewImg'), fileIn: $('#fileIn'), resInfo: $('#resInfo'),
};

/* ---------- память настроек (только этот браузер) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem('kadr:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('kadr:' + k, JSON.stringify(v)); } catch { /* приватный режим */ } },
};

const ASPECTS = ['3:4', '9:16', '1:1'];
const qualityBtns = [...document.querySelectorAll('#optQuality button')];
const st = {
  grid: store.get('grid', 'thirds'),
  variants: store.get('variants', {}),
  aspect: store.get('aspect', '3:4'),
  facing: store.get('facing', 'environment'),
  level: store.get('level', false),
  timer: store.get('timer', 0),
  burn: store.get('burn', false),
  tips: store.get('tips', true),
  opacity: store.get('opacity', 85),
  invert: store.get('invert', false),
  quality: store.get('quality', 'std') === 'max' ? 'max' : 'std',
  target: store.get('target', [2 / 3, 1 / 3]),
  roll: 0, hasRoll: false, flat: false,
  mode: 'camera', reviewBlob: null,
  shots: [], busy: false,
};
if (!GRIDS[st.grid]) st.grid = 'thirds';
if (!ASPECTS.includes(st.aspect)) st.aspect = '3:4';

const variantOf = (id) => (st.variants[id] || 0) % (GRIDS[id].variants || 1);

/* ---------- тост ---------- */
let toastTimer;
function toast(text, action, onAction, ms = 2600) {
  els.toastText.textContent = text;
  els.toastAct.hidden = !action;
  if (action) { els.toastAct.textContent = action; els.toastAct.onclick = () => { hideToast(); onAction(); }; }
  els.toast.classList.add('open');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? Math.max(ms, 4200) : ms);
}
function hideToast() { els.toast.classList.remove('open'); }

/* ---------- раскладка кадра ---------- */
function frameAspect() {
  if (st.mode === 'review' && els.still.naturalWidth) return els.still.naturalWidth / els.still.naturalHeight;
  const [a, b] = st.aspect.split(':').map(Number);
  const portrait = a / b;
  return innerWidth > innerHeight ? 1 / portrait : portrait;
}

function layout() {
  const cs = getComputedStyle(els.stage);
  const sw = els.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const sh = els.stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const a = frameAspect();
  let fw = Math.min(sw, sh * a), fh = fw / a;
  if (fh > sh) { fh = sh; fw = fh * a; }
  els.frame.style.width = Math.floor(fw) + 'px';
  els.frame.style.height = Math.floor(fh) + 'px';
  renderOverlay();
}

function targetPx(w, h) { return [st.target[0] * w, st.target[1] * h]; }

function renderOverlay() {
  const w = els.frame.clientWidth, h = els.frame.clientHeight;
  if (!w || !h) return;
  els.overlay.setAttribute('viewBox', `0 0 ${w} ${h}`);
  els.overlay.innerHTML = withHalo(drawGrid(st.grid, w, h, variantOf(st.grid), {
    roll: st.roll, hasRoll: st.hasRoll && !st.flat, target: targetPx(w, h),
  }));
}

/* ---------- лента сеток ---------- */
function glyph(id) {
  const w = 30, h = 40;
  return `<svg class="glyph" viewBox="-1 -1 ${w + 2} ${h + 2}" aria-hidden="true"><rect class="frm" x="0" y="0" width="${w}" height="${h}" rx="1.5"/>` +
    drawGrid(id, w, h, variantOf(id), { pr: 1.3, fs: 4, target: [w * 2 / 3, h / 3] }) + '</svg>';
}

function buildCarousel() {
  els.carousel.innerHTML = GROUPS.map((g) => `
    <div class="grp"><span class="grp-n">${g.name}</span><div class="tiles">
      ${g.ids.map((id) => `<button class="tile" role="option" data-id="${id}" aria-label="${GRIDS[id].name}" aria-selected="${id === st.grid}">
        <span class="glass">${glyph(id)}</span><span>${GRIDS[id].short}</span></button>`).join('')}
    </div></div>`).join('');
}

function refreshTile(id) {
  const t = els.carousel.querySelector(`[data-id="${id}"] .glass`);
  if (t) t.innerHTML = glyph(id);
}

function markSelected(scroll = true) {
  els.carousel.querySelectorAll('.tile').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.id === st.grid)));
  if (scroll) {
    const t = els.carousel.querySelector(`[data-id="${st.grid}"]`);
    t?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}

function renderNamebar() {
  const g = GRIDS[st.grid];
  els.gridName.textContent = g.name;
  els.gridName.classList.toggle('long', g.name.length > 15);
  const n = g.variants || 1, v = variantOf(st.grid);
  els.dots.textContent = n > 1 ? `${v + 1}/${n}` : '';
  els.help.hidden = st.grid === 'none' || els.card.classList.contains('open');
}

function selectGrid(id) {
  if (id === st.grid) {
    const n = GRIDS[id].variants || 1;
    if (n > 1) {
      st.variants[id] = (variantOf(id) + 1) % n;
      store.set('variants', st.variants);
      refreshTile(id);
      renderOverlay(); renderNamebar();
      if (els.card.classList.contains('open')) fillCard();
    } else if (id !== 'none') {
      toggleCard();
    }
    return;
  }
  st.grid = id; store.set('grid', id);
  markSelected(); renderOverlay();
  if (id === 'none') closeCard();
  else if (st.tips) openCard();
  else closeCard();
  renderNamebar();
  if (id === 'dutch' && !st.level) toast('Для наклона включи уровень вверху', 'Включить', () => setLevel(true));
}

/* ---------- карточка-подсказка ---------- */
// Свои примеры: положи examples/<id>.jpg и впиши id в examples/index.json.
let ownExamples = new Set();
fetch('examples/index.json').then((r) => (r.ok ? r.json() : [])).then((ids) => {
  ownExamples = new Set(Array.isArray(ids) ? ids : []);
  if (els.card.classList.contains('open')) fillCard();
}).catch(() => {});

function fillCard() {
  const id = st.grid, g = GRIDS[id], v = variantOf(id);
  const n = g.variants || 1;
  els.cardTitle.textContent = g.name;
  els.cardWhere.textContent = g.where || '';
  els.cardWhen.textContent = g.when || '';
  els.cardWarn.textContent = [g.warn, g.note].filter(Boolean).join(' ');
  els.cardVar.textContent = n > 1 ? `${v + 1} из ${n}. ${g.varHint || 'Тап по иконке ещё раз — следующий вариант.'}` : '';
  // Пример: своя картинка examples/<id>.jpg, если есть; иначе схема-иллюстрация.
  els.cardEx.innerHTML =
    `<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice">${drawScene(id, v)}</svg>` +
    (ownExamples.has(id) ? `<img src="examples/${id}.jpg" alt="" onerror="this.remove()">` : '') +
    `<svg class="exgrid" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice">${withHalo(drawGrid(id, 300, 400, v, { pr: 8, fs: 20, target: [200, 133], roll: 0 }))}</svg>`;
}
function openCard() { fillCard(); els.card.classList.add('open'); renderNamebar(); }
function closeCard() { els.card.classList.remove('open'); renderNamebar(); }
function toggleCard() { els.card.classList.contains('open') ? closeCard() : openCard(); }

/* ---------- камера ---------- */
let stream = null, track = null, imageCapture = null, starting = false;

function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null; track = null; imageCapture = null;
}

async function startCamera() {
  if (starting || st.mode !== 'camera') return;
  starting = true;
  stopCamera();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no api'), { name: 'NoApi' });
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      // «Плавно» — 1920×1440: iPhone тянет без лагов. «Максимум» — 4032×3024: резче, но тяжелее.
      video: st.quality === 'max'
        ? { facingMode: { ideal: st.facing }, width: { ideal: 4032 }, height: { ideal: 3024 }, frameRate: { ideal: 30, max: 30 } }
        : { facingMode: { ideal: st.facing }, width: { ideal: 1920 }, height: { ideal: 1440 }, frameRate: { ideal: 30, max: 30 } },
    });
    track = stream.getVideoTracks()[0];
    els.video.srcObject = stream;
    await els.video.play().catch(() => {});
    els.empty.hidden = true;
    els.shutter.disabled = false;
    els.frame.classList.toggle('mirror', st.facing === 'user');
    imageCapture = 'ImageCapture' in window ? new window.ImageCapture(track) : null;
    setupZoom();
    const s = track.getSettings?.() || {};
    els.resInfo.textContent = s.width ? `Камера сейчас отдаёт ${s.width}×${s.height}. Снимок — центр этого кадра в выбранном формате.` : '';
  } catch (e) {
    showEmpty(e);
  } finally {
    starting = false;
  }
}

function showEmpty(e) {
  els.empty.hidden = false;
  els.shutter.disabled = true;
  const name = e?.name;
  if (name === 'NotAllowedError') {
    els.emptyTitle.textContent = 'Нет доступа к камере';
    els.emptyText.textContent = 'Разреши камеру для этого сайта: «Настройки» → Safari → «Камера» → «Разрешить». Потом нажми кнопку ниже.';
  } else if (name === 'NoApi' || !window.isSecureContext) {
    els.emptyTitle.textContent = 'Камера не открывается';
    els.emptyText.textContent = 'Камера работает только по защищённой ссылке (https). Сетки и разбор готовых фото работают и так.';
  } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    els.emptyTitle.textContent = 'Камера не найдена';
    els.emptyText.textContent = 'На этом устройстве нет камеры. Можно разобрать готовое фото.';
  } else {
    els.emptyTitle.textContent = 'Камера занята или выключена';
    els.emptyText.textContent = 'Закрой другие приложения с камерой и попробуй снова.';
  }
}

function setupZoom() {
  els.zoom.hidden = true;
  const caps = track?.getCapabilities?.();
  if (!caps?.zoom || caps.zoom.max <= caps.zoom.min) return;
  const { min, max } = caps.zoom;
  const steps = [min, 1, 2, 3, 5].filter((z, i, a) => z >= min && z <= max && a.indexOf(z) === i);
  if (steps.length < 2) return;
  const cur = track.getSettings().zoom || 1;
  els.zoom.innerHTML = steps.map((z) => `<button data-z="${z}" class="${Math.abs(z - cur) < 0.05 ? 'on' : ''}">${String(+z.toFixed(1)).replace('.', ',')}×</button>`).join('');
  els.zoom.hidden = false;
}
els.zoom.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b || !track) return;
  try {
    await track.applyConstraints({ advanced: [{ zoom: Number(b.dataset.z) }] });
    els.zoom.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  } catch { toast('Эта камера не меняет зум'); }
});

/* ---------- съёмка ---------- */
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function countdown(sec) {
  els.count.hidden = false;
  for (let i = sec; i > 0; i--) { els.count.textContent = i; await wait(1000); }
  els.count.hidden = true;
}

function flash() {
  els.flash.classList.remove('go'); void els.flash.offsetWidth; els.flash.classList.add('go');
}

// Сетка поверх кадра: тёмная подложка снизу, светлая линия сверху.
const withHalo = (s) => `<g class="halo">${s}</g>${s}`;

async function gridImage(W, H) {
  const k = Math.min(W, H) / 360;
  const css = `.m{fill:none;stroke:#F2F2EF;stroke-width:${1.2 * k};stroke-linecap:round;stroke-linejoin:round}
    .s{fill:none;stroke:#F2F2EF;stroke-width:${k};stroke-dasharray:${4 * k} ${5 * k};opacity:.75}
    .pt{fill:#F2F2EF}.shade{fill:rgba(5,5,5,.35)}.acc{stroke:#EC3A32;stroke-width:${1.6 * k}}.ok{stroke:#9ED38F}
    .lbl{display:none}
    .halo .m,.halo .s,.halo .acc,.halo .ok{stroke:rgba(0,0,0,.3);stroke-width:${3 * k};stroke-dasharray:none;opacity:1}
    .halo .pt{fill:rgba(0,0,0,.3)}.halo .shade{display:none}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>${css}</style>` +
    withHalo(drawGrid(st.grid, W, H, variantOf(st.grid), { pr: Math.max(3, Math.min(W, H) * 0.012), fs: Math.min(W, H) * 0.03, roll: st.roll, hasRoll: st.hasRoll, target: targetPx(W, H) })) + '</svg>';
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

async function grabSource() {
  // Android Chrome умеет делать настоящее фото с полным разрешением.
  if (imageCapture && st.facing === 'environment') {
    try {
      const blob = await imageCapture.takePhoto();
      const bmp = await createImageBitmap(blob);
      const vw = els.video.videoWidth, vh = els.video.videoHeight;
      if ((bmp.width > bmp.height) === (vw > vh)) return { src: bmp, sw: bmp.width, sh: bmp.height };
      bmp.close?.();
    } catch { /* берём кадр из видео */ }
  }
  await freshFrame();
  return { src: els.video, sw: els.video.videoWidth, sh: els.video.videoHeight };
}

// Ждём свежий кадр видео: на iPhone кадр, взятый «между» кадрами, бывает чёрным.
function freshFrame() {
  const v = els.video;
  return new Promise((res) => {
    const done = () => res();
    if (v.requestVideoFrameCallback) { v.requestVideoFrameCallback(done); setTimeout(done, 250); }
    else requestAnimationFrame(() => requestAnimationFrame(done));
  });
}

// Кадр почти целиком чёрный? Смотрим уменьшенную копию 16×16.
function isBlack(canvas) {
  const t = document.createElement('canvas');
  t.width = 16; t.height = 16;
  const g = t.getContext('2d', { willReadFrequently: true });
  g.drawImage(canvas, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
  t.width = t.height = 0;
  return sum / (d.length / 4) < 6;
}

// Освобождаем память холста сразу: iPhone держит мало памяти на холсты, и после пары снимков они чернеют.
const freeCanvas = (c) => { c.width = 0; c.height = 0; };

function toBlob(c, q) { return new Promise((r) => c.toBlob(r, 'image/jpeg', q)); }

async function makeThumb(c) {
  const k = 360 / Math.max(c.width, c.height);
  const t = document.createElement('canvas');
  t.width = Math.max(1, Math.round(c.width * k)); t.height = Math.max(1, Math.round(c.height * k));
  t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
  const b = await toBlob(t, 0.8);
  freeCanvas(t);
  return b;
}

async function capture() {
  if (st.busy || st.mode !== 'camera' || !track) return;
  st.busy = true; els.shutter.disabled = true;
  let c;
  try {
    if (st.timer) await countdown(st.timer);
    const a = els.frame.clientWidth / els.frame.clientHeight;
    c = document.createElement('canvas');
    for (let attempt = 0; attempt < 3; attempt++) {
      const { src, sw, sh } = await grabSource();
      if (!sw || !sh) { await wait(120); continue; }
      let cw = sw, ch = sw / a;
      if (ch > sh) { ch = sh; cw = sh * a; }
      c.width = Math.round(cw); c.height = Math.round(ch);
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (st.facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1); }
      g.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, c.width, c.height);
      g.setTransform(1, 0, 0, 1, 0, 0);
      src.close?.();
      if (!isBlack(c)) break;
      if (attempt === 2) throw Object.assign(new Error('black'), { black: true });
      await wait(150);
    }
    flash();
    if (st.burn && st.grid !== 'none') c.getContext('2d').drawImage(await gridImage(c.width, c.height), 0, 0);
    const blob = await toBlob(c, 0.94);
    if (!blob) throw Object.assign(new Error('black'), { black: true });
    const thumb = await makeThumb(c);
    const w = c.width, h = c.height;
    const shot = await addShot(blob, w, h, thumb);
    toast(`Снято, ${w}×${h}`, 'Сохранить', () => saveBlob(shot.blob, shot.id));
  } catch (e) {
    if (e?.black && st.quality === 'max') toast('Камера отдала пустой кадр. Поставь в «Ещё» качество «Плавно».', 'Поставить', () => setQuality('std'), 6000);
    else if (e?.black) toast('Камера отдала пустой кадр. Подожди секунду и сними ещё раз.');
    else toast('Не получилось снять. Попробуй ещё раз.');
  } finally {
    if (c) freeCanvas(c);
    st.busy = false; els.shutter.disabled = !track;
  }
}

/* ---------- хранение снимков (IndexedDB — память браузера) ---------- */
const db = (() => {
  let p;
  const open = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open('kadr', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('shots', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction('shots', mode);
      const req = fn(t.objectStore('shots'));
      t.oncomplete = () => res(req?.result);
      t.onerror = () => rej(t.error);
    });
  };
  return {
    put: (o) => run('readwrite', (s) => s.put(o)),
    all: () => run('readonly', (s) => s.getAll()),
    del: (id) => run('readwrite', (s) => s.delete(id)),
  };
})();

async function addShot(blob, w, h, thumb) {
  const shot = { id: Date.now(), blob, thumb, w, h, grid: st.grid };
  st.shots.unshift(shot);
  try { await db.put(shot); } catch { /* останется до перезагрузки */ }
  updateThumb();
  return shot;
}

let thumbUrl;
function updateThumb() {
  if (thumbUrl) URL.revokeObjectURL(thumbUrl);
  const s = st.shots[0];
  if (!s) { els.thumbImg.hidden = true; return; }
  thumbUrl = URL.createObjectURL(s.thumb || s.blob);
  els.thumbImg.src = thumbUrl; els.thumbImg.hidden = false;
}

async function loadShots() {
  try { st.shots = (await db.all()).sort((a, b) => b.id - a.id); } catch { st.shots = []; }
  updateThumb();
}

async function saveBlob(blob, id) {
  const name = `kadr-${id || Date.now()}.jpg`;
  const file = new File([blob], name, { type: 'image/jpeg' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- снимки: экран ---------- */
let galleryUrls = [];
function openGallery() {
  galleryUrls.forEach(URL.revokeObjectURL);
  galleryUrls = st.shots.map((s) => URL.createObjectURL(s.thumb || s.blob));
  els.gGrid.innerHTML = st.shots.map((s, i) => `<button data-i="${i}" aria-label="Снимок ${i + 1}"><img src="${galleryUrls[i]}" alt=""></button>`).join('');
  els.gEmpty.hidden = st.shots.length > 0;
  els.gallery.hidden = false;
}
function closeGallery() { els.gallery.hidden = true; }

let viewing = null, viewUrl = null;
els.gGrid.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const i = Number(b.dataset.i);
  viewing = st.shots[i];
  if (viewUrl) URL.revokeObjectURL(viewUrl);
  viewUrl = URL.createObjectURL(viewing.blob);
  els.viewImg.src = viewUrl;
  els.viewer.hidden = false;
});
$('#vClose').onclick = () => { els.viewer.hidden = true; };
$('#vSave').onclick = () => viewing && saveBlob(viewing.blob, viewing.id);
$('#vDelete').onclick = async () => {
  if (!viewing) return;
  if (!confirm('Удалить снимок из приложения? Копии в «Фото» останутся.')) return;
  try { await db.del(viewing.id); } catch {}
  st.shots = st.shots.filter((s) => s !== viewing);
  viewing = null; els.viewer.hidden = true;
  updateThumb(); openGallery();
};
$('#vReview').onclick = () => {
  if (!viewing) return;
  const b = viewing.blob;
  els.viewer.hidden = true; closeGallery();
  enterReview(b);
};

/* ---------- разбор готового фото ---------- */
let reviewUrl;
async function enterReview(blob) {
  st.mode = 'review'; st.reviewBlob = blob;
  stopCamera();
  if (reviewUrl) URL.revokeObjectURL(reviewUrl);
  reviewUrl = URL.createObjectURL(blob);
  els.still.hidden = false; els.video.hidden = true; els.empty.hidden = true;
  await new Promise((res) => {
    els.still.onload = els.still.onerror = res;
    els.still.src = reviewUrl;
    if (els.still.complete && els.still.naturalWidth) res();
  });
  if (st.mode !== 'review') return; // успели вернуться к камере
  els.frame.classList.add('review'); els.frame.classList.remove('mirror');
  els.reviewBar.hidden = false;
  els.shutter.disabled = true; els.aspect.disabled = true; $('#btnFlip').disabled = true;
  els.zoom.hidden = true;
  closeCard();
  layout();
}
function exitReview() {
  st.mode = 'camera'; st.reviewBlob = null;
  els.still.hidden = true; els.video.hidden = false;
  els.frame.classList.remove('review');
  els.reviewBar.hidden = true;
  els.aspect.disabled = false; $('#btnFlip').disabled = false;
  layout();
  startCamera();
}
async function saveReview() {
  const img = els.still;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  if (st.grid !== 'none') g.drawImage(await gridImage(c.width, c.height), 0, 0);
  const blob = await toBlob(c, 0.93);
  freeCanvas(c);
  if (blob) saveBlob(blob); else toast('Фото слишком большое для сохранения с сеткой.');
}
els.fileIn.addEventListener('change', () => {
  const f = els.fileIn.files?.[0];
  els.fileIn.value = '';
  if (f) { els.settings.hidden = true; enterReview(f); }
});
const pickFile = () => els.fileIn.click();

// Штатная камера iPhone: полное качество, потом фото открывается здесь с сеткой.
const nativeIn = $('#nativeIn');
nativeIn.addEventListener('change', () => {
  const f = nativeIn.files?.[0];
  nativeIn.value = '';
  if (f) { els.settings.hidden = true; enterReview(f); addShotFromFile(f); }
});
const pickNative = () => nativeIn.click();

async function addShotFromFile(f) {
  try {
    const bmp = await createImageBitmap(f);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close?.();
    const thumb = await makeThumb(c);
    const w = c.width, h = c.height;
    freeCanvas(c);
    await addShot(f, w, h, thumb);
  } catch { /* фото всё равно открыто для разбора */ }
}

/* ---------- уровень горизонта ---------- */
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let gotMotion = false, rafPending = false, listening = false;

function screenAngle() {
  const a = screen.orientation?.angle;
  if (typeof a === 'number') return a;
  return typeof window.orientation === 'number' ? window.orientation : 0;
}

function onMotion(e) {
  const g = e.accelerationIncludingGravity;
  if (!g || g.x == null) return;
  gotMotion = true;
  // Приводим к направлению силы тяжести в осях телефона (x вправо, y вверх).
  let x = g.x, y = g.y;
  if (!IOS) { x = -x; y = -y; }
  if (st.invert) x = -x;
  const mag = Math.hypot(x, y);
  st.flat = mag < 3; // телефон лежит — уровень не считаем
  if (st.flat) { schedulePaint(); return; }
  const deviceRoll = (Math.atan2(x, -y) * 180) / Math.PI;
  let r = deviceRoll + screenAngle();
  r = ((r + 540) % 360) - 180;
  if (!st.hasRoll) st.roll = r;
  let d = r - st.roll;
  d = ((d + 540) % 360) - 180;
  st.roll += d * 0.22;
  st.hasRoll = true;
  schedulePaint();
}

function schedulePaint() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    paintLevel();
    if (GRIDS[st.grid].live) renderOverlay();
  });
}

function paintLevel() {
  const show = st.level && st.hasRoll;
  els.level.hidden = !show;
  if (!show) return;
  const r = st.roll;
  els.level.querySelector('i').style.transform = `rotate(${-r}deg)`;
  els.level.classList.toggle('ok', !st.flat && Math.abs(r) < 0.6);
  els.level.classList.toggle('flat', st.flat);
  els.levelVal.textContent = st.flat ? 'держи вертикально' : `${Math.abs(r).toFixed(1).replace('.', ',')}°`;
}

async function enableMotion() {
  if (listening) return true;
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const res = await DeviceMotionEvent.requestPermission();
      if (res !== 'granted') { toast('Без доступа к датчику движения уровня не будет'); return false; }
    }
  } catch { /* разрешение спрашивают только по нажатию */ return false; }
  window.addEventListener('devicemotion', onMotion);
  listening = true;
  setTimeout(() => { if (!gotMotion && st.level) toast('Датчик наклона не отвечает. На компьютере уровня нет.'); }, 1600);
  return true;
}

async function setLevel(on) {
  if (on && !(await enableMotion())) on = false;
  st.level = on; store.set('level', on);
  els.levelBtn.classList.toggle('on', on);
  els.levelBtn.setAttribute('aria-pressed', String(on));
  paintLevel();
  if (GRIDS[st.grid].live) renderOverlay();
}

/* ---------- ведущие линии: перетаскивание точки ---------- */
let dragId = null, downAt = null;
els.frame.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  downAt = [e.clientX, e.clientY];
  if (st.grid === 'leading' && dragId == null) {
    dragId = e.pointerId;
    els.frame.setPointerCapture(e.pointerId);
    moveTarget(e);
  }
});
els.frame.addEventListener('pointermove', (e) => { if (e.pointerId === dragId) moveTarget(e); });
const endDrag = (e) => {
  if (e.pointerId === dragId) { dragId = null; store.set('target', st.target); return; }
  // Короткий тап по кадру прячет подсказку.
  if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 8 && els.card.classList.contains('open')) closeCard();
  downAt = null;
};
els.frame.addEventListener('pointerup', endDrag);
els.frame.addEventListener('pointercancel', (e) => { if (e.pointerId === dragId) dragId = null; });
function moveTarget(e) {
  const r = els.frame.getBoundingClientRect();
  st.target = [Math.min(0.97, Math.max(0.03, (e.clientX - r.left) / r.width)), Math.min(0.97, Math.max(0.03, (e.clientY - r.top) / r.height))];
  renderOverlay();
}

/* ---------- кнопки ---------- */
function renderTop() {
  els.aspect.textContent = st.aspect;
  els.timerVal.textContent = st.timer ? ` ${st.timer} с` : '';
  qualityBtns.forEach((b) => b.classList.toggle('on', b.dataset.q === st.quality));
  els.timer.classList.toggle('on', !!st.timer);
  els.levelBtn.classList.toggle('on', st.level);
  document.documentElement.style.setProperty('--gop', String(st.opacity / 100));
}

els.carousel.addEventListener('click', (e) => {
  const t = e.target.closest('.tile'); if (t) selectGrid(t.dataset.id);
});
$('#namebar').onclick = () => { if (st.grid !== 'none') toggleCard(); };
els.help.onclick = openCard;
$('#cardX').onclick = closeCard;

els.aspect.onclick = () => {
  st.aspect = ASPECTS[(ASPECTS.indexOf(st.aspect) + 1) % ASPECTS.length];
  store.set('aspect', st.aspect); renderTop(); layout();
};
els.levelBtn.onclick = () => setLevel(!st.level);
els.timer.onclick = () => {
  st.timer = st.timer === 0 ? 3 : st.timer === 3 ? 10 : 0;
  store.set('timer', st.timer); renderTop();
};
els.shutter.onclick = capture;
$('#btnFlip').onclick = () => {
  st.facing = st.facing === 'environment' ? 'user' : 'environment';
  store.set('facing', st.facing); startCamera();
};
$('#btnGallery').onclick = openGallery;
$('#galleryClose').onclick = closeGallery;
$('#btnRetry').onclick = startCamera;
$('#btnOpenFile').onclick = pickFile;
$('#btnOpenFile2').onclick = pickFile;
$('#btnNative').onclick = pickNative;
$('#btnNative2').onclick = pickNative;
function setQuality(q) {
  if (st.quality === q) return;
  st.quality = q; store.set('quality', q); renderTop();
  if (st.mode === 'camera') startCamera();
}
qualityBtns.forEach((b) => { b.onclick = () => setQuality(b.dataset.q); });
$('#btnBack').onclick = exitReview;
$('#btnSaveReview').onclick = saveReview;

// Настройки
const optBurn = $('#optBurn'), optTips = $('#optTips'), optOpacity = $('#optOpacity'), optInvert = $('#optInvert');
$('#btnMore').onclick = () => {
  optBurn.checked = st.burn; optTips.checked = st.tips; optOpacity.value = st.opacity; optInvert.checked = st.invert;
  els.settings.hidden = false;
};
els.settings.addEventListener('click', (e) => { if (e.target === els.settings) els.settings.hidden = true; });
optBurn.onchange = () => { st.burn = optBurn.checked; store.set('burn', st.burn); };
optTips.onchange = () => { st.tips = optTips.checked; store.set('tips', st.tips); };
optInvert.onchange = () => { st.invert = optInvert.checked; store.set('invert', st.invert); };
optOpacity.oninput = () => { st.opacity = Number(optOpacity.value); store.set('opacity', st.opacity); renderTop(); };

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!els.viewer.hidden) els.viewer.hidden = true;
    else if (!els.gallery.hidden) closeGallery();
    else if (!els.settings.hidden) els.settings.hidden = true;
    else closeCard();
  }
});

// Экономим батарею: камера выключается, когда приложение свёрнуто.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopCamera();
  else if (st.mode === 'camera') startCamera();
});

let resizeT;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(layout, 60); });
screen.orientation?.addEventListener?.('change', () => setTimeout(layout, 120));

/* ---------- старт ---------- */
buildCarousel();
renderTop();
renderNamebar();
layout();
requestAnimationFrame(() => markSelected(true));
loadShots();
startCamera();
if (st.level) {
  // На iPhone разрешение на датчик дают только по нажатию — восстановим по первому тапу.
  if (IOS && typeof window.DeviceMotionEvent?.requestPermission === 'function') {
    st.level = false; renderTop();
    addEventListener('pointerup', (e) => { if (!e.target.closest?.('#btnLevel')) setLevel(true); }, { once: true });
  } else setLevel(true);
}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
