/* =========================================================================
   37 BOARD — app shell (vanilla JS, runs from file://)
   ========================================================================= */
(function () {
  'use strict';
  const { BOARD, CLIMBS, ANGLES, ROLE_META, ICONS, GRADE_SCALE, LOGBOOK, GRADE_COUNTS, FOLDERS, NOTIFICATIONS } = window;

  /* ---- tiny helpers ----------------------------------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const stage = $('#stage');
  const tabbarEl = $('#tabbar');
  const sheetRoot = $('#sheet-root');

  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  // build a full screen section from multi-root markup (innerHTML keeps every sibling)
  const screenEl = (html) => { const s = h('<section class="screen"></section>'); s.innerHTML = html; return s; };
  const fmt = (n) => n.toLocaleString('ru-RU');
  const icon = (name) => (typeof ICONS[name] === 'function' ? ICONS[name]() : ICONS[name]);
  const ROLE_ORDER = { start: 0, hand: 1, foot: 2, finish: 3 };

  /* ---- state ------------------------------------------------------------ */
  const state = {
    tab: 'boards',
    angle: 45,
    query: '',
    sort: 'popular',
    filters: { vMin: 0, vMax: 10, minStars: 0 },
    climbIndex: 0,
  };

  function currentList() {
    let list = CLIMBS.slice();
    const q = state.query.trim().toLowerCase();
    if (q) list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.setter.toLowerCase().includes(q) ||
      (c.fa && c.fa.toLowerCase().includes(q)));
    const f = state.filters;
    list = list.filter(c => c.vNum >= f.vMin && c.vNum <= f.vMax && c.stars >= f.minStars);
    const sorters = {
      popular:    (a, b) => b.ascents - a.ascents,
      'grade-asc':(a, b) => a.vNum - b.vNum || b.ascents - a.ascents,
      'grade-desc':(a, b) => b.vNum - a.vNum || b.ascents - a.ascents,
      name:       (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(sorters[state.sort]);
  }

  /* ---- board rendering (base holds cached, rings per climb) -------------- */
  const DEFS = `<defs>
    <radialGradient id="holdGrad" cx="38%" cy="28%" r="78%">
      <stop offset="0" stop-color="#52524f"/>
      <stop offset="0.45" stop-color="#33332f"/>
      <stop offset="1" stop-color="#161614"/>
    </radialGradient>
  </defs>`;

  const BASE_HOLDS = (() => {
    let s = '<g class="holds">';
    for (const hd of BOARD.holds) {
      s += `<path class="hold-body" d="${hd.path}" transform="translate(${hd.cx.toFixed(1)} ${hd.cy.toFixed(1)}) rotate(${hd.rot.toFixed(0)})" opacity="0.9"/>`;
    }
    return s + '</g>';
  })();

  function ringsFor(climb) {
    let s = '<g class="rings">';
    climb.holds.forEach((sd) => {
      const hd = BOARD.holds[sd.h];
      const r = hd.r * 1.85 + 4;
      s += `<circle class="ring ring--${sd.role}" cx="${hd.cx.toFixed(1)}" cy="${hd.cy.toFixed(1)}" r="${r.toFixed(1)}"/>`;
    });
    return s + '</g>';
  }

  function renderBoardSVG(climb) {
    return `<svg class="board" viewBox="0 0 ${BOARD.W} ${BOARD.H}" preserveAspectRatio="xMidYMid meet">
      ${DEFS}${BASE_HOLDS}${ringsFor(climb)}</svg>`;
  }

  /* ---- router (root tabs + pushed overlay screens) ---------------------- */
  let rootEl = null;
  const overlay = [];
  const topLayer = () => (overlay.length ? overlay[overlay.length - 1].el : rootEl);

  function setRoot(buildFn) {
    while (overlay.length) { overlay.pop().el.remove(); }
    const el = buildFn();
    el.dataset.layer = 'root';
    if (rootEl) {
      const old = rootEl;
      el.style.opacity = '0';
      stage.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transition = 'opacity .35s var(--ease-out)';
        el.style.opacity = '1';
        old.style.transition = 'opacity .25s var(--ease-out)';
        old.style.opacity = '0';
      });
      setTimeout(() => { old.remove(); el.style.transition = ''; }, 380);
    } else {
      stage.appendChild(el);
    }
    rootEl = el;
  }

  function pushScreen(buildFn) {
    const below = topLayer();
    const el = buildFn();
    overlay.push({ el });
    el.classList.add('screen--enter-fwd');
    stage.appendChild(el);
    el.addEventListener('animationend', () => el.classList.remove('screen--enter-fwd'), { once: true });
    if (below) below.classList.add('screen--exit-fwd');
    return el;
  }

  function popScreen() {
    if (!overlay.length) return;
    const { el } = overlay.pop();
    const below = topLayer();
    el.classList.add('screen--exit-back');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    if (below) {
      below.classList.remove('screen--exit-fwd');
      below.classList.add('screen--enter-back');
      below.addEventListener('animationend', () => below.classList.remove('screen--enter-back'), { once: true });
    }
  }

  /* ---- toast ------------------------------------------------------------ */
  let toastTimer;
  function toast(msg) {
    let t = $('#toast');
    if (!t) {
      t = h(`<div id="toast"></div>`);
      Object.assign(t.style, {
        position: 'absolute', left: '50%', bottom: 'calc(var(--tab-h) + 22px)',
        transform: 'translate(-50%, 12px)', zIndex: '90',
        background: 'var(--chalk)', color: 'var(--ink)',
        font: '500 14px/1 Spectral, serif', padding: '13px 20px',
        borderRadius: '14px', opacity: '0', transition: 'all .35s var(--ease-out)',
        boxShadow: '0 20px 50px -12px rgba(0,0,0,.6)', whiteSpace: 'nowrap', maxWidth: '90%',
      });
      $('#app').appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translate(-50%, 0)'; });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translate(-50%, 12px)'; }, 1900);
  }

  /* ---- HOME (boards tab) ------------------------------------------------ */
  function buildHome() {
    const screen = screenEl(`
      <header class="topbar fade-down">
        <div class="flex items-center justify-between gap-2">
          <button class="text-left -ml-1 px-1 py-1 rounded-xl active:bg-ink-2 transition" id="board-switch">
            <div class="label">Доска</div>
            <div class="flex items-center gap-1.5">
              <span class="font-display text-[22px] font-medium tracking-tight">Big Wall Sport</span>
              <span class="text-chalk-3">${icon('chevronDown')}</span>
            </div>
          </button>
          <div class="flex items-center gap-1.5">
            <button class="anglepill" id="angle-btn">${state.angle}<sup>°</sup></button>
            <button class="iconbtn" id="add-btn" aria-label="Создать трассу">${icon('plus')}</button>
          </div>
        </div>
        <div class="search mt-4">
          ${icon('search')}
          <input id="search" type="text" placeholder="Поиск трасс, сеттеров…" value="${state.query}" />
          <button class="iconbtn !w-9 !h-9 -mr-2" id="filter-btn" aria-label="Фильтры">${icon('sliders')}</button>
        </div>
        <div class="flex items-center justify-between mt-3 px-0.5">
          <div class="label" id="result-count"></div>
          <button class="label flex items-center gap-1.5 active:opacity-60 transition" id="sort-btn">
            ${icon('sort')}<span id="sort-label"></span>
          </button>
        </div>
      </header>
      <div id="home-list" class="pb-6"></div>
    `);

    // wire header
    $('#search', screen).addEventListener('input', (e) => { state.query = e.target.value; renderList(screen); });
    $('#filter-btn', screen).addEventListener('click', openFilters);
    $('#sort-btn', screen).addEventListener('click', openSort);
    $('#angle-btn', screen).addEventListener('click', openAngle);
    $('#add-btn', screen).addEventListener('click', () => pushScreen(buildCreate));
    $('#board-switch', screen).addEventListener('click', openBoardSwitch);

    renderList(screen);
    return screen;
  }

  const SORT_LABELS = { popular: 'Популярные', 'grade-asc': 'Проще → сложнее', 'grade-desc': 'Сложнее → проще', name: 'По названию' };

  function renderList(screen) {
    const wrap = $('#home-list', screen);
    const list = currentList();
    $('#sort-label', screen).textContent = SORT_LABELS[state.sort];
    $('#result-count', screen).textContent = `${list.length} ${plural(list.length, ['трасса', 'трассы', 'трасс'])}`;
    if (!list.length) {
      wrap.innerHTML = `<div class="placeholder !py-24"><span>${icon('search')}</span>
        <h2>Ничего не найдено</h2><p class="text-sm">Попробуй смягчить фильтры</p></div>`;
      return;
    }
    wrap.innerHTML = list.map((c, i) => rowHTML(c, i)).join('');
    wrap.querySelectorAll('[data-id]').forEach(row => {
      row.addEventListener('click', () => openClimb(parseInt(row.dataset.id, 10)));
    });
  }

  function rowHTML(c, i) {
    return `<article class="row reveal" data-id="${c.id}" style="--i:${i}">
      <div class="min-w-0">
        <h3 class="row__name">${c.name}${c.saved ? `<span class="text-chalk-3 ml-1.5 inline-block align-middle" style="width:14px">${ICONS.bookmark}</span>` : ''}</h3>
        <div class="row__meta">Сет: ${c.setter}${c.fa ? ` · FA: ${c.fa}` : ''}</div>
        <div class="row__count">${fmt(c.ascents)} ${plural(c.ascents, ['прохождение', 'прохождения', 'прохождений'])}</div>
      </div>
      <div class="flex flex-col items-end justify-center">
        <div class="row__grade">${c.font}<span class="text-chalk-3"> / </span>${c.v}</div>
        ${starsHTML(c.stars)}
      </div>
    </article>`;
  }

  function starsHTML(n) {
    let s = '<div class="stars">';
    for (let i = 0; i < 3; i++) s += ICONS.star(i < n);
    return s + '</div>';
  }

  function plural(n, forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }

  /* ---- CLIMB DETAIL ----------------------------------------------------- */
  function openClimb(id) {
    const list = currentList();
    state.climbIndex = Math.max(0, list.findIndex(c => c.id === id));
    pushScreen(buildDetail);
  }

  function headHTML(c) {
    const nameItal = `<em>${c.name}</em>`;
    return `
      <div class="flex items-center justify-center gap-2.5 mb-2">
        <span class="badge">${c.idx}</span>
        <span class="label">${c.font} · ${c.v}</span>
      </div>
      <h1 class="detail-name">${nameItal}</h1>
      <div class="text-chalk-2 text-sm mt-2">Сет: ${c.setter}${c.fa ? ` · FA: ${c.fa}` : ''}</div>
      <div class="flex items-center justify-center gap-2.5 mt-2 text-chalk-3 text-[13px]">
        ${starsHTML(c.stars)}
        <span>·</span>
        <span>${fmt(c.ascents)} ${plural(c.ascents, ['пролаз', 'пролаза', 'пролазов'])}</span>
      </div>`;
  }

  function actionsHTML(c) {
    return `
      <button class="btn btn--primary ${c.logged ? 'is-logged' : ''}" id="d-log">
        ${icon('check')}<span>${c.logged ? 'Засчитано' : 'Отметить пролаз'}</span>
      </button>
      <button class="btn btn--ghost" id="d-beta" aria-label="Бета">${icon('bulb')}</button>
      <button class="btn btn--ghost" id="d-save" aria-label="Сохранить" style="${c.saved ? 'color:var(--star)' : ''}">${icon('bookmark')}</button>`;
  }

  function buildDetail() {
    const list = currentList();
    const c = list[state.climbIndex];
    const screen = screenEl(`
      <header class="topbar !pb-2">
        <div class="flex items-center justify-between">
          <button class="iconbtn -ml-2" id="d-back">${icon('back')}</button>
          <button class="anglepill" id="d-angle">${state.angle}<sup>°</sup></button>
          <button class="iconbtn -mr-2" id="d-more">${icon('more')}</button>
        </div>
      </header>
      <div id="d-head" class="detail-head" style="transition:opacity .25s var(--ease-out)">${headHTML(c)}</div>
      <div class="board-wrap"><div id="d-deck" class="board-deck"></div></div>
      <div class="legend">
        ${Object.entries(ROLE_META).map(([k, m]) => `<span><i class="dot" style="background:${m.color}"></i>${m.label}</span>`).join('')}
      </div>
      <div class="actionbar" id="d-actions">${actionsHTML(c)}</div>
    `);

    $('#d-back', screen).addEventListener('click', popScreen);
    $('#d-angle', screen).addEventListener('click', openAngle);
    $('#d-more', screen).addEventListener('click', () => openClimbMenu(list[state.climbIndex]));

    const headEl = $('#d-head', screen);
    const actionsEl = $('#d-actions', screen);

    function refreshChrome(climb) {
      headEl.style.opacity = '0';
      setTimeout(() => { headEl.innerHTML = headHTML(climb); headEl.style.opacity = '1'; }, 150);
      wireActions(climb);
    }
    function wireActions(climb) {
      actionsEl.innerHTML = actionsHTML(climb);
      $('#d-log', actionsEl).addEventListener('click', () => {
        climb.logged = !climb.logged;
        wireActions(climb);
        toast(climb.logged ? `«${climb.name}» — засчитано ✓` : 'Отметка снята');
      });
      $('#d-beta', actionsEl).addEventListener('click', () => toast('Видео-бета — скоро'));
      $('#d-save', actionsEl).addEventListener('click', () => {
        climb.saved = !climb.saved;
        wireActions(climb);
        toast(climb.saved ? 'Сохранено в избранное' : 'Убрано из избранного');
      });
    }
    wireActions(c);

    // mount the swipeable deck after layout
    requestAnimationFrame(() => mountDeck($('#d-deck', screen), list, refreshChrome));
    return screen;
  }

  /* ---- swipeable board deck -------------------------------------------- */
  function mountDeck(deck, list, onChange) {
    let idx = state.climbIndex;
    let W = deck.clientWidth || 360;

    function build() {
      deck.innerHTML = '';
      for (const p of [-1, 0, 1]) {
        const ci = idx + p;
        if (ci < 0 || ci >= list.length) continue;
        const card = h(`<div class="board-card" data-pos="${p}">${renderBoardSVG(list[ci])}</div>`);
        card.style.transform = `translateX(${p * 100}%)`;
        deck.appendChild(card);
      }
    }
    build();

    let down = false, startX = 0, startY = 0, dx = 0, lock = null;

    deck.addEventListener('pointerdown', (e) => {
      down = true; lock = null; dx = 0;
      startX = e.clientX; startY = e.clientY; W = deck.clientWidth;
      deck.style.transition = 'none';
    });
    deck.addEventListener('pointermove', (e) => {
      if (!down) return;
      const mx = e.clientX - startX, my = e.clientY - startY;
      if (lock === null && (Math.abs(mx) > 6 || Math.abs(my) > 6)) lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (lock !== 'x') return;
      e.preventDefault();
      dx = mx;
      // resistance at the ends
      if ((idx === 0 && dx > 0) || (idx === list.length - 1 && dx < 0)) dx *= 0.32;
      deck.style.transform = `translateX(${dx}px)`;
      try { deck.setPointerCapture(e.pointerId); } catch (_) {}
    });
    function release() {
      if (!down) return; down = false;
      const threshold = W * 0.2;
      let dir = 0;
      if (dx <= -threshold && idx < list.length - 1) dir = 1;
      else if (dx >= threshold && idx > 0) dir = -1;
      if (dir) {
        deck.style.transition = 'transform .42s var(--ease-out)';
        deck.style.transform = `translateX(${-dir * W}px)`;
        setTimeout(() => {
          idx += dir; state.climbIndex = idx;
          deck.style.transition = 'none';
          build();
          deck.style.transform = 'translateX(0)';
          requestAnimationFrame(() => { deck.style.transition = ''; });
          onChange(list[idx]);
        }, 420);
      } else {
        deck.style.transition = 'transform .34s var(--ease-out)';
        deck.style.transform = 'translateX(0)';
      }
      dx = 0;
    }
    deck.addEventListener('pointerup', release);
    deck.addEventListener('pointercancel', release);
  }

  /* ---- CREATE / EDIT mode (pick a type below, then tap holds) ----------- */
  const BRUSHES = [['start', 'Старт'], ['hand', 'Зацеп'], ['foot', 'Нога'], ['finish', 'Финиш']];

  function buildCreate(existing) {
    const sel = new Map(); // holdId -> role
    if (existing && existing.holds) existing.holds.forEach(x => sel.set(x.h, x.role));
    let brush = 'start';

    const screen = screenEl(`
      <header class="topbar !pb-2">
        <div class="flex items-center justify-between">
          <button class="iconbtn -ml-2" id="c-close">${icon('close')}</button>
          <div class="font-display text-lg font-medium">${existing ? 'Редактировать' : 'Новая трасса'}</div>
          <button class="iconbtn -mr-2" id="c-save" aria-label="Черновик">${icon('check')}</button>
        </div>
      </header>
      <div class="text-center text-chalk-3 text-[13px] px-6 pt-1 pb-1">Выбери тип зацепки внизу, затем отмечай её на доске</div>
      <div class="board-wrap"><div class="board-deck" style="position:relative">
        <div class="board-card" id="c-card" style="position:relative">${renderBoardSVG({ holds: [] })}</div>
      </div></div>
      <div class="brushbar" id="c-brushes">
        ${BRUSHES.map(([r, l]) => `<button class="brush" data-role="${r}">
          <span class="brush-n" data-n="${r}">0</span>
          <span class="brush-dot" style="background:var(--${r})">${ICONS.ROLE[r]}</span>
          <span class="brush-lbl">${l}</span>
        </button>`).join('')}
      </div>
      <div class="actionbar">
        <button class="btn btn--primary" id="c-publish">${icon('flag')}<span>${existing ? 'Сохранить' : 'Опубликовать'}</span></button>
        <button class="btn btn--ghost" id="c-clear" aria-label="Очистить">${icon('close')}</button>
      </div>
    `);

    const brushes = $('#c-brushes', screen);
    const counts = () => { const c = { start: 0, hand: 0, foot: 0, finish: 0 }; sel.forEach(r => c[r]++); return c; };
    const setBrush = (r) => { brush = r; brushes.querySelectorAll('.brush').forEach(b => b.classList.toggle('is-on', b.dataset.role === r)); };
    const refreshCounts = () => { const c = counts(); brushes.querySelectorAll('.brush-n').forEach(n => n.textContent = c[n.dataset.n]); };

    function repaint() {
      const climb = { holds: [...sel].map(([hid, role]) => ({ h: hid, role })) };
      $('#c-card', screen).innerHTML = renderBoardSVG(climb);
      bindBoard();
      refreshCounts();
    }
    function bindBoard() {
      const s = $('#c-card svg', screen);
      let g = '<g class="hit">';
      for (const hd of BOARD.holds) g += `<circle cx="${hd.cx.toFixed(1)}" cy="${hd.cy.toFixed(1)}" r="${(hd.r * 1.7).toFixed(1)}" fill="transparent" data-h="${hd.id}" style="cursor:pointer"/>`;
      s.insertAdjacentHTML('beforeend', g + '</g>');
      s.querySelectorAll('.hit circle').forEach(ci => ci.addEventListener('click', () => {
        const id = parseInt(ci.dataset.h, 10);
        if (sel.get(id) === brush) sel.delete(id); else sel.set(id, brush);
        repaint();
      }));
    }

    brushes.querySelectorAll('.brush').forEach(b => b.addEventListener('click', () => setBrush(b.dataset.role)));
    setBrush('start');
    repaint();

    $('#c-close', screen).addEventListener('click', popScreen);
    $('#c-save', screen).addEventListener('click', () => toast('Черновик сохранён'));
    $('#c-clear', screen).addEventListener('click', () => { sel.clear(); repaint(); });
    $('#c-publish', screen).addEventListener('click', () => {
      const c = counts();
      if (!c.start || !c.finish) return toast('Нужны старт и финиш');
      toast(existing ? 'Изменения сохранены ✓' : 'Трасса опубликована 🎉'); popScreen();
    });
    return screen;
  }

  function openClimbMenu(climb) {
    openSheet(`<div class="label mb-1">Трасса</div><div class="font-display text-2xl mb-4">${climb.name}</div>
      <div class="flex flex-col gap-2">
        <button class="chip !text-left !text-base !py-3.5" data-act="edit">Редактировать трассу</button>
        <button class="chip !text-left !text-base !py-3.5" data-act="dup">Создать на её основе</button>
        <button class="chip !text-left !text-base !py-3.5" data-act="share">Поделиться</button>
      </div>`, (sheet) => {
      sheet.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.act; closeSheet();
        if (a === 'edit') setTimeout(() => pushScreen(() => buildCreate(climb)), 180);
        else if (a === 'dup') setTimeout(() => pushScreen(() => buildCreate({ holds: climb.holds })), 180);
        else toast('Поделиться — скоро');
      }));
    });
  }

  /* ---- PROFILE tab (customizable) --------------------------------------- */
  const profileState = { view: 'all', sort: 'date-desc', gMin: 0, gMax: GRADE_SCALE.length - 1, folderIdx: null };
  const PROFILE_KEY = 'board37.profile';
  const DEFAULT_PROFILE = { name: 'Роман Дулёв', username: '@roman', status: 'Проектирую 7-ки по выходным 🧗', avatar: null, bg: null, followers: 248, following: 31, socials: [{ type: 'tg_account', handle: 'Yeeblane1337' }, { type: 'tg_channel', handle: 'BWchild' }] };
  const SOCIAL_NETS = {
    tg_account: { icon: 'social-icons/tg_account.png', url: 'https://t.me/' },
    tg_channel: { icon: 'social-icons/tg_channel.png', url: 'https://t.me/' },
  };
  const renderSocials = (socials) => (socials || []).map(s => {
    const net = SOCIAL_NETS[s.type]; if (!net) return '';
    return `<a class="prof-social-link" href="${net.url}${s.handle}" target="_blank" rel="noopener"><img src="${net.icon}" alt="${s.type}"></a>`;
  }).join('');
  let profileData = (() => { try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); return p ? { ...DEFAULT_PROFILE, ...p } : { ...DEFAULT_PROFILE }; } catch (e) { return { ...DEFAULT_PROFILE }; } })();
  const saveProfile = () => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData)); } catch (e) {} };

  const dShort = (ts) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const dLong = (ts) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const attLabel = (e) => e.flash ? 'Флеш' : `${e.attempts} ${plural(e.attempts, ['попытка', 'попытки', 'попыток'])}`;

  function chartBars() {
    const M = Math.max(0, ...GRADE_COUNTS);
    let N;
    if (M === 0)       N = 5;
    else if (M >= 50)  N = Math.ceil(M / 10) * 10;
    else               N = Math.ceil(M / 5)  * 5;
    const step = N / 5;

    const yLabels = Array.from({ length: 6 }, (_, i) =>
      `<span class="chart-ylabel" style="bottom:${i * 20}%">${i * step}</span>`
    ).join('');

    const gridLines = [0, 20, 40, 60, 80, 100].map(p =>
      `<div class="chart-gridline" style="bottom:${p}%"></div>`
    ).join('');

    const bars = GRADE_SCALE.map((g, i) => {
      const cnt = GRADE_COUNTS[i];
      const h = Math.round((cnt / N) * 100);
      return `<div class="bar-col">
        <div class="bar-track">${cnt > 0 ? `<div class="bar" style="height:${h}%"></div>` : ''}</div>
        <span class="bar-lbl">${g.includes('+') ? '' : g}</span>
      </div>`;
    }).join('');

    return `<div class="chart-yaxis">${yLabels}</div>
      <div class="chart-body"><div class="chart-gridlines">${gridLines}</div>${bars}</div>`;
  }

  function buildProfile() {
    const screen = screenEl(`
      <div class="prof-cover" id="p-cover" style="${profileData.bg ? `background-image:url('${profileData.bg}')` : ''}">
        <button class="prof-bell" id="p-bell" aria-label="Уведомления">${icon('bell')}<i class="prof-bell-dot"></i></button>
        <button class="prof-brush" id="p-brush" aria-label="Редактировать профиль">${icon('brush')}</button>
        <button class="prof-coverbtn" id="p-coverbtn" aria-label="Сменить фон"><span class="ic-wrap">${icon('camera')}</span><span>Фон</span></button>
      </div>
      <div class="prof-id" id="p-id">
        <div class="prof-avatar-row">
          <button class="prof-avatar" id="p-avatar">${profileData.avatar ? `<img src="${profileData.avatar}" alt="">` : icon('user')}<i class="prof-avcam">${icon('camera')}</i></button>
          <div class="prof-stats">
            <button class="prof-stat" id="p-followers">
              <span class="prof-stat-num">${profileData.followers ?? 0}</span>
              <span class="prof-stat-lbl">подписчики</span>
            </button>
            <button class="prof-stat" id="p-following">
              <span class="prof-stat-num">${profileData.following ?? 0}</span>
              <span class="prof-stat-lbl">подписки</span>
            </button>
          </div>
        </div>
        <div class="prof-name" id="p-name" contenteditable="false" spellcheck="false" data-ph="Имя Фамилия">${profileData.name}</div>
        <div class="prof-social-row">
          <div class="prof-user" id="p-user" contenteditable="false" spellcheck="false" data-ph="@username">${profileData.username}</div>
          <div class="prof-socials" id="p-socials">${renderSocials(profileData.socials)}</div>
        </div>
        <div class="prof-status" id="p-status" contenteditable="false" spellcheck="false" data-ph="Добавь статус…">${profileData.status}</div>
      </div>

      <div class="prof-sec">
        <div class="prof-sechead"><span class="label">Категории</span><span class="label">${LOGBOOK.length} ${plural(LOGBOOK.length, ['трасса', 'трассы', 'трасс'])}</span></div>
        <div class="chart">${chartBars()}</div>
      </div>

      <div class="prof-sec">
        <div class="prof-listhead">
          <div class="seg" id="p-seg">
            <button class="seg-opt is-on" data-v="all">Все трассы</button>
            <button class="seg-opt" id="p-seg-col" data-v="folders">Коллекции</button>
          </div>
          <div class="flex items-center gap-1" id="p-controls">
            <button class="iconbtn !w-9 !h-9" id="p-sort" aria-label="Сортировка">${icon('sort')}</button>
            <button class="iconbtn !w-9 !h-9" id="p-gfilter" aria-label="Диапазон категорий">${icon('sliders')}</button>
          </div>
        </div>
        <div id="p-list"></div>
      </div>
      <div style="height:90px;flex:none"></div>
    `);

    // ---- bell
    $('#p-bell', screen).addEventListener('click', () => pushScreen(buildNotifications));

    // ---- followers / following navigation
    $('#p-followers', screen).addEventListener('click', () => pushScreen(() => buildUserList('followers', profileData.followers ?? 0)));
    $('#p-following', screen).addEventListener('click', () => pushScreen(() => buildUserList('following', profileData.following ?? 0)));

    // ---- edit mode
    let editMode = false;
    const brushBtn = $('#p-brush', screen);
    const nameEl   = $('#p-name', screen);
    const userEl   = $('#p-user', screen);
    const statusEl = $('#p-status', screen);

    const pickImage = (cb) => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => { const f = inp.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => cb(fr.result); fr.readAsDataURL(f); };
      inp.click();
    };

    const setEditMode = (on) => {
      editMode = on;
      screen.classList.toggle('is-edit', on);
      brushBtn.innerHTML = on ? icon('check') : icon('brush');
      nameEl.contentEditable   = on ? 'plaintext-only' : 'false';
      userEl.contentEditable   = on ? 'plaintext-only' : 'false';
      statusEl.contentEditable = on ? 'plaintext-only' : 'false';
      if (on) nameEl.focus();
    };

    brushBtn.addEventListener('click', () => {
      if (editMode) {
        const trimName = nameEl.textContent.trim();
        if (trimName) profileData.name = trimName;
        else nameEl.textContent = profileData.name;

        const rawUser = userEl.textContent.trim();
        const cleanUser = rawUser.startsWith('@') ? rawUser : '@' + rawUser.replace(/^@*/g, '');
        if (cleanUser.length > 1) profileData.username = cleanUser;
        else userEl.textContent = profileData.username;

        profileData.status = statusEl.textContent.trim();
        saveProfile();
      }
      setEditMode(!editMode);
    });

    [nameEl, statusEl].forEach(el => {
      el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); } });
    });

    // guard @ in username field
    userEl.addEventListener('input', () => {
      const text = userEl.textContent;
      if (!text.startsWith('@')) {
        const sel = window.getSelection();
        const off = sel.rangeCount ? sel.getRangeAt(0).startOffset : 1;
        userEl.textContent = '@' + text.replace(/^@*/g, '');
        try {
          const r = document.createRange();
          r.setStart(userEl.firstChild || userEl, Math.min(Math.max(1, off), userEl.textContent.length));
          r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
        } catch(e) {}
      }
    });
    userEl.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); userEl.blur(); return; }
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (ev.key === 'Backspace') {
        if (range.collapsed && range.startOffset <= 1) { ev.preventDefault(); return; }
        if (!range.collapsed && range.startOffset === 0) ev.preventDefault();
      } else if (ev.key === 'Delete') {
        if (range.collapsed && range.startOffset === 0) { ev.preventDefault(); return; }
        if (!range.collapsed && range.startOffset === 0) ev.preventDefault();
      }
    });

    $('#p-avatar', screen).addEventListener('click', () => {
      if (!editMode) return;
      pickImage((url) => {
        profileData.avatar = url; saveProfile();
        $('#p-avatar', screen).innerHTML = `<img src="${url}" alt=""><i class="prof-avcam">${icon('camera')}</i>`;
      });
    });

    $('#p-coverbtn', screen).addEventListener('click', (e) => {
      e.stopPropagation();
      pickImage((url) => { profileData.bg = url; saveProfile(); $('#p-cover', screen).style.backgroundImage = `url('${url}')`; });
    });

    // ---- list controls
    $('#p-seg', screen).querySelectorAll('.seg-opt').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.v === 'all') {
        profileState.view = 'all';
        profileState.folderIdx = null;
      } else {
        profileState.view = 'folders';
      }
      renderProfileList(screen);
    }));
    $('#p-sort', screen).addEventListener('click', () => openProfileSort(screen));
    $('#p-gfilter', screen).addEventListener('click', () => openGradeRange(screen));

    renderProfileList(screen);
    return screen;
  }

  function buildUserList(type, count) {
    const title = type === 'followers' ? 'Подписчики' : 'Подписки';
    const MOCK = type === 'followers'
      ? [
          { name: 'Алексей Петров',   username: '@alex_climb'   },
          { name: 'Мария Козлова',    username: '@masha_rocks'  },
          { name: 'Дмитрий Сидоров', username: '@dima_v8'       },
          { name: 'Анна Белова',      username: '@anya_dyno'    },
          { name: 'Игорь Романов',    username: '@igor_heel'    },
        ]
      : [
          { name: 'Сергей Волков',    username: '@sergey_slab'  },
          { name: 'Катя Морозова',    username: '@katya_crimp'  },
          { name: 'Павел Орлов',      username: '@pasha_arete'  },
        ];
    const screen = screenEl(`
      <header class="topbar !pb-3">
        <div class="flex items-center justify-between">
          <button class="iconbtn -ml-2" id="ul-back">${icon('back')}</button>
          <div></div>
        </div>
        <h1 class="font-display text-[28px] font-medium mt-2">${title}</h1>
        <div class="text-chalk-3 text-sm mt-0.5">${count}</div>
      </header>
      <div class="pb-24">
        ${MOCK.map(u => `
          <div class="ulist-row">
            <div class="ulist-av">${icon('user')}</div>
            <div>
              <div class="ulist-name">${u.name}</div>
              <div class="ulist-un">${u.username}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `);
    $('#ul-back', screen).addEventListener('click', popScreen);
    return screen;
  }

  const PSORT = {
    'date-desc': 'Сначала недавние', 'date-asc': 'Сначала ранние',
    'grade-desc': 'Грейд: сложные сверху', 'grade-asc': 'Грейд: простые сверху',
  };

  function logRowHTML(e, showDate) {
    return `<div class="log-row">
      <div class="min-w-0"><div class="log-name">${e.name}</div>
        <div class="log-sub">${showDate ? dShort(e.ts) + ' · ' : ''}${attLabel(e)}</div></div>
      <div class="log-grade">${e.font}</div>
    </div>`;
  }

  function renderProfileList(scope) {
    const wrap = $('#p-list', scope);

    // --- sync segmented control
    const isAll    = profileState.view === 'all';
    const isFolder = profileState.view === 'folder';
    const activeFolder = isFolder && profileState.folderIdx !== null ? FOLDERS[profileState.folderIdx] : null;
    const btn2 = $('#p-seg-col', scope);
    if (btn2) {
      if (activeFolder) {
        btn2.innerHTML = `<span class="seg-col-pre">Коллекция</span><span class="seg-col-arr">→</span><span class="seg-col-name">${activeFolder.name}</span>`;
      } else {
        btn2.textContent = 'Коллекции';
      }
      $('#p-seg', scope).querySelectorAll('.seg-opt').forEach(b =>
        b.classList.toggle('is-on', b.dataset.v === 'all' ? isAll : !isAll)
      );
    }
    const controls = $('#p-controls', scope);
    if (controls) controls.style.visibility = isAll ? 'visible' : 'hidden';

    // --- коллекции: список
    if (profileState.view === 'folders') {
      wrap.innerHTML = FOLDERS.map((f, i) => `<button class="folder" data-f="${i}">
        <span class="folder-ic">${icon('bookmark')}</span>
        <span class="folder-main"><span class="folder-name">${f.name}</span>
          <span class="folder-sub">${f.climbs.length} ${plural(f.climbs.length, ['трасса', 'трассы', 'трасс'])} · ${f.public ? 'публичная' : 'приватная'}</span></span>
        <span class="folder-vis">${f.public ? icon('globe') : icon('lock')}</span>
      </button>`).join('') + `<button class="folder folder--add" id="folder-add"><span class="folder-ic">${icon('plus')}</span><span class="folder-main"><span class="folder-name">Новая коллекция</span></span></button>`;
      wrap.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
        profileState.folderIdx = +b.dataset.f;
        profileState.view = 'folder';
        renderProfileList(scope);
      }));
      $('#folder-add', wrap).addEventListener('click', () => toast('Создание коллекций — скоро'));
      return;
    }

    // --- коллекции: трассы выбранной коллекции
    if (profileState.view === 'folder') {
      const folder = FOLDERS[profileState.folderIdx];
      const items  = folder ? folder.climbs : [];
      wrap.innerHTML = items.length
        ? `<div class="sess">${items.map(e => logRowHTML(e, true)).join('')}</div>`
        : `<div class="text-chalk-3 text-sm py-10 text-center italic">Коллекция пуста</div>`;
      return;
    }

    let items = LOGBOOK.filter(e => e.gi >= profileState.gMin && e.gi <= profileState.gMax);
    const sort = profileState.sort;

    if (sort === 'grade-desc' || sort === 'grade-asc') {
      items.sort((a, b) => sort === 'grade-desc' ? (b.gi - a.gi || b.ts - a.ts) : (a.gi - b.gi || a.ts - b.ts));
      wrap.innerHTML = items.length
        ? `<div class="sess">${items.map(e => logRowHTML(e, true)).join('')}</div>`
        : emptyLog();
      return;
    }

    // date sorts → group into sessions
    const byDay = new Map();
    items.forEach(e => { if (!byDay.has(e.dateKey)) byDay.set(e.dateKey, []); byDay.get(e.dateKey).push(e); });
    let days = [...byDay.values()];
    days.sort((a, b) => sort === 'date-desc' ? b[0].ts - a[0].ts : a[0].ts - b[0].ts);
    if (!days.length) { wrap.innerHTML = emptyLog(); return; }

    wrap.innerHTML = days.map(day => {
      const rows = day.slice().sort((a, b) => sort === 'date-desc' ? b.ts - a.ts : a.ts - b.ts);
      const att = day.reduce((s, e) => s + e.attempts, 0);
      return `<div class="sess">
        <div class="sess-head">
          <div class="sess-date">Сессия от ${dLong(day[0].ts)}</div>
          <div class="sess-meta">${day.length} ${plural(day.length, ['трасса', 'трассы', 'трасс'])} · ${att} ${plural(att, ['попытка', 'попытки', 'попыток'])}</div>
        </div>
        ${rows.map(e => logRowHTML(e, false)).join('')}
      </div>`;
    }).join('');
  }

  const emptyLog = () => `<div class="text-chalk-3 text-sm py-10 text-center italic">В этом диапазоне трасс нет</div>`;

  function openProfileSort(scope) {
    openSheet(`<div class="label mb-1">Сортировка</div><div class="font-display text-2xl mb-4">Порядок трасс</div>
      <div class="flex flex-col gap-2">
        ${Object.entries(PSORT).map(([k, v]) => `<button class="chip !text-left !text-base !py-3.5 ${k === profileState.sort ? 'is-on' : ''}" data-s="${k}">${v}</button>`).join('')}
      </div>`, (sheet) => {
      sheet.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => { profileState.sort = b.dataset.s; renderProfileList(scope); closeSheet(); }));
    });
  }

  function openGradeRange(scope) {
    const chips = (sel) => GRADE_SCALE.map((g, i) => `<button class="chip ${i === sel ? 'is-on' : ''}" data-i="${i}">${g}</button>`).join('');
    openSheet(`
      <div class="flex items-center justify-between mb-1"><div class="label">Диапазон</div>
        <button class="label active:opacity-60" id="g-reset">Сбросить</button></div>
      <div class="font-display text-2xl mb-4">Категории трасс</div>
      <div class="label mb-2">От</div><div class="flex flex-wrap gap-2 mb-4" id="g-min">${chips(profileState.gMin)}</div>
      <div class="label mb-2">До</div><div class="flex flex-wrap gap-2 mb-5" id="g-max">${chips(profileState.gMax)}</div>
      <button class="btn btn--primary w-full" id="g-done">Готово</button>
    `, (sheet) => {
      const live = () => renderProfileList(scope);
      const single = (sel, apply, mirror) => $(sel, sheet).querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        $(sel, sheet).querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x === b));
        apply(+b.dataset.i); mirror(); live();
      }));
      const syncMin = () => sheet.querySelectorAll('#g-min button').forEach(x => x.classList.toggle('is-on', +x.dataset.i === profileState.gMin));
      const syncMax = () => sheet.querySelectorAll('#g-max button').forEach(x => x.classList.toggle('is-on', +x.dataset.i === profileState.gMax));
      single('#g-min', v => { profileState.gMin = v; if (profileState.gMax < v) profileState.gMax = v; }, syncMax);
      single('#g-max', v => { profileState.gMax = v; if (profileState.gMin > v) profileState.gMin = v; }, syncMin);
      $('#g-reset', sheet).addEventListener('click', () => { profileState.gMin = 0; profileState.gMax = GRADE_SCALE.length - 1; live(); closeSheet(); });
      $('#g-done', sheet).addEventListener('click', closeSheet);
    });
  }

  function buildFolder(folder) {
    const climbs = folder.climbs.slice().sort((a, b) => b.gi - a.gi);
    const screen = screenEl(`
      <header class="topbar !pb-3">
        <div class="flex items-center justify-between">
          <button class="iconbtn -ml-2" id="fo-back">${icon('back')}</button>
          <div class="flex items-center gap-1.5 text-chalk-3">${folder.public ? icon('globe') : icon('lock')}<span class="label">${folder.public ? 'Публичная' : 'Приватная'}</span></div>
          <button class="iconbtn -mr-2" id="fo-more">${icon('more')}</button>
        </div>
        <h1 class="font-display text-[28px] font-medium mt-2">${folder.name}</h1>
        <div class="text-chalk-3 text-sm">${climbs.length} ${plural(climbs.length, ['трасса', 'трассы', 'трасс'])}</div>
      </header>
      <div class="px-5 pb-24">
        ${climbs.map(c => `<div class="log-row"><div class="log-name">${c.name}</div><div class="log-grade">${c.font}</div></div>`).join('')}
      </div>
    `);
    $('#fo-back', screen).addEventListener('click', popScreen);
    $('#fo-more', screen).addEventListener('click', () => toast('Меню папки — скоро'));
    return screen;
  }

  /* ---- NOTIFICATIONS (moved out of the bottom bar) ---------------------- */
  const NOTE_ICON = { like: 'heart', comment: 'comment', follow: 'userPlus', route: 'mountain', system: 'info' };
  function buildNotifications() {
    const screen = screenEl(`
      <header class="topbar !pb-3">
        <div class="flex items-center justify-between">
          <button class="iconbtn -ml-2" id="n-back">${icon('back')}</button>
          <div class="font-display text-lg font-medium">Уведомления</div>
          <button class="iconbtn -mr-2" id="n-read" aria-label="Прочитать всё">${icon('check')}</button>
        </div>
      </header>
      <div class="pb-24" id="n-list">
        ${NOTIFICATIONS.map((n, i) => `<div class="note reveal" style="--i:${i}">
          <span class="note-ic note-ic--${n.kind}">${icon(NOTE_ICON[n.kind] || 'bell')}</span>
          <div class="note-main"><div class="note-text"><b>${n.who}</b> ${n.text}</div><div class="note-when">${n.when}</div></div>
        </div>`).join('')}
      </div>
    `);
    $('#n-back', screen).addEventListener('click', popScreen);
    $('#n-read', screen).addEventListener('click', () => { document.querySelector('.prof-bell-dot') && (document.querySelector('.prof-bell-dot').style.display = 'none'); toast('Всё прочитано'); });
    return screen;
  }

  function buildPlaceholder(title, sub, iconName) {
    const screen = screenEl(`<div class="placeholder"><span>${icon(iconName)}</span>
      <h2 class="flourish">${title}</h2><p class="text-sm max-w-[240px]">${sub}</p></div>`);
    return screen;
  }

  /* ---- SHEETS ----------------------------------------------------------- */
  function openSheet(innerHTMLStr, onMount) {
    sheetRoot.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet"><div class="sheet-grip"></div>${innerHTMLStr}</div>`;
    sheetRoot.classList.add('is-open');
    sheetRoot.setAttribute('aria-hidden', 'false');
    const sheet = $('.sheet', sheetRoot);
    $('.sheet-backdrop', sheetRoot).addEventListener('click', closeSheet);
    // swipe-down to dismiss via the grip area
    let sy = 0, sd = 0, dragging = false;
    const grip = $('.sheet-grip', sheetRoot);
    grip.style.touchAction = 'none';
    grip.addEventListener('pointerdown', (e) => { dragging = true; sy = e.clientY; sheet.style.transition = 'none'; grip.setPointerCapture(e.pointerId); });
    grip.addEventListener('pointermove', (e) => { if (!dragging) return; sd = Math.max(0, e.clientY - sy); sheet.style.transform = `translateY(${sd}px)`; });
    grip.addEventListener('pointerup', () => { dragging = false; sheet.style.transition = ''; if (sd > 90) closeSheet(); else sheet.style.transform = ''; sd = 0; });
    if (onMount) onMount(sheet);
  }
  function closeSheet() {
    sheetRoot.classList.remove('is-open');
    sheetRoot.setAttribute('aria-hidden', 'true');
    setTimeout(() => { if (!sheetRoot.classList.contains('is-open')) sheetRoot.innerHTML = ''; }, 500);
  }

  function openAngle() {
    openSheet(`<div class="label mb-1">Угол наклона</div>
      <div class="font-display text-2xl mb-3">Выбери градус</div>
      <div class="angle-track" id="angle-track">
        ${ANGLES.map(a => `<button class="angle-opt ${a === state.angle ? 'is-on' : ''}" data-a="${a}">${a}°</button>`).join('')}
      </div>`, (sheet) => {
      const on = $('.angle-opt.is-on', sheet);
      if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
      sheet.querySelectorAll('.angle-opt').forEach(b => b.addEventListener('click', () => {
        state.angle = parseInt(b.dataset.a, 10);
        sheet.querySelectorAll('.angle-opt').forEach(x => x.classList.toggle('is-on', x === b));
        document.querySelectorAll('.anglepill').forEach(p => p.innerHTML = `${state.angle}<sup>°</sup>`);
        setTimeout(closeSheet, 220);
      }));
    });
  }

  function openSort() {
    openSheet(`<div class="label mb-1">Сортировка</div><div class="font-display text-2xl mb-4">Порядок трасс</div>
      <div class="flex flex-col gap-2">
        ${Object.entries(SORT_LABELS).map(([k, v]) => `<button class="chip !text-left !text-base !py-3.5 ${k === state.sort ? 'is-on' : ''}" data-s="${k}">${v}</button>`).join('')}
      </div>`, (sheet) => {
      sheet.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => {
        state.sort = b.dataset.s;
        if (rootEl) renderList(rootEl);
        closeSheet();
      }));
    });
  }

  function openFilters() {
    const V = Array.from({ length: 11 }, (_, i) => i); // V0..V10
    const f = state.filters;
    openSheet(`
      <div class="flex items-center justify-between mb-1">
        <div class="label">Фильтры</div>
        <button class="label active:opacity-60" id="f-reset">Сбросить</button>
      </div>
      <div class="font-display text-2xl mb-4">Подбор трасс</div>

      <div class="label mb-2">Категория от</div>
      <div class="flex flex-wrap gap-2 mb-4" id="f-min">
        ${V.map(v => `<button class="chip ${v === f.vMin ? 'is-on' : ''}" data-v="${v}">V${v}</button>`).join('')}
      </div>
      <div class="label mb-2">Категория до</div>
      <div class="flex flex-wrap gap-2 mb-4" id="f-max">
        ${V.map(v => `<button class="chip ${v === f.vMax ? 'is-on' : ''}" data-v="${v}">V${v}</button>`).join('')}
      </div>
      <div class="label mb-2">Минимум звёзд</div>
      <div class="flex gap-2 mb-6" id="f-stars">
        ${[0, 1, 2, 3].map(s => `<button class="chip ${s === f.minStars ? 'is-on' : ''}" data-s="${s}">${s === 0 ? 'Любые' : s + '★'}</button>`).join('')}
      </div>
      <button class="btn btn--primary w-full" id="f-done">Показать трассы</button>
    `, (sheet) => {
      const live = () => { if (rootEl) renderList(rootEl); };
      const single = (container, attr, apply) => {
        $(container, sheet).querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
          $(container, sheet).querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x === b));
          apply(parseInt(b.dataset[attr], 10)); live();
        }));
      };
      single('#f-min', 'v', v => { f.vMin = v; if (f.vMax < v) f.vMax = v; sheet.querySelectorAll('#f-max button').forEach(x => x.classList.toggle('is-on', +x.dataset.v === f.vMax)); });
      single('#f-max', 'v', v => { f.vMax = v; if (f.vMin > v) f.vMin = v; sheet.querySelectorAll('#f-min button').forEach(x => x.classList.toggle('is-on', +x.dataset.v === f.vMin)); });
      single('#f-stars', 's', s => { f.minStars = s; });
      $('#f-reset', sheet).addEventListener('click', () => { f.vMin = 0; f.vMax = 10; f.minStars = 0; live(); closeSheet(); });
      $('#f-done', sheet).addEventListener('click', closeSheet);
    });
  }

  function openBoardSwitch() {
    const boards = [
      ['Big Wall Sport', '12 × 12 · 488 зацепов', true],
      ['Домашняя 8×10', '8 × 10 · 240 зацепов', false],
      ['Spray Wall', 'свободная раскладка', false],
    ];
    openSheet(`<div class="label mb-1">Доски</div><div class="font-display text-2xl mb-4">Сменить доску</div>
      <div class="flex flex-col gap-2">
        ${boards.map(([n, s, on]) => `<button class="text-left p-4 rounded-2xl flex items-center justify-between transition active:scale-[.98]" data-on="${on}"
            style="border:1px solid var(${on ? '--line-2' : '--line'});background:var(${on ? '--ink-3' : '--ink-2'})">
            <span><span class="font-display text-lg block">${n}</span><span class="text-chalk-3 text-[13px]">${s}</span></span>
            ${on ? `<span style="color:var(--start)">${icon('check')}</span>` : ''}</button>`).join('')}
      </div>`, (sheet) => {
      sheet.querySelectorAll('[data-on]').forEach(b => b.addEventListener('click', () => { closeSheet(); if (b.dataset.on !== 'true') toast('Подключение других досок — скоро'); }));
    });
  }

  /* ---- TAB BAR ---------------------------------------------------------- */
  const TABS = [
    ['boards', 'boards', 'Трассы', () => buildHome()],
    ['profile', 'user', 'Профиль', () => buildProfile()],
    ['more', 'ellipsis', 'Ещё', () => buildPlaceholder('Настройки', 'Подключение доски, светодиоды и аккаунт — в разработке.', 'ellipsis')],
  ];

  function renderTabs() {
    tabbarEl.innerHTML = TABS.map(([key, ic, lbl]) =>
      `<button class="tab ${key === state.tab ? 'is-active' : ''}" data-tab="${key}">${icon(ic)}<span>${lbl}</span></button>`).join('');
    tabbarEl.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  }

  function switchTab(key) {
    if (key === state.tab && !overlay.length) return;
    state.tab = key;
    renderTabs();
    const def = TABS.find(t => t[0] === key);
    setRoot(def[3]);
  }

  /* ---- init ------------------------------------------------------------- */
  renderTabs();
  setRoot(buildHome);

  // optional deep link: index.html#c=3 opens that climb straight away
  const dl = location.hash.match(/c=(\d+)/);
  if (dl) requestAnimationFrame(() => openClimb(parseInt(dl[1], 10)));
})();
