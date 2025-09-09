import photos from '../data/photos.json' with { type: 'json' };
import { isFavorite, toggleFavorite, getFavoritesCount } from './favoritesStore.js';
import { initSearchAndSort, applySearchState, getSearchState, scrollToTopSmooth } from './utils/initSearchAndSort.js';
import { mapPhotos } from './utils/mapPhotos.js';

// ========== ПОДГОТОВКА ДАННЫХ ==========
const photosData = mapPhotos(photos);
export let currentPhotos = [...photosData];

// Ленивый рендер (paging) — разбиваем контент на страницы по PAGE_SIZE картчоек
export const paging = {
  PAGE_SIZE: 18,
  visibleCount: Math.min(18, photosData.length),
};

// Публичный сеттер (обновляем список + сбрасываем пагинацию)
// list — новый массив карточек
// options — объект с настройками
export function setCurrentPhotos(list, options = {}) {
  // Достаем флаг preserveVisible из объекта опций (решает, сбрасывать ли количество видимых карточек или нет)
  const { preserveVisible = false } = options;

  currentPhotos = Array.isArray(list) ? list : [];
  
  // Считаем, сколько карточек показывать
  paging.visibleCount = preserveVisible

    // Если preserveVisible = true — оставляем столько, сколько было
    ? Math.min(paging.visibleCount, currentPhotos.length)

    // Если false → показываем PAGE_SIZE
    : Math.min(paging.PAGE_SIZE, currentPhotos.length);

    // Перерисовываем галерею
  updateView();
}

// Выезд сортбара (тест)
const header  = document.getElementById('siteHeader');
const sortBar = document.getElementById('sortBar');

const docEl = document.documentElement;
const setCss = (k,v)=>docEl.style.setProperty(k, v+"px");
const h = ()=> header?.offsetHeight || 72;
const s = ()=> sortBar?.offsetHeight || 48;

function measureAll() { 
  setCss('--header-h', h()); 
  setCss('--sort-h', s()); 
}

addEventListener('load',  measureAll);

addEventListener('resize', measureAll);

if (header) new ResizeObserver(measureAll).observe(header);

if (sortBar) new ResizeObserver(measureAll).observe(sortBar);

let lastY = scrollY;
let rafId = null;
let visible = null;
let initialLock = true;
let isRestoring = false;
let savedInitialVisible = null;
let skipNextSave = false;
let restoredVisibility = null;

const SHOW_DELAY = 40;
const HIDE_DELAY = 50;
const COOLDOWN   = 200;
const DELTA_PX   = 4;
let tShow = 0, tHide = 0, until = 0;

function setSortVisible(v){
  if (visible === v) return;
  sortBar.classList.toggle('is-visible', v);
  visible = v;
  applyEdge();
  applyBlendState();
}

function setVisibleDebounced(v){
  if (initialLock) {
    setSortVisible(v);
    return;
  }

  const now = performance.now();
  if (now < until) return;

  clearTimeout(v ? tHide : tShow);
  const id = setTimeout(() => {
    setSortVisible(v);
    until = performance.now() + COOLDOWN;
  }, v ? SHOW_DELAY : HIDE_DELAY);

  v ? (tShow = id) : (tHide = id);
}

function applyBlendState(){
  const scrolled300 = scrollY >= 300;
  document.body.classList.toggle('bar-hidden', visible === false);
  document.body.classList.toggle('sort-visible',  visible === true); // важно
  document.body.classList.toggle('scrolled-300', scrolled300);
}

function applyEdge(){
  if (!sortBar) return;
  const scrolled300 = scrollY >= 300;
  const edge = (visible === true) && !scrolled300;
}

if (sortBar) {
  sortBar.classList.add('boot');

  clearTimeout(tShow);
  clearTimeout(tHide);
  tShow = tHide = 0;
  until = performance.now() + COOLDOWN;
}

const forceShowOnBoot = sessionStorage.getItem('forceSortVisible') === '1';

// Изначально отображаем сортбар всегда
(function applyInitialSortBarVisibility(){
  const state = readSavedState();
  if (!sortBar) return;

  const hasResults = () => Array.isArray(currentPhotos) && currentPhotos.length > 0;

  let initial;
  if (forceShowOnBoot) {
    initial = true;
    try {
      sessionStorage.removeItem('forceSortVisible');
    } catch {}
  } else {
    initial = (state && typeof state.sortBarVisibility === 'boolean')
      ? state.sortBarVisibility
      : (scrollY < 40);
  }
  
  savedInitialVisible = initial && hasResults;
  setSortVisible(savedInitialVisible);
})();

measureAll();

// Видимость сортбара в зависимости от наличия результатов
function updateSortBarVisibility() {
  if (!sortBar) return;
  const hasResults = currentPhotos.length > 0;

  sortBar.classList.toggle('is-hidden', !hasResults);

  if (!hasResults) {
    setSortVisible(false);
  } else if (restoredVisibility !== null) {
    setSortVisible(restoredVisibility);
  } else {
    const should = initialLock 
      ? savedInitialVisible
      : ((scrollY < 40) || (visible === true))
    setSortVisible(!!should);
    applyBlendState();
  }

  measureAll();
}

// DOM
const grid = document.querySelector('.grid');
const loadMoreBtn = document.querySelector('.load-more-btn');
const input = document.querySelector('.input-section');
const clearBtn = document.querySelector('.clear-btn');
const mid = document.querySelector('.header-middle');

// ========== РЕНЕДЕР ГАЛЕРЕИ ==========
function renderGallery(photosData) {
  if (!grid) return;

  // Генерируем HTML для всех карточек
  const cardsHTML = photosData.map(card => {
    const isFav = isFavorite(card.id);

    return `
      <a class="card-link" href="photo.html?id=${card.id}">
        <article class="card" data-id="${card.id}">
          <div class="card-media">
            <img class="card-photo" src="${card.thumb}">
          </div>

          <button
            class="card-like-button ${isFav ? 'is-fav' : ''}" 
            data-fav-id="${card.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#292929ff" viewBox="0 0 256 256">
              <path d="M240,98a57.63,57.63,0,0,1-17,41L133.7,229.62a8,8,0,0,1-11.4,0L33,139a58,58,0,0,1,82-82.1L128,69.05l13.09-12.19A58,58,0,0,1,240,98Z"></path>
            </svg>
          </button>

          <div class="card-content">
            <div class="card-meta">
              <p class="card-photo-title">${card.location || ''}</p>
              <p class="card-photo-year">${card.year || ''}</p>
            </div>
          </div>
        </article>
      </a>
    `;
  }).join('');

  grid.innerHTML = cardsHTML;
}

// Рендер с учетом visibleCount
export function updateView() {
  const slice = currentPhotos.slice(0, paging.visibleCount);
  renderGallery(slice);;

  if (loadMoreBtn) {
    loadMoreBtn.hidden = (paging.visibleCount >= currentPhotos.length);
  }

  if (sortBar && sortBar.classList.contains('boot') && !isRestoring) {
    releaseInitialLock();
    requestAnimationFrame(updateSortBarVisibility);
    return;
  }

  updateSortBarVisibility();

  requestAnimationFrame(() => {
    refreshScrollability();
    const gridEl = document.querySelector('.grid');
    waitGridImagesLoaded(gridEl, 1200).then(refreshScrollability);
});
}

// Обработчик "Показать еще"
if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => {
    paging.visibleCount = Math.min(
      paging.visibleCount + paging.PAGE_SIZE,
      currentPhotos.length
    );
    updateView();

    try {
      const { query } = getSearchState();
      const key = query ? 'visibleSearch' : 'visibleAll';
      sessionStorage.setItem(key, String(paging.visibleCount));
    } catch {}
  });
}

updateView();

// ========== ПОИСК И СОРТИРОВКА ==========
// Вызываем основную логику с опицей авто-ренедра
initSearchAndSort(photosData, { autoRender: false });

// Читаем параметры из URL
const params = new URLSearchParams(location.search);
const urlQ = (params.get('q') || '').trim();
const urlSort = (params.get('sort') || '').trim();
const urlShuffle = params.has('shuffle') || '';

// Флаг для полного сброса всех состояний
const forceReset = sessionStorage.getItem('forceReset') === '1';
if (forceReset) {
  sessionStorage.removeItem('forceReset');
}

// Если поступил запрос с другой страницы, он — приоритетный
if (!forceReset && restoreState()) {
  // Все восставновили — выходим
} else if (urlQ || urlSort || urlShuffle) {
  // Иначе — применяем фильтры из URL
    applySearchState(
    {
      query: urlQ,
      sort: urlShuffle ? '' : urlSort,
      isShuffle: urlShuffle,
      shuffleOrder: []
    },
    { preserveVisible: false }
  );
// Иначе — пытаемся восстановить состояние из sessionStorage/history
} else {
  // Флаг: включать ли перемешивание при первой загрузке
  const AUTO_SHUFFLE_ON_LOAD = true;

  // Если флаг перемешивания = true
  if (AUTO_SHUFFLE_ON_LOAD) {
    //  Вызываем applySearchState в флагом перемешивания = true
    applySearchState({ isShuffle: true });
  } else {
    applySearchState({});
  }
}

// Обработчик добавления в избранное
if (grid) {
  grid.addEventListener('click', (event) => {
    const btn = event.target.closest('.card-like-button');
    if (!btn) return;
    event.preventDefault();
    const id = btn.dataset.favId;
    toggleFavorite(id);
    btn.classList.toggle('is-fav', isFavorite(id));
  });
}

// ========== ИЗБРАННОЕ ==========
const favCountEl = document.getElementById('favCount');
const favLinkEl = document.querySelector('.fav-btn');

function bump(el){
  el.classList.remove('is-updating');
  el.offsetWidth;
  el.classList.add('is-updating');
}

function renderFavCount() {
  if(!favCountEl || !favLinkEl) return;

  const n = getFavoritesCount();

  if (n === 0) {
    favCountEl.textContent = '';
    favLinkEl.classList.remove('has-count');
    favLinkEl.setAttribute('aria-label', 'Избранное, нет фото');
  } else {
    const shown = n > 99 ? '99+' : String(n);
    const prev = favCountEl.textContent;

    favLinkEl.classList.add('has-count');
    favCountEl.textContent = shown;
    favLinkEl.setAttribute('aria-label', `Избранное, ${shown} фото`);

    if (prev !== shown) bump(favCountEl);
  }
}

renderFavCount();

window.addEventListener('favorites:changed', renderFavCount);

window.addEventListener('storage', (e) => {
  if (e.key === 'provatorov:favorites') renderFavCount();
});

window.addEventListener('pageshow', () => {
  // перерисуем счётчик и уберём фокус с кнопки
  renderFavCount();
  if (document.activeElement === favLinkEl) favLinkEl.blur();
});

document.addEventListener('mousedown', (e) => {
  const a = e.target.closest('.fav-btn');
  if (a) a.blur();
});

requestAnimationFrame(() => {
    document.documentElement.classList.add('html-blur-ready');
  });

requestAnimationFrame(() => {
  favLinkEl?.classList.add('is-ready');
});

// ========== ПОИСК ==========

function sync() {
  const wrap = input.closest('.input-wrap');
  if (wrap) wrap.classList.toggle('has-value', !!input.value);
}

const expand = () => mid?.classList.add('is-expanded');
const collapse = () => { input.blur(); mid?.classList.remove('is-expanded'); };

let _clearingProgrammatically = false;

function doClear() {
  _clearingProgrammatically = true;
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  _clearingProgrammatically = false;

  sync();

  const url = new URL(location.href);
  url.searchParams.delete('q');
  history.replaceState(history.state, '', url);

  collapse();
  scrollToTopSmooth();
}

input.addEventListener('focus', expand);
input.addEventListener('blur', () => { if (!input.value) collapse(); });

input.addEventListener('input', () => {
  if (!mid.classList.contains('is-expanded')) expand();
  sync();

  if (!_clearingProgrammatically && input.value === '') {
    doClear();
  }
});

clearBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  doClear();
});

clearBtn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doClear(); }
});

input.addEventListener('input', sync);
sync();

const SCROLL_IDLE_MS = 200;
let collapsedThisBurst = false;
let collapseTimer = 0;
const SCROLL_EPS = 12;
let canScroll = false;
const KEEP_WHEN_HAS_QUERY = false;

function refreshScrollability() {
  const doc = document.documentElement;
  canScroll = (doc.scrollHeight - doc.clientHeight) > SCROLL_EPS;
  doc.classList.toggle('can-scroll', canScroll);
}

function onScrollStartCollapse(e) {
  if (!canScroll) return;
  if (collapsedThisBurst) return;
  if (KEEP_WHEN_HAS_QUERY && input.value) return;

  const isPointerScroll  = e?.type === 'wheel' || e?.type === 'touchmove';
  const startedInsideInp = !!e?.target?.closest?.('.input-wrap');

  if (isPointerScroll && !startedInsideInp) {
    doCollapseBurst();
    return;
  }

  if (document.activeElement === input) return;

  doCollapseBurst();
}

function doCollapseBurst() {
  if (mid?.classList.contains('is-expanded')) collapse();
  collapsedThisBurst = true;
  clearTimeout(collapseTimer);
  collapseTimer = setTimeout(() => (collapsedThisBurst = false), SCROLL_IDLE_MS);
}


window.addEventListener('wheel', onScrollStartCollapse, { passive: true });
window.addEventListener('touchmove', onScrollStartCollapse, { passive: true });
addEventListener('load',  refreshScrollability);
addEventListener('resize', refreshScrollability);

window.addEventListener('keydown', (e) => {
  const keys = ['PageDown', 'PageUp', 'Home', 'End', ' ', 'ArrowDown', 'ArrowUp'];
  if (keys.includes(e.key) && e.target !== input) onScrollStartCollapse();
});

// ========== Typewriter ==========
const searchExamples = [
  'Алтай, лето, день...',
  'Алтай, лето, день...',
  'Алтай, лето, день...'
];

let typingTimer = null;
let twTarget = '';
let twRunning = false;

export function runSearchPlaceholderTypewriter({
  inputSelector = '.input-section',
  typeDelay = 70,
  startDelay = 400
} = {}) {
  const input = document.querySelector(inputSelector);
  if (!input) return;

  const pickRandom = () => searchExamples[Math.floor(Math.random() * searchExamples.length)];

  const saved = readSavedState();
  if (saved?.placeholderText) {
    input.placeholder = saved.placeholderText;
    return;
  }

  function clearTimer() {
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = null;
  }

  function type(i = 0) {
    if (i === 0) {
      input.placeholder = '';
      twRunning = true;
    }
    if (i < twTarget.length) {
      input.placeholder = twTarget.slice(0, i + 1);
      typingTimer = setTimeout(() => type(i + 1), typeDelay);
    } else {
      clearTimer();
      twRunning = false;
      saveState();
    }
  }

  clearTimer();
  if (!input.value) {
    twTarget = pickRandom(); 
    setTimeout(() => type(0), startDelay);
  }
}

window.addEventListener('load', () => {
  runSearchPlaceholderTypewriter();
});


window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  if (input.value) {
    e.preventDefault();
    doClear();
  } else {
    collapse();
    scrollToTopSmooth();
  }
});

// ========== СОСТОЯНИЕ СТРАНИЦЫ ==========
// Меняем режим пролистыания страницы на ручной
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Достаем сохраненное состояние
function readSavedState() {
  try {
    // Берем из истории браузера или из sessionStorage
    return history.state || JSON.parse(sessionStorage.getItem('galleryState') || 'null') || null;
  } catch {
    return null;
  }
}

// Сохраняем состояние и положение страницы
function saveState() {
  if (skipNextSave || sessionStorage.getItem('forceReset') === '1') return;

  const { query, sort, isShuffle, shuffleOrder } = getSearchState();
  const placeholderText = (twRunning && twTarget) ? twTarget : (input?.placeholder || '');
  const searchExpanded = !!mid?.classList.contains('is-expanded');

  // Собираем состояние и положение страницы
  const state = {
    pageKey: location.pathname,
    visibleCount: paging.visibleCount,
    scrollY: window.scrollY,
    query,
    sort,
    isShuffle,
    shuffleOrder,
    sortBarVisibility: !!visible,
    searchExpanded
  };

  const historyState = { ...state, placeholderText };
  history.replaceState(historyState, '', location.href);

  // Сохраняем в sessionStorage
  sessionStorage.setItem('galleryState', JSON.stringify(state));
}

function waitGridImagesLoaded(container, timeout = 1500) {
  return new Promise(resolve => {
    const imgs = Array.from(container?.querySelectorAll('img') || []);
    if (imgs.length === 0) return resolve();

    let left = imgs.length;
    const done = () => { if (--left <= 0) resolve(); };

    const t = setTimeout(resolve, timeout);
    imgs.forEach(img => {
      if (img.complete) return done();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
  });
}

function releaseInitialLock() {
  if (sortBar) sortBar.classList.remove('boot');
  initialLock = false;
  savedInitialVisible = null;
  restoredVisibility = null;
}

// Восстанавливаем состояние страницы
function restoreState() {
  // Достаем сохраненное состояние из localStorage
  const state = readSavedState();
  if (!state || state.pageKey !== location.pathname) return false;

  restoredVisibility = (typeof state.sortBarVisibility === 'boolean')
    ? state.sortBarVisibility
    : null;

  // Если в state нет фильтров query/sort/shuffle
  const emptyFilters = !state.query && !state.sort && !state.isShuffle;
  if (emptyFilters) {
    isRestoring = false;
    return false;
  }

  isRestoring = true;

  // Если в состоянии есть число visibleCount, обновляем paging.visibleCount
  if (typeof state.visibleCount === 'number') {
    paging.visibleCount = Math.min(state.visibleCount, currentPhotos.length);
  }

  // Применяем сохраненные фильтры
  applySearchState({
    query: state.query || '',
    sort: state.sort || '',
    isShuffle: !!state.isShuffle,
    shuffleOrder: Array.isArray(state.shuffleOrder) ? state.shuffleOrder : []
  });

  if (typeof state.searchExpanded === 'boolean') {
    mid?.classList.toggle('is-expanded', state.searchExpanded);
  }

  if (state.placeholderText && input) {
  input.placeholder = state.placeholderText;
}

  const ySaved = state.scrollY || 0;

  // Переносим пользователя туда, где он был
  requestAnimationFrame(() => {
    const max1 = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.min(ySaved, max1));
  });

  const gridEl = document.querySelector('.grid');
  waitGridImagesLoaded(gridEl).then(() => {
    const max2 = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.min(ySaved, max2));

    isRestoring = false;
    releaseInitialLock();
  });

  // Если все удалось восстановить — возвращаем true, чтобы использовать это значение на главной
  return true;
}

// Слушатель на весь документ
document.addEventListener('click', (event) => {
  if (event.defaultPrevented) return;

  // Ищем ближайший <a>, по которому кликнули
  const link = event.target.closest('a');
  if (!link) return;

  // Будем сохранять состояние страницы только нужных переходов
  try {
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    const isNavToPhotoOrFav = url.pathname.endsWith('/photo.html') || url.pathname.endsWith('/favorites.html');

    // Сохраняем состояние для нужной навигации
    if (isNavToPhotoOrFav) saveState();
  } catch {}
});

// Страхуем состояние, когда пользователь переходит любым другим способом
window.addEventListener('beforeunload', saveState);

// Гарантируем восстановление страницы, если она пришла из кеша
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    restoreState();
  }
});

// Полный сброс всех параметров по логотипу
(function initLogoReset() {
  const logo = document.querySelector('[data-role="logo"]');
  if (!logo) return;

  const isHome = () => {
    const p = location.pathname.replace(/\/+$/, '/');
    return p === '/' || /\/index\.html$/.test(p);
  }

  logo.addEventListener('click', (e) => {
    // Позволяем открыть в новой вкладке
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    location.replace(new URL('index.html', location.origin).toString());

    if (isHome()) {
      e.preventDefault();
      try {
        sessionStorage.clear();
        skipNextSave = true;
      } catch {}

      try {
        history.replaceState(null, '', location.pathname);
      } catch {}
      location.replace(location.pathname);
    }
  });
}());

/* =============== SORT DROPDOWN (rewrite) =============== */
(() => {
  const native  = document.getElementById('sortSelect');       // <select hidden>
  const dd      = document.getElementById('sortDropdown');     // .sort-select
  const trigger = dd.querySelector('.sort-trigger');
  const label   = dd.querySelector('.sort-label');
  const menu    = dd.querySelector('.sort-menu');

  function buildMenu(){
    menu.innerHTML = '';
    [...native.options].forEach(o => {
      if (o.disabled || o.hidden) return;
      const li = document.createElement('li');
      li.className = 'sort-option';
      li.setAttribute('role','option');
      li.dataset.value = o.value;
      li.tabIndex = 0;
      li.textContent = o.textContent;
      if (o.selected) li.setAttribute('aria-selected','true');
      menu.appendChild(li);
    });
    label.textContent = native.selectedOptions[0]?.textContent || 'Сортировать';
  }
  buildMenu();

  const open  = () => { if (!dd.classList.contains('open')) { dd.classList.add('open'); trigger.setAttribute('aria-expanded','true'); requestAnimationFrame(()=>menu.focus?.()); } };
  const close = () => { if (dd.classList.contains('open'))  { dd.classList.remove('open'); trigger.setAttribute('aria-expanded','false'); } };

  trigger.addEventListener('click', () => dd.classList.contains('open') ? close() : open());
  document.addEventListener('click', (e) => { if (!dd.contains(e.target)) close(); });

  menu.addEventListener('click', (e) => {
    const li = e.target.closest('.sort-option'); if (!li) return;
    native.value = li.dataset.value;
    native.dispatchEvent(new Event('change', { bubbles:true }));
    [...menu.children].forEach(x => x.removeAttribute('aria-selected'));
    li.setAttribute('aria-selected','true');
    label.textContent = li.textContent;
    close(); trigger.blur();
  });

  /* клавиатура */
  dd.addEventListener('keydown', (e) => {
    const opts = [...menu.querySelectorAll('.sort-option')];
    const i = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown'){ e.preventDefault(); (opts[i+1] || opts[0])?.focus(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); (opts[i-1] || opts.at(-1))?.focus(); }
    else if (e.key === 'Escape'){ close(); trigger.focus(); }
    else if (e.key === 'Enter'){ document.activeElement?.click(); }
  });

  /* синхронизация метки, если сортировку меняет твой код */
  native.addEventListener('change', () => {
    const o = [...native.options].find(x => x.value === native.value);
    if (o) label.textContent = o.textContent;
  });
})();



(function attachPressAnimation(minHold = 180) { // мс
  const btns = document.querySelectorAll('.card-like-button');

  btns.forEach(btn => {
    let downAt = 0;
    let released = false;
    let holdTimer = null;

    const pressDown = () => {
      clearTimeout(holdTimer);
      released = false;
      downAt = performance.now();
      btn.classList.add('is-pressed');
    };

    const pressUp = () => {
      if (released) return;
      released = true;
      const elapsed = performance.now() - downAt;
      const wait = Math.max(0, minHold - elapsed);
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        btn.classList.remove('is-pressed');
      }, wait);
    };

    // Pointer (мышь/тач/стилус)
    btn.addEventListener('pointerdown', pressDown);
    btn.addEventListener('pointerup', pressUp);
    btn.addEventListener('pointerleave', pressUp);
    btn.addEventListener('pointercancel', pressUp);

    // Клава (доступность): Space/Enter
    btn.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        // предотвращаем «залипание» при авто-повторе
        if (!btn.classList.contains('is-pressed')) pressDown();
      }
    });
    btn.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') pressUp();
    });
  });
})();








/*
// ===== Row Fold Engine =====
(function rowFoldInit(){
  const grid = document.querySelector('.grid');
  if (!grid) return;

  let rows = [];            // [{top: number, bottom: number, height: number, cards: HTMLElement[]}]
  let gap = 20;             // fallback, перезатрём реальным значением из CSS

  const readGap = () => {
    const g = getComputedStyle(grid).gap || getComputedStyle(grid).rowGap;
    const num = parseFloat(g);
    if (!Number.isNaN(num)) gap = num;
  };

  // Группировка карточек в “ряды” по их top-координате (с допуском)
  function computeRows(){
    readGap();

    const cards = Array.from(grid.querySelectorAll('.card'));
    if (!cards.length) return;

    // Сбрасываем прошлую разметку
    cards.forEach(c => {
      c.removeAttribute('data-row');
      c.style.removeProperty('--rowP');
      c.classList.remove('row-is-folding');
      c.style.marginTop = '';
    });

    // Берём координаты относительно документа
    const scrollY = window.scrollY || window.pageYOffset;
    const buckets = new Map(); // key ~ округлённый top

    const tolerance = 10; // px, сглаживаем погрешности

    cards.forEach(card => {
      const r = card.getBoundingClientRect();
      const topDoc = r.top + scrollY;

      // Квантование: приведём top к “ступеньке” с учётом tolerance
      const key = Math.round(topDoc / tolerance) * tolerance;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ card, topDoc, height: r.height });
    });

    // Соберём массив отсортированных рядов
    rows = [...buckets.entries()]
      .sort((a,b) => a[0] - b[0])
      .map(([key, arr], idx) => {
        const top = Math.min(...arr.map(x => x.topDoc));
        const bottom = Math.max(...arr.map(x => x.topDoc + x.height));
        const height = bottom - top;
        const cards = arr.map(x => x.card);
        cards.forEach(c => c.dataset.row = String(idx));
        return { top, bottom, height, cards, idx };
      });
  }

  // Преобразуем позицию ряда в прогресс сворачивания 0..1
  // Начинаем “схлопывать”, когда середина ряда прошла верхнюю кромку вьюпорта.
  // Преобразуем позицию ряда в прогресс сворачивания 0..1

  // Симметрично для верхней и нижней границы вьюпорта
  function foldProgressForRow(row){
    const yTop = window.scrollY || window.pageYOffset;
    const yBot = yTop + window.innerHeight;

    // Когда начинаем схлопывать: какая часть ряда уже вышла за край
    // FRACTION=0.5 → начинаем, когда за край вышло больше половины ряда
    // У тебя было 0.4 (начало чуть раньше середины) — оставлю так по умолчанию
    const FRACTION = 0.4;

    const thresh = row.height * FRACTION;      // сколько может выйти без схлопывания
    const span   = row.height - thresh;        // от начала схлопа до полного ухода

    // Сколько «вышло» за верх
    const overflowTop = Math.max(0, yTop - row.top - thresh);
    // Сколько «вышло» за низ
    const overflowBot = Math.max(0, row.bottom - yBot - thresh);

    // Прогресс для каждой стороны (0..1), берём максимальный
    const pTop = Math.min(1, overflowTop / span);
    const pBot = Math.min(1, overflowBot / span);

    return Math.max(pTop, pBot);
  }


  function applyFold(){
    if (!rows.length) return;
    grid.style.setProperty('--row-gap', `${gap}px`);

    const yTop = window.scrollY || window.pageYOffset;
    const yBot = yTop + window.innerHeight;

    const FRACTION = 0.4;                   // когда начинается схлоп
    const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;

    for (const row of rows) {
      const thresh = row.height * FRACTION;
      const span   = Math.max(1, row.height - thresh);

      // сколько вышло за верх/низ
      const overflowTop = yTop - row.top - thresh;
      const overflowBot = row.bottom - yBot - thresh;

      // если ряд далеко от краёв — прогресс = 0, ничего не пишем
      if (overflowTop <= 0 && overflowBot <= 0) {
        if (row.lastP && row.lastP !== 0) {
          row.lastP = 0;
          for (const card of row.cards) {
            card.style.removeProperty('--rowP');
            card.classList.remove('row-active','row-is-folding');
          }
        }
        continue;
      }

      const pTop = overflowTop > 0 ? overflowTop / span : 0;
      const pBot = overflowBot > 0 ? overflowBot / span : 0;
      const p    = clamp(Math.max(pTop, pBot));

      if (row.lastP !== undefined && Math.abs(p - row.lastP) < 0.002) continue; // нет заметного изменения
      row.lastP = p;

      const active = p > 0 && p < 1;

      for (const card of row.cards) {
        card.style.setProperty('--rowP', p.toFixed(3));
        if (active) {
          card.classList.add('row-active','row-is-folding');
        } else {
          // либо полностью развернут, либо полностью схлопнут
          card.classList.remove('row-is-folding');
          card.classList.remove('row-active');
          if (p === 0) card.style.removeProperty('--rowP');
        }
      }
    }
  }


  // Обновляем ряды при:
  // 1) первом запуске, 2) изменении размера/колонок, 3) смене списка карточек
  const recompute = () => { computeRows(); applyFold(); };

  // Debounce для resize/scroll
  let rAF = 0;
  const onScroll = () => { cancelAnimationFrame(rAF); rAF = requestAnimationFrame(applyFold); };
  const onResize = () => { cancelAnimationFrame(rAF); rAF = requestAnimationFrame(recompute); };

  // Если у тебя уже есть свой observer/пейджинг — зови recompute() после догрузки карточек.
  const ro = new ResizeObserver(onResize);
  ro.observe(grid);

  // Первый проход
  recompute();

  // Слушаем скролл страницы
  window.addEventListener('scroll', onScroll, { passive: true });

  // На всякий случай — пересчёт после загрузки изображений (высоты рядов меняются)
  window.addEventListener('load', recompute);
})();
*/



const btn  = document.getElementById('shuffleBtn');
const icon = btn?.querySelector('svg');
let angle = 0;

if (btn && icon) {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    angle -= 180;
    icon.style.transform = `rotate(${angle}deg)`; // transition сработает
  });
}