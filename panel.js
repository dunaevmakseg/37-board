/* =========================================================================
   37 BOARD — Theme Studio (live colour / font / texture playground)
   Drives the app's CSS variables; Tailwind utilities read the same vars, so
   one change repaints everything. Persists to localStorage.
   ========================================================================= */
(function () {
  'use strict';
  const KEY = 'board37.theme';
  const el = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };
  const root = document.documentElement;

  /* ---- theme model ------------------------------------------------------ */
  const COLOR_TOKENS = [
    ['--ink', 'Фон'], ['--ink-2', 'Панель'], ['--ink-3', 'Панель (выше)'],
    ['--chalk', 'Текст основной'], ['--chalk-2', 'Текст вторичный'], ['--chalk-3', 'Текст приглушённый'],
    ['--start', 'Старт'], ['--hand', 'Руки'], ['--foot', 'Ноги'], ['--finish', 'Топ'], ['--star', 'Звёзды'],
  ];
  const DEF_COLORS = {
    '--ink': '#0B0B0C', '--ink-2': '#121215', '--ink-3': '#1A1A1E',
    '--chalk': '#F4F1EA', '--chalk-2': '#B8B4AC', '--chalk-3': '#76736D',
    '--start': '#9FE0B8', '--hand': '#9BCBE6', '--foot': '#F2C6A0', '--finish': '#C9AEEE', '--star': '#E7D6A6',
  };
  const defaultTheme = () => ({
    colors: { ...DEF_COLORS },
    fontDisplay: 'Fraunces', fontBody: 'Spectral',
    grain: 0.5, lineAlpha: 0.10,
  });

  const hexToRgb = (hex) => {
    const m = hex.replace('#', '');
    return { r: parseInt(m.slice(0, 2), 16), g: parseInt(m.slice(2, 4), 16), b: parseInt(m.slice(4, 6), 16) };
  };

  function computeVars(t) {
    const v = {};
    for (const [k] of COLOR_TOKENS) v[k] = t.colors[k];
    v['--font-display'] = `'${t.fontDisplay}', Georgia, serif`;
    v['--font-body'] = `'${t.fontBody}', Georgia, serif`;
    v['--grain'] = String(t.grain);
    const c = hexToRgb(t.colors['--chalk']);
    v['--line'] = `rgba(${c.r},${c.g},${c.b},${t.lineAlpha.toFixed(3)})`;
    v['--line-2'] = `rgba(${c.r},${c.g},${c.b},${Math.min(0.55, t.lineAlpha * 1.8).toFixed(3)})`;
    return v;
  }

  function apply(t) {
    const v = computeVars(t);
    for (const k in v) root.style.setProperty(k, v[k]);
    loadFont(t.fontDisplay); loadFont(t.fontBody);
  }

  function persist(t) {
    const fonts = [...new Set([t.fontDisplay, t.fontBody])].filter(f => !['Fraunces', 'Spectral'].includes(f));
    try { localStorage.setItem(KEY, JSON.stringify({ ...t, vars: computeVars(t), fonts })); } catch (e) {}
  }

  function loadTheme() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && s.colors) return {
        colors: { ...DEF_COLORS, ...s.colors },
        fontDisplay: s.fontDisplay || 'Fraunces', fontBody: s.fontBody || 'Spectral',
        grain: s.grain != null ? s.grain : 0.5, lineAlpha: s.lineAlpha != null ? s.lineAlpha : 0.10,
      };
    } catch (e) {}
    return defaultTheme();
  }

  let theme = loadTheme();

  /* ---- on-demand Google font loading ------------------------------------ */
  const loaded = new Set(['Fraunces', 'Spectral']);
  function loadFont(family) {
    if (!family || loaded.has(family)) return;
    loaded.add(family);
    const base = family.replace(/ /g, '+');
    const link = el('link'); link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${base}:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap`;
    link.onerror = () => { const l2 = el('link'); l2.rel = 'stylesheet'; l2.href = `https://fonts.googleapis.com/css2?family=${base}&display=swap`; document.head.appendChild(l2); };
    document.head.appendChild(link);
  }

  /* ---- full font catalogue (fetched, with a strong built-in fallback) ---- */
  /* Only fonts with Cyrillic support */
  const FALLBACK_FONTS = [
    'Spectral','Playfair Display','Cormorant','Cormorant Garamond','EB Garamond','Lora','Bitter','PT Serif','Source Serif 4','Noto Serif','Merriweather','Roboto Slab','Literata','Old Standard TT','Alegreya',
    'Inter','Inter Tight','Roboto','Roboto Flex','Open Sans','Montserrat','Raleway','Nunito','Nunito Sans','Manrope','Onest','IBM Plex Sans','Rubik','Oswald','Unbounded',
    'Yeseva One','Lobster','Comfortaa',
    'Caveat',
    'JetBrains Mono','Fira Code','IBM Plex Mono','Source Code Pro','Roboto Mono','Martian Mono',
  ];
  let FONTS = FALLBACK_FONTS.slice().sort();
  const fontFields = [];

  async function fetchFonts() {
    try {
      const r = await fetch('https://api.fontsource.org/v1/fonts');
      if (!r.ok) return null;
      const j = await r.json();
      const g = j.filter(f => f.type === 'google' && f.family && Array.isArray(f.subsets) && f.subsets.includes('cyrillic')).map(f => f.family);
      if (g.length > 10) return [...new Set(g)].sort((a, b) => a.localeCompare(b));
    } catch (e) {}
    return null;
  }

  /* ---- font picker field ------------------------------------------------- */
  function fontField(title, get, set) {
    const wrap = el('div', 'pnl-font');
    wrap.innerHTML = `<div class="pnl-fontlbl">${title}</div>
      <button class="pnl-fontbtn"><span class="fam"></span><span class="chev">▾</span></button>
      <div class="pnl-fontpop"><input class="pnl-search" placeholder="Поиск среди ${FONTS.length}+ шрифтов…"><div class="pnl-list"></div></div>`;
    const btn = wrap.querySelector('.pnl-fontbtn');
    const fam = wrap.querySelector('.fam');
    const search = wrap.querySelector('.pnl-search');
    const list = wrap.querySelector('.pnl-list');
    let io;

    const setPreview = () => { const f = get(); fam.textContent = f; loadFont(f); fam.style.fontFamily = `'${f}', serif`; };

    function renderList(q) {
      const ql = (q || '').trim().toLowerCase();
      const items = (ql ? FONTS.filter(f => f.toLowerCase().includes(ql)) : FONTS).slice(0, 400);
      list.innerHTML = '';
      if (io) io.disconnect();
      io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { const f = e.target.dataset.f; loadFont(f); e.target.style.fontFamily = `'${f}', serif`; io.unobserve(e.target); }
      }), { root: list, rootMargin: '60px' });
      if (!items.length) { list.innerHTML = '<div class="pnl-loading">Ничего не найдено</div>'; return; }
      const frag = document.createDocumentFragment();
      items.forEach(f => {
        const b = el('button', 'font-item' + (f === get() ? ' is-on' : ''));
        b.dataset.f = f; b.textContent = f;
        b.onclick = () => { set(f); setPreview(); wrap.classList.remove('open'); };
        frag.appendChild(b);
      });
      list.appendChild(frag);
      list.querySelectorAll('.font-item').forEach(b => io.observe(b));
    }

    btn.onclick = () => {
      const open = wrap.classList.toggle('open');
      if (open) { search.value = ''; renderList(''); setTimeout(() => search.focus(), 30); }
    };
    search.oninput = () => renderList(search.value);
    wrap._refresh = () => { search.placeholder = `Поиск среди ${FONTS.length}+ шрифтов…`; if (wrap.classList.contains('open')) renderList(search.value); };
    setPreview();
    fontFields.push(wrap);
    return wrap;
  }

  /* ---- controls --------------------------------------------------------- */
  function colorRow(token, label) {
    const row = el('div', 'pnl-color');
    const sw = el('input'); sw.type = 'color'; sw.className = 'pnl-swatch'; sw.value = theme.colors[token];
    const lab = el('label'); lab.textContent = label;
    const hex = el('input'); hex.className = 'pnl-hex'; hex.value = theme.colors[token].toUpperCase(); hex.spellcheck = false;
    const set = (val) => {
      let v = val.trim(); if (v[0] !== '#') v = '#' + v;
      if (!/^#[0-9a-fA-F]{6}$/.test(v)) { hex.value = theme.colors[token].toUpperCase(); return; }
      theme.colors[token] = v; sw.value = v; hex.value = v.toUpperCase(); apply(theme); persist(theme);
    };
    sw.oninput = () => set(sw.value);
    hex.onchange = () => set(hex.value);
    row.append(sw, lab, hex);
    return row;
  }

  function slider(label, min, max, step, val, fmt, onInput) {
    const wrap = el('div', 'pnl-slide');
    wrap.innerHTML = `<div class="row"><span>${label}</span><span class="val"></span></div>`;
    const input = el('input'); input.type = 'range'; input.className = 'pnl-range';
    input.min = min; input.max = max; input.step = step; input.value = val;
    const v = wrap.querySelector('.val');
    const upd = () => v.textContent = fmt(+input.value);
    input.oninput = () => { onInput(+input.value); upd(); };
    upd(); wrap.appendChild(input); return wrap;
  }

  /* ---- presets ---------------------------------------------------------- */
  const PRESETS = [
    { name: 'Chalk & Ink', ...defaultTheme() },
    {
      name: 'Бумага',
      colors: { '--ink': '#F1EDE3', '--ink-2': '#FBF8F1', '--ink-3': '#E9E3D5', '--chalk': '#1B1813', '--chalk-2': '#4C463C', '--chalk-3': '#8B8478', '--start': '#3F9D6A', '--hand': '#3E86B5', '--foot': '#C77A3C', '--finish': '#8E5BC4', '--star': '#B8902F' },
      fontDisplay: 'Playfair Display', fontBody: 'Newsreader', grain: 0.3, lineAlpha: 0.14,
    },
    {
      name: 'Неон-ночь',
      colors: { '--ink': '#07080C', '--ink-2': '#0E0F16', '--ink-3': '#171A26', '--chalk': '#EAF2FF', '--chalk-2': '#9FB0C9', '--chalk-3': '#5C6B86', '--start': '#5CF2B0', '--hand': '#6BC6FF', '--foot': '#FFB37A', '--finish': '#C79BFF', '--star': '#FFD75E' },
      fontDisplay: 'Sora', fontBody: 'Inter Tight', grain: 0.35, lineAlpha: 0.16,
    },
    {
      name: 'Сепия',
      colors: { '--ink': '#17120E', '--ink-2': '#201914', '--ink-3': '#2B2119', '--chalk': '#F0E2CE', '--chalk-2': '#C2A883', '--chalk-3': '#8A7256', '--start': '#A8C58A', '--hand': '#9FC4C0', '--foot': '#E0A86B', '--finish': '#C9A2D4', '--star': '#E3C170' },
      fontDisplay: 'Cormorant', fontBody: 'Spectral', grain: 0.5, lineAlpha: 0.13,
    },
  ];
  const presetTheme = (p) => ({
    colors: { ...DEF_COLORS, ...p.colors },
    fontDisplay: p.fontDisplay, fontBody: p.fontBody,
    grain: p.grain, lineAlpha: p.lineAlpha,
  });

  /* ---- build the panel -------------------------------------------------- */
  function build() {
    const panel = document.getElementById('panel');
    panel.innerHTML = '';

    const head = el('div', 'pnl-head');
    head.innerHTML = `<div><div class="pnl-title">Студия темы</div><div class="pnl-sub">Меняй стиль вживую — всё сохраняется</div></div><button class="pnl-x" aria-label="Скрыть">✕</button>`;
    head.querySelector('.pnl-x').onclick = closePanel;
    panel.appendChild(head);

    // Fonts
    const sFonts = el('section', 'pnl-sec');
    sFonts.appendChild(Object.assign(el('h4'), { textContent: 'Шрифты' }));
    sFonts.appendChild(fontField('Заголовки', () => theme.fontDisplay, f => { theme.fontDisplay = f; apply(theme); persist(theme); }));
    sFonts.appendChild(fontField('Основной текст', () => theme.fontBody, f => { theme.fontBody = f; apply(theme); persist(theme); }));
    panel.appendChild(sFonts);

    // Colours
    const sCol = el('section', 'pnl-sec');
    sCol.appendChild(Object.assign(el('h4'), { textContent: 'Цвета' }));
    COLOR_TOKENS.forEach(([k, label]) => sCol.appendChild(colorRow(k, label)));
    panel.appendChild(sCol);

    // Texture
    const sTex = el('section', 'pnl-sec');
    sTex.appendChild(Object.assign(el('h4'), { textContent: 'Фактура' }));
    sTex.appendChild(slider('Толщина линий', 0, 0.4, 0.005, theme.lineAlpha, v => Math.round(v * 100) + '%', v => { theme.lineAlpha = v; apply(theme); persist(theme); }));
    sTex.appendChild(slider('Зерно (шум)', 0, 1, 0.02, theme.grain, v => Math.round(v * 100) + '%', v => { theme.grain = v; apply(theme); persist(theme); }));
    panel.appendChild(sTex);

    // Presets
    const sPre = el('section', 'pnl-sec');
    sPre.appendChild(Object.assign(el('h4'), { textContent: 'Пресеты' }));
    const grid = el('div', 'pnl-presets');
    PRESETS.forEach(p => {
      const t = presetTheme(p);
      const b = el('button', 'preset');
      b.innerHTML = `<div class="dots"><i style="background:${t.colors['--ink']}"></i><i style="background:${t.colors['--chalk']}"></i><i style="background:${t.colors['--start']}"></i><i style="background:${t.colors['--finish']}"></i></div><span>${p.name}</span>`;
      b.onclick = () => { theme = presetTheme(p); apply(theme); persist(theme); build(); };
      grid.appendChild(b);
    });
    sPre.appendChild(grid);
    panel.appendChild(sPre);

    // Export box (hidden until used)
    const exp = el('div', 'pnl-export'); exp.style.display = 'none';
    exp.innerHTML = '<textarea readonly spellcheck="false"></textarea>';
    panel.appendChild(exp);

    // Actions
    const acts = el('div', 'pnl-actions');
    const reset = el('button', 'pnl-btn'); reset.textContent = 'Сбросить';
    reset.onclick = () => { theme = defaultTheme(); apply(theme); persist(theme); build(); };
    const copy = el('button', 'pnl-btn pnl-btn--primary'); copy.textContent = 'Скопировать CSS';
    copy.onclick = () => {
      const css = exportCSS();
      exp.style.display = 'block';
      const ta = exp.querySelector('textarea'); ta.value = css; ta.focus(); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      if (navigator.clipboard) navigator.clipboard.writeText(css).catch(() => {});
      copy.textContent = ok ? 'Скопировано ✓' : 'Выдели и Ctrl+C';
      setTimeout(() => (copy.textContent = 'Скопировать CSS'), 1800);
    };
    acts.append(reset, copy);
    panel.appendChild(acts);
  }

  function exportCSS() {
    const v = computeVars(theme);
    let css = `/* 37 Board theme — Google Fonts: ${[...new Set([theme.fontDisplay, theme.fontBody])].join(', ')} */\n:root {\n`;
    for (const k in v) css += `  ${k}: ${v[k]};\n`;
    return css + '}\n';
  }

  /* ---- panel visibility ------------------------------------------------- */
  const isWide = () => window.matchMedia('(min-width: 881px)').matches;
  function togglePanel() { document.body.classList.toggle(isWide() ? 'no-panel' : 'panel-open'); }
  function closePanel() { if (isWide()) document.body.classList.add('no-panel'); else document.body.classList.remove('panel-open'); }
  document.getElementById('panel-toggle').onclick = togglePanel;

  /* ---- init ------------------------------------------------------------- */
  apply(theme);
  build();
  fetchFonts().then(list => {
    if (list && list.length) { FONTS = list; fontFields.forEach(f => f._refresh && f._refresh()); }
  });
})();
