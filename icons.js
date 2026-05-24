/* Hand-drawn-ish thin-stroke icon set. All use currentColor + round caps. */
(function () {
  const svg = (paths, extra = '') =>
    `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round" ${extra}>${paths}</svg>`;

  const ICONS = {
    back:   svg('<path d="M15 5 8 12l7 7"/><path d="M8 12h11" opacity=".55"/>'),
    next:   svg('<path d="M9 5l7 7-7 7"/><path d="M16 12H5" opacity=".55"/>'),
    plus:   svg('<path d="M12 5v14M5 12h14"/>'),
    close:  svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    search: svg('<circle cx="11" cy="11" r="6.2"/><path d="M20 20l-4.2-4.2"/>'),
    sliders:svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.1"/><circle cx="8" cy="17" r="2.1"/>'),

    bulb:   svg('<path d="M9.2 17.5h5.6"/><path d="M10 20.5h4"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.5.4.8 1 .8 1.7h5.6c0-.7.3-1.3.8-1.7A6 6 0 0 0 12 3.5Z"/>'),
    check:  svg('<path d="M5 12.5 10 17.5 19.5 6.5"/>'),
    bookmark: svg('<path d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1Z"/>'),
    more:   svg('<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>'),
    info:   svg('<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5"/><path d="M12 8h.01"/>'),
    camera: svg('<path d="M4.5 8.5h2.2l1.2-1.8h6.2l1.2 1.8h2.2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.1"/>'),

    /* tab bar */
    boards: svg('<path d="M5 4v16M19 4v16"/><path d="M5 8h14M5 16h14" opacity=".55"/><path d="M14.5 9.5a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Z"/><path d="M14 9.6l-2.6 2.2 1.4 1.6-1 3.2M11.4 11.8 8.6 11"/>'),
    bell:   svg('<path d="M6.5 16.5c.8-1 1-2 1-3.3V11a4.5 4.5 0 0 1 9 0v2.2c0 1.3.2 2.3 1 3.3Z"/><path d="M10 19.5a2 2 0 0 0 4 0"/>'),
    user:   svg('<circle cx="12" cy="8.6" r="3.6"/><path d="M5.5 19.5a6.6 6.6 0 0 1 13 0"/>'),
    ellipsis: svg('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'),

    mountain: svg('<path d="M3 19.5 9.5 7l3.2 5.6 2-3 6.3 9.9Z"/><path d="m8 13 1.6-1.6L11 13" opacity=".5"/>'),
    sort:   svg('<path d="M7 5v14M7 19l-2.5-2.6M7 19l2.5-2.6"/><path d="M17 19V5M17 5l-2.5 2.6M17 5l2.5 2.6" opacity=".6"/>'),
    flag:   svg('<path d="M6 21V4"/><path d="M6 5h10l-2 3 2 3H6" opacity=".9"/>'),
    chevronDown: svg('<path d="m6 9 6 6 6-6"/>'),
    lock: svg('<rect x="5" y="10.5" width="14" height="9" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
    globe: svg('<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4M12 3.8c2.3 2.2 3.4 5.2 3.4 8.2s-1.1 6-3.4 8.2c-2.3-2.2-3.4-5.2-3.4-8.2S9.7 6 12 3.8Z"/>'),
    brush: svg('<path d="M3.5 20.5c0-2.5 2-3 2.5-5.5"/><path d="M6 15C8.5 10.5 16 4.5 21 3c-1.5 5-7 11-12.5 13.5L6 15Z"/><path d="M8.5 12.5C10.5 10 14 7.5 16 6.5" opacity=".35"/>'),
  };

  // notifications
  ICONS.heart = svg('<path d="M12 20.3 4.8 13.1a4.6 4.6 0 0 1 6.5-6.5l.7.7.7-.7a4.6 4.6 0 0 1 6.5 6.5Z"/>');
  ICONS.comment = svg('<path d="M5 6h14a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H9.5L5.5 19v-3.5H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/>');
  ICONS.userPlus = svg('<circle cx="9.5" cy="8.4" r="3.3"/><path d="M4 19a5.6 5.6 0 0 1 11 0"/><path d="M18.5 8v6M15.5 11h6"/>');

  // hold-role icons (rendered inside a coloured circle in the route builder)
  const roleSvg = (inner, sw = 1.7) =>
    `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  ICONS.roleStart = roleSvg('<path d="M12 19V6.5"/><path d="M6.5 11 12 5.5 17.5 11"/>', 2.1);
  ICONS.roleHand = roleSvg('<path d="M8.5 11V6.1a1.15 1.15 0 0 1 2.3 0v3.6m0 0V4.9a1.15 1.15 0 0 1 2.3 0v4.8m0 0V5.9a1.15 1.15 0 0 1 2.3 0v5.1m0-2a1.15 1.15 0 0 1 2.3 0v4.7c0 3.2-2.1 5.4-5.3 5.4-1.8 0-2.9-.6-4-2L6.2 14a1.2 1.2 0 0 1 1.85-1.5l1.55 1.6"/>', 1.5);
  ICONS.roleFoot = `<svg class="ic" viewBox="0 0 24 24" fill="currentColor" stroke="none"><ellipse cx="10.2" cy="14" rx="3.5" ry="5.2"/><circle cx="15" cy="9.4" r="1.5"/><circle cx="16.7" cy="11.9" r="1.25"/><circle cx="16.9" cy="14.6" r="1.1"/><circle cx="15.7" cy="16.9" r="1"/></svg>`;
  ICONS.roleFinish = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.4 4.5v15"/><rect x="8" y="5" width="9.2" height="8.2" rx="0.6"/><g fill="currentColor" stroke="none"><rect x="8" y="5" width="4.6" height="4.1"/><rect x="12.6" y="9.1" width="4.6" height="4.1"/></g></svg>`;
  ICONS.ROLE = { start: ICONS.roleStart, hand: ICONS.roleHand, foot: ICONS.roleFoot, finish: ICONS.roleFinish };

  ICONS.star = (on) =>
    `<svg viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor"
        stroke-width="1.3" stroke-linejoin="round" class="${on ? 'star-on' : 'star-off'}">
      <path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8Z"/></svg>`;

  window.ICONS = ICONS;
})();
