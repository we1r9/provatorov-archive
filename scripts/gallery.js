import photos from '../data/photos.json' with { type: 'json' };
import { isFavorite, toggleFavorite, getFavoritesCount } from './favoritesStore.js';
import { initSearchAndSort, applySearchState, getSearchState, scrollToTopSmooth } from './utils/initSearchAndSort.js';
import { mapPhotos } from './utils/mapPhotos.js';

// ========== ПОДГОТОВКА ДАННЫХ ==========
const photosData = mapPhotos(photos);
export let currentPhotos = [...photosData];

// Ленивый рендер (paging) — разбиваем контент на страницы по PAGE_SIZE картчоек
export const paging = {
  PAGE_SIZE: 8,
  visibleCount: Math.min(8, photosData.length),
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

const SHOW_DELAY = 90;
const HIDE_DELAY = 140;
const COOLDOWN = 220;
const DELTA_PX = 8;
let tShow = 0, tHide = 0, until = 0;

function setSortVisible(v){
  if (visible === v) return;
  sortBar.classList.toggle('is-visible', v);
  visible = v;
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

function onScroll(){
  if (initialLock) return;
  const y  = scrollY;
  const dy = y - lastY;

  if (y < 40) {
    setVisibleDebounced(true);
  } else if (Math.abs(dy) > DELTA_PX) {
    setVisibleDebounced(dy < 0);
  }

  lastY = y;
  rafId = null;
}

addEventListener('scroll', () => {
  if (!rafId) rafId = requestAnimationFrame(onScroll);
}, { passive: true });

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
          <img class="card-photo" src="${card.thumb}">

          <div class="card-content">
            <p class="card-photo-title">${card.location || ''}</p>

            <button
              class="card-like-button ${isFav ? 'is-fav' : ''}" 
              data-fav-id="${card.id}">
              ❤
            </button>
          </div>
          
          <p class="card-photo-year">${card.year || ''}</p>
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

// Кнопка возврата наверх страницы
const scrollBtn = document.querySelector('.scroll-top-btn');

window.addEventListener('scroll', () => {
  // Показываем после 400px прокрутки
  if (window.scrollY > 400) {
    scrollBtn.classList.add('show');
  } else {
    scrollBtn.classList.remove('show');
  }
});

scrollBtn.addEventListener('click', () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
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


/* ========= CUSTOM SORT MENU ========= */
const native = document.getElementById('sortSelect');
const dd = document.getElementById('sortDropdown');
const trigger = dd.querySelector('.sort-trigger');
const label = dd.querySelector('.sort-label');
const menu = dd.querySelector('.sort-menu');

function buildMenu() {
  menu.innerHTML = '';
  [...native.options].forEach(o => {
    if (o.disabled || o.hidden) return;
    const li = document.createElement('li');
    li.className = 'sort-option';
    li.setAttribute('role', 'option');
    li.dataset.value = o.value;
    li.textContent = o.textContent;
    if (o.selected) li.setAttribute('aria-selected', 'true');
    menu.appendChild(li);
  });
  label.textContent = native.selectedOptions[0]?.textContent || 'Сортировать';
}
buildMenu();

const open = () => { dd.classList.add('open'); trigger.setAttribute('aria-expanded', 'true'); menu.focus?.(); }
const close = () => { dd.classList.remove('open'); trigger.setAttribute('aria-expanded','false'); }

trigger.addEventListener('click', () => dd.classList.contains('open') ? close() : open());

document.addEventListener('click', (e) => { 
  if (!dd.contains(e.target)) close(); 
});

menu.addEventListener('click', e => {
  const li = e.target.closest('.sort-option'); if (!li) return;
  
  dd.classList.add('updating');
  setTimeout(() => {
    native.value = li.dataset.value;
    native.dispatchEvent(new Event ('change', { bubbles: true }));
    [...menu.children].forEach(x => x.removeAttribute('aria-selected'));
    li.setAttribute('aria-selected','true');
    label.textContent = li.textContent;
    dd.classList.remove('updating');
    dd.classList.add('updated');
    setTimeout(() => dd.classList.remove('updated'), 10);
  }, 120);
  close();
});

native.addEventListener('change', () => {
  const o = [...native.options].find(opt => opt.value === native.value);
  if (o) label.textContent = o.textContent;
    [...menu.children].forEach(li => li.toggleAttribute('aria-selected', li.dataset.value===native.value));
});