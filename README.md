# 37-board — Project Notes

> Этот файл — конспект проекта для Claude Code. Обновляй его по итогам каждого сеанса.

---

## Что это

Мобильное веб-приложение для скалолазов: трекер трасс боулдеринг-зала.  
Single-page app, vanilla JS + HTML + CSS. Работает в браузере как PWA-like интерфейс с tab-bar внизу.

**Live:** https://dunaevmakseg.github.io/37-board/  
**Репо:** https://github.com/dunaevmakseg/37-board

---

## Стек

- Vanilla JS (ES6, без фреймворков)
- CSS с Tailwind utility-классами (подключён через CDN или встроен)
- Хранилище — `localStorage`
- Иконки — кастомный SVG-набор в `icons.js`
- Деплой — GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`)

---

## Файлы проекта

```
d:\37\
├── index.html              — точка входа
├── app.js                  — вся логика (экраны, состояние, рендер)
├── data.js                 — данные: GRADE_SCALE, LOGBOOK, FOLDERS
├── icons.js                — SVG-иконки (window.ICONS)
├── styles.css              — все стили
├── panel.js                — Theme Studio (отдельная панель настройки тем)
└── social-icons/
    ├── tg_account.png      — иконка Telegram аккаунта (64×64px)
    └── tg_channel.png      — иконка Telegram канала (64×64px)
```

---

## Архитектура app.js

### Навигация
- `pushScreen(builderFn)` / `popScreen()` — стек экранов
- `screenEl(html)` — создаёт DOM-элемент экрана из HTML-строки
- `$('#id', scope)` — querySelector с опциональным scope

### Табы
```js
const TABS = [
  ['boards', 'boards', 'Трассы',  () => buildHome()],
  ['profile','user',  'Профиль', () => buildProfile()],
  ['more',   'ellipsis','Ещё',   () => buildPlaceholder(...)],
];
```

### Профиль
- Состояние: `profileState` + `profileData` (сохраняется в localStorage под ключом `board37.profile`)
- `DEFAULT_PROFILE` — дефолтные значения (name, username, status, avatar, bg, followers, following, socials)
- `saveProfile()` — пишет в localStorage
- `buildProfile()` — строит экран профиля
- `renderProfileList(scope)` — рендерит список трасс / коллекций / трасс коллекции

---

## Экран профиля — текущее состояние

### Шапка (prof-cover)
- Высота: **120px** (было 150px, уменьшена чтобы убрать пустое пространство над аватаркой)
- **Колокольчик** (`.prof-bell`) — top:14px right:14px, ведёт на `buildNotifications`
- **Кнопка-кисточка** (`.prof-brush`) — top:62px right:14px, **z-index:3** (важно! без этого перекрывается `.prof-id`)
- **Кнопка «Фон»** (`.prof-coverbtn`) — top:14px right:62px, скрыта вне режима редактирования

### Анимации при входе в режим редактирования
- Колокольчик: `opacity → 0` (fade out)
- Кисточка: `top: 62px → 14px` (переезжает на место колокольчика, spring transition)
- Кнопка «Фон»: `translateX(50px) → 0` (вылетает слева от галочки, spring transition)
- Всё через CSS-класс `.is-edit` на элементе `.screen`
- При выходе — анимации вспять

### Блок prof-id (аватарка + инфо)
- `margin-top: -50px` — перекрывает шапку
- **`.prof-avatar-row`** — flex row, `align-items: center`:
  - Аватарка 90×90px слева
  - `.prof-stats` справа: кнопки «подписчики» (248) и «подписки» (31)
    - `font-size: 28px` для чисел
    - Клик → `buildUserList('followers'/'following', count)` — список с mock-данными
- Ниже: имя, @username, статус

### Режим редактирования (`.is-edit`)
- Кисточка → галочка, на галочку → сохранение
- Все поля получают `contenteditable="plaintext-only"` + рамку (`box-shadow: 0 0 0 1.5px`)
- **Защита `@` в username**: keydown блокирует Backspace/Delete у позиции ≤1; input-хук восстанавливает `@` если исчез
- Валидация при сохранении: имя и username не могут быть пустыми (восстанавливаются); статус — может
- Аватарка кликабельна только в edit-mode → pickImage → FileReader → data URL → localStorage
- Кнопка «Фон» — аналогично

### Строка юзернейма + соцсети
```html
<div class="prof-social-row">           <!-- flex, space-between -->
  <div class="prof-user" id="p-user">   <!-- @username, редактируемый в edit-mode -->
  <div class="prof-socials" id="p-socials"> <!-- иконки соцсетей справа -->
```
- **SOCIAL_NETS** — конфиг соцсетей:
  ```js
  const SOCIAL_NETS = {
    tg_account: { icon: 'social-icons/tg_account.png', url: 'https://t.me/' },
    tg_channel: { icon: 'social-icons/tg_channel.png', url: 'https://t.me/' },
  };
  ```
- Текущие ссылки в `profileData.socials`:
  - `{ type: 'tg_account', handle: 'Yeeblane1337' }` → https://t.me/Yeeblane1337
  - `{ type: 'tg_channel', handle: 'BWchild' }`      → https://t.me/BWchild
- Иконки 26×26px, `border-radius: 999px`, `target="_blank"`
- Чтобы добавить новую соцсеть: положить иконку в `social-icons/`, добавить запись в `SOCIAL_NETS`, добавить в `profileData.socials`

---

## Диаграмма категорий (chartBars)

### Алгоритм оси Y
```
M = max(GRADE_COUNTS)
if M === 0      → N = 5
if M >= 50      → N = ceil(M/10)*10   (кратное 10)
else            → N = ceil(M/5)*5     (кратное 5)
step = N / 5
```
Метки на оси: `0, step, 2*step, 3*step, 4*step, N` (6 штук)

### Структура HTML
```html
<div class="chart">                         <!-- flex row -->
  <div class="chart-yaxis">                 <!-- position:relative, h:84px, margin-bottom:18px -->
    <span class="chart-ylabel" style="bottom:X%"> <!-- абсолютно позиционированы -->
  </div>
  <div class="chart-body">                  <!-- flex, align-items:flex-end -->
    <div class="chart-gridlines">           <!-- position:absolute, bottom:18px, h:84px -->
      <div class="chart-gridline" style="bottom:X%">
    </div>
    <div class="bar-col"> × N_grades        <!-- bar-track (84px) + bar-lbl -->
  </div>
</div>
```
- Выравнивание меток оси: `transform: translateY(50%)` при `bottom: X%` → центр метки = линия сетки ✓
- Высота баров: `(cnt / N) * 100%`
- Если `cnt === 0` — столбик не рендерится (пустой bar-track)

---

## Коллекции (бывшие «Папки»)

### Состояние
```js
profileState = { view: 'all'|'folders'|'folder', folderIdx: null|N, ... }
```

### Поведение seg-контрола
| view | кнопка 1 | кнопка 2 |
|------|----------|----------|
| `'all'` | **Все трассы** ● | Коллекции |
| `'folders'` | Все трассы | **Коллекции** ● |
| `'folder'` | Все трассы | **Коллекция → Название** ● |

- Клик по «Коллекция → Название» → возврат к списку коллекций (`view='folders'`)
- Клик по коллекции в списке → `view='folder'`, `folderIdx=N` → рендер трасс коллекции на месте (без pushScreen)
- Клик «Все трассы» → `view='all'`, `folderIdx=null`

### Обновление сега
`renderProfileList(scope)` при каждом вызове синкает кнопки и видимость sort-controls:
```js
const btn2 = $('#p-seg-col', scope);
btn2.innerHTML = activeFolder
  ? `<span class="seg-col-pre">Коллекция</span><span class="seg-col-arr">→</span><span class="seg-col-name">${name}</span>`
  : 'Коллекции';
```

---

## Деплой на GitHub

Git на машине **не установлен**. Деплой через GitHub REST API:

```powershell
$token = "<PAT>"
$repo  = "dunaevmakseg/37-board"
$hdrs  = @{ Authorization = "token $token"; Accept = "application/vnd.github.v3+json"; "User-Agent" = "PS" }

function Push-File($localPath, $repoPath) {
  $content = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($localPath))
  $sha = $null
  try { $sha = (Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/contents/$repoPath" -Headers $hdrs).sha } catch {}
  $body = @{ message = "deploy: $repoPath"; content = $content }
  if ($sha) { $body.sha = $sha }
  Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/contents/$repoPath" -Headers $hdrs -Method Put -Body ($body | ConvertTo-Json -Depth 3) -ContentType "application/json" | Out-Null
}

"app.js","data.js","icons.js","index.html","panel.js","styles.css" | ForEach-Object { Push-File "d:\37\$_" $_ }
Push-File "d:\37\social-icons\tg_account.png" "social-icons/tg_account.png"
Push-File "d:\37\social-icons\tg_channel.png" "social-icons/tg_channel.png"
```

GitHub Actions workflow: `.github/workflows/deploy.yml` — деплоит на Pages при пуше в `main`.

---

## Известные особенности / TODO

- `LOGBOOK` и `FOLDERS` в `data.js` сейчас с mock-данными или пустые — реальное добавление трасс через экран «Трассы»
- Followers/Following — mock-данные (248/31), список пользователей тоже mock
- Создание коллекций (`toast('Создание коллекций — скоро')`) — не реализовано
- Редактирование social-ссылок из UI — не реализовано (только через код)
- Git не установлен → деплой скриптом выше с новым PAT-токеном
