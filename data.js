/* =========================================================================
   Mock data + synthetic board generator.
   Everything is seeded so the board & every climb look identical on reload.
   Later this whole file gets replaced by the real board layout + API.
   ========================================================================= */
(function () {
  // deterministic PRNG
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // organic pebble path centred on (0,0)
  function blobPath(rng, r) {
    const pts = 8 + Math.floor(rng() * 3);
    const coords = [];
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const rr = r * (0.72 + rng() * 0.5);
      coords.push([Math.cos(a) * rr, Math.sin(a) * rr * (0.82 + rng() * 0.3)]);
    }
    // catmull-rom -> smooth closed path
    let d = `M ${coords[0][0].toFixed(1)} ${coords[0][1].toFixed(1)} `;
    for (let i = 0; i < coords.length; i++) {
      const p0 = coords[(i - 1 + coords.length) % coords.length];
      const p1 = coords[i];
      const p2 = coords[(i + 1) % coords.length];
      const p3 = coords[(i + 2) % coords.length];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `;
    }
    return d + 'Z';
  }

  function generateBoard() {
    const cols = 16, rows = 18;
    const W = 1000, H = 1120;
    const padX = 30, padY = 30;
    const cellW = (W - padX * 2) / (cols - 1);
    const cellH = (H - padY * 2) / (rows - 1);
    const rng = mulberry32(13731);
    const holds = [];
    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const jx = (rng() - 0.5) * cellW * 0.5;
        const jy = (rng() - 0.5) * cellH * 0.5;
        const cx = padX + c * cellW + jx;
        const cy = padY + r * cellH + jy;
        const size = cellW * (0.30 + rng() * 0.22);
        holds.push({
          id, col: c, row: r, cx, cy, r: size,
          rot: rng() * 360,
          path: blobPath(rng, size),
        });
        id++;
      }
    }
    return { cols, rows, W, H, holds };
  }

  const BOARD = generateBoard();

  // pick a plausible, distinct route for a climb
  function selectHolds(seed) {
    const rng = mulberry32(seed);
    const { cols, rows, holds } = BOARD;
    const used = new Set();
    const out = [];
    const center = 3 + Math.floor(rng() * (cols - 6));   // corridor centre
    const spread = 3 + Math.floor(rng() * 3);

    const pickInBand = (rLo, rHi, cLo, cHi) => {
      const pool = holds.filter(h =>
        h.row >= rLo && h.row <= rHi &&
        h.col >= cLo && h.col <= cHi && !used.has(h.id));
      if (!pool.length) return null;
      const h = pool[Math.floor(rng() * pool.length)];
      used.add(h.id);
      return h.id;
    };
    const band = () => [Math.max(0, center - spread), Math.min(cols - 1, center + spread)];

    // finish (1, sometimes 2) near the top
    const [cl, cr] = band();
    const f1 = pickInBand(0, 1, cl, cr); if (f1 != null) out.push({ h: f1, role: 'finish' });
    if (rng() > 0.6) { const f2 = pickInBand(0, 1, cl, cr); if (f2 != null) out.push({ h: f2, role: 'finish' }); }

    // hands forming a meandering line down the middle
    const handCount = 4 + Math.floor(rng() * 3);
    const top = 2, bottom = rows - 6;
    for (let i = 0; i < handCount; i++) {
      const rowFrac = i / (handCount - 1);
      const rr = Math.round(top + rowFrac * (bottom - top));
      const wob = Math.round((rng() - 0.5) * 3);
      const h = pickInBand(rr, rr + 1, Math.max(0, center + wob - 2), Math.min(cols - 1, center + wob + 2));
      if (h != null) out.push({ h, role: 'hand' });
    }

    // feet lower down
    const footCount = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < footCount; i++) {
      const h = pickInBand(rows - 6, rows - 3, cl, cr);
      if (h != null) out.push({ h, role: 'foot' });
    }

    // start (1-2) at the bottom
    const startCount = 1 + (rng() > 0.55 ? 1 : 0);
    for (let i = 0; i < startCount; i++) {
      const h = pickInBand(rows - 2, rows - 1, cl, cr);
      if (h != null) out.push({ h, role: 'start' });
    }
    return out;
  }

  const RAW = [
    ['Lament of the Steep', 'Cuckovich', 'paulrobinson', 30285, '6b', 'V4', 3],
    ['Lack of Faith', 'KilterStudio', 'Cuckovich', 29334, '6c', 'V5', 3],
    ['Boot Spur', 's14rob', 'Cuckovich', 25118, '6b+', 'V4', 3],
    ['Jug Skin', 'KilterStudio', null, 23472, '6b', 'V4', 3],
    ['Priest Drawn', 'griffinwhiteside', 'smurf', 22422, '6c', 'V5', 3],
    ['Scared em Off', 'KilterStudio', null, 22152, '6b+', 'V4', 3],
    ['Kilter Board Koncussion', 'nickwedge', null, 20651, '7a', 'V6', 3],
    ['Neon Indoor Dropknee', 'kilterjackie', 'Cuckovich', 19225, '7a', 'V6', 3],
    ['Drawing the Priest', 'griffinwhiteside', null, 18540, '7a', 'V6', 3],
    ['Chalk Whisper', 'Cuckovich', null, 17890, '6a', 'V3', 2],
    ['The Long Reach', 's14rob', 'paulrobinson', 16004, '7b', 'V8', 3],
    ['Quiet Crimps', 'griffinwhiteside', null, 14233, '6c+', 'V5', 2],
    ['Slab Confessional', 'KilterStudio', null, 12876, '5+', 'V2', 3],
    ['Overhang Sermon', 'nickwedge', 'Cuckovich', 11990, '7c', 'V9', 3],
    ['Heel Hook Hymn', 'kilterjackie', null, 10544, '6b+', 'V4', 2],
    ['Pinch the Dawn', 'paulrobinson', null, 9821, '7a+', 'V7', 3],
    ['First Light Traverse', 'Cuckovich', null, 8233, '6a+', 'V3', 2],
    ['Static Prayer', 's14rob', 'smurf', 7110, '6c', 'V5', 3],
  ];

  // numeric difficulty (for sorting / filtering by V-grade)
  const vNum = v => parseInt(v.replace(/[^0-9]/g, ''), 10);

  const CLIMBS = RAW.map((r, i) => ({
    id: i,
    idx: i + 79,                // matches the little "79" badge in the screenshot
    name: r[0],
    setter: r[1],
    fa: r[2],
    ascents: r[3],
    font: r[4],
    v: r[5],
    vNum: vNum(r[5]),
    stars: r[6],
    holds: selectHolds(1000 + i * 7),
    saved: false,
    logged: false,
  }));

  // ---- profile mock: logbook (sessions), folders, notifications ----------
  const GRADE_SCALE = ['6a', '6a+', '6b', '6b+', '6c', '6c+', '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a'];
  const LB_NAMES = CLIMBS.map(c => c.name).concat([
    'Crimp Theory', 'Slopey Sunday', 'Dyno Dreams', 'Pocket Rocket', 'Sloper Sermon',
    'Toe Hook Tango', 'Mantle Mantra', 'Gaston Gospel', 'Compression Confession', 'Heel Hook Haiku',
  ]);
  const dateKeyOf = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  const lbRng = mulberry32(20260524);
  const TODAY = new Date(2026, 4, 24); // 2026-05-24
  const LOGBOOK = [];
  let lid = 0, dayBack = 0;
  for (let s = 0; s < 11; s++) {
    dayBack += 1 + Math.floor(lbRng() * 9);
    const d = new Date(TODAY); d.setDate(d.getDate() - dayBack);
    const key = dateKeyOf(d);
    const n = 2 + Math.floor(lbRng() * 5);
    for (let i = 0; i < n; i++) {
      let gi = Math.round(3 + lbRng() * 6 + (lbRng() - 0.5) * 3);
      gi = Math.max(0, Math.min(GRADE_SCALE.length - 1, gi));
      const attempts = lbRng() < 0.28 ? 1 : 1 + Math.floor(lbRng() * 7);
      LOGBOOK.push({
        id: lid++, name: LB_NAMES[Math.floor(lbRng() * LB_NAMES.length)],
        font: GRADE_SCALE[gi], gi, dateKey: key,
        ts: d.getTime() + i * 11 * 60000, // earlier i = earlier in the day
        attempts, flash: attempts === 1,
      });
    }
  }

  const GRADE_COUNTS = GRADE_SCALE.map((g, i) => LOGBOOK.filter(e => e.gi === i).length);

  const mkFolderClimbs = (seed, k) => {
    const r = mulberry32(seed); const out = [];
    for (let i = 0; i < k; i++) { const gi = Math.floor(r() * GRADE_SCALE.length); out.push({ name: LB_NAMES[Math.floor(r() * LB_NAMES.length)], font: GRADE_SCALE[gi], gi }); }
    return out;
  };
  const FOLDERS = [
    { name: 'Проекты', public: false, climbs: mkFolderClimbs(11, 5) },
    { name: 'Любимое', public: true, climbs: mkFolderClimbs(22, 8) },
    { name: 'Цели 7A+', public: true, climbs: mkFolderClimbs(33, 6) },
    { name: 'Разминка', public: true, climbs: mkFolderClimbs(44, 7) },
    { name: 'Чердак', public: false, climbs: mkFolderClimbs(55, 3) },
  ];

  const NOTIFICATIONS = [
    { kind: 'like', who: 'paulrobinson', text: 'оценил твой пролаз «Lament of the Steep»', when: '2 ч' },
    { kind: 'comment', who: 'Cuckovich', text: 'прокомментировал «Boot Spur»: «сильно!»', when: '5 ч' },
    { kind: 'follow', who: 'kilterjackie', text: 'подписался на тебя', when: '8 ч' },
    { kind: 'route', who: 'nickwedge', text: 'поставил новую трассу 7A «Crimp Theory»', when: 'вчера' },
    { kind: 'like', who: 'griffinwhiteside', text: 'и ещё 4 оценили «Jug Skin»', when: 'вчера' },
    { kind: 'follow', who: 's14rob', text: 'подписался на тебя', when: '2 дн' },
    { kind: 'system', who: '37 Board', text: 'Доступна новая прошивка панели подсветки', when: '3 дн' },
  ];

  window.GRADE_SCALE = GRADE_SCALE;
  window.LOGBOOK = LOGBOOK;
  window.GRADE_COUNTS = GRADE_COUNTS;
  window.FOLDERS = FOLDERS;
  window.NOTIFICATIONS = NOTIFICATIONS;

  window.BOARD = BOARD;
  window.CLIMBS = CLIMBS;
  window.ANGLES = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
  window.ROLE_META = {
    start:  { label: 'Старт',  color: 'var(--start)' },
    hand:   { label: 'Зацепы', color: 'var(--hand)' },
    foot:   { label: 'Ноги',   color: 'var(--foot)' },
    finish: { label: 'Топ',    color: 'var(--finish)' },
  };
})();
