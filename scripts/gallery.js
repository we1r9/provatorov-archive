import photos from '../data/photos.json' with { type: 'json' };
import { isFavorite, toggleFavorite, getFavoritesCount } from './favoritesStore.js';
import { initSearchAndSort, applySearchState, getSearchState, scrollToTopSmooth } from './utils/initSearchAndSort.js';
import { mapPhotos } from './utils/mapPhotos.js';

window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    suppressNextFade = true;
  }
});

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

  listVersion++;
  currentPhotos = Array.isArray(list) ? list : [];

  lastRenderedCount = 0;
  
  // Считаем, сколько карточек показывать
  paging.visibleCount = preserveVisible
    ? Math.min(paging.visibleCount, currentPhotos.length)
    : Math.min(paging.PAGE_SIZE, currentPhotos.length);

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
let listVersion = 0;
let lastRenderedVersion = -1;

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
const loadMoreWrap = loadMoreBtn?.closest('.load-more-wrap');
const input = document.querySelector('.input-section');
const clearBtn = document.querySelector('.clear-btn');
const mid = document.querySelector('.header-middle');
const emptyState = document.querySelector('.empty-state');

// ========== РЕНЕДЕР ГАЛЕРЕИ ==========
function renderGallery(photosData, { append = false, startIndex = 0 } = {}) {
  if (!grid) return;

  // Генерируем HTML для всех карточек
  const makeCardHTML = (card) => {
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
  };

  if (append) {
    const frag = document.createDocumentFragment();
    for (let i = startIndex; i < photosData.length; i++) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = makeCardHTML(photosData[i]);
      frag.appendChild(wrapper.firstElementChild);
    }
    grid.appendChild(frag);
  } else {
    grid.innerHTML = photosData.map(makeCardHTML).join('');
  }
}

function updateSortControlsState() {
  const hasResults = currentPhotos.length > 0;

  const dd = document.getElementById('sortDropdown');
  const native = document.getElementById('sortSelect');
  const shuffleBtn = document.getElementById('shuffleBtn');

  // включить/выключить
  if (native) native.disabled = !hasResults;
  dd?.classList.toggle('is-disabled', !hasResults);
  shuffleBtn?.toggleAttribute('disabled', !hasResults);
}

function updateEmptyState() {
  const isEmpty = currentPhotos.length === 0;
  if (emptyState) {
    emptyState.classList.toggle('is-show', isEmpty);
    emptyState.toggleAttribute('hidden', !isEmpty);
  }
  if (loadMoreWrap) loadMoreWrap.toggleAttribute('hidden', isEmpty);
}

// Helper: дождаться конца CSS-перехода opacity или таймаута (подстраховка)
function waitOpacityTransition(el, timeout = 260){
  return new Promise(resolve => {
    let done = false;
    const onEnd = (e) => {
      if (done) return;
      if (e.propertyName === 'opacity') { done = true; el.removeEventListener('transitionend', onEnd); resolve(); }
    };
    const t = setTimeout(() => { if (!done) { done = true; el.removeEventListener('transitionend', onEnd); resolve(); } }, timeout);
    el.addEventListener('transitionend', onEnd, { once: true });
  });
}

async function fadeRender(renderFn){
  const gridEl = document.querySelector('.grid');
  if (!gridEl) { renderFn(); return; }

  if (!gridEl.classList.contains('is-fading')) {
    gridEl.classList.add('is-fading');
    await new Promise(r => requestAnimationFrame(r));
    await waitOpacityTransition(gridEl, 260);
  }

  // Рендерим новый DOM
  renderFn();

  // Дадим браузеру проставить размеры, затем дождёмся картинок
  await new Promise(r => requestAnimationFrame(r));
  const gridForWait = document.querySelector('.grid');
  await waitGridImagesLoaded(gridForWait, 800); // у тебя эта функция уже есть

  // Возвращаем непрозрачность
  gridEl.classList.remove('is-fading');
  await waitOpacityTransition(gridEl, 260);
}

let suppressNextFade = false;
let lastRenderedCount = 0;

// Рендер с учетом visibleCount
export function updateView() {
  if (currentPhotos.length > 0 && paging.visibleCount === 0) {
    paging.visibleCount = Math.min(paging.PAGE_SIZE, currentPhotos.length);
  }

  const slice = currentPhotos.slice(0, paging.visibleCount);

  updateSortControlsState();
  updateEmptyState();
  updateSortBarVisibility?.();

  const run = suppressNextFade ? (fn)=>{ fn(); } : fadeRender;

  const canAppendSameList = (
    suppressNextFade &&
    listVersion === lastRenderedVersion &&
    paging.visibleCount > lastRenderedCount
  );

  run(() => {
    if (canAppendSameList) {
      renderGallery(slice, { append: true, startIndex: lastRenderedCount });
    } else {
      renderGallery(slice);
    }

    if (loadMoreBtn) {
      loadMoreBtn.hidden =
        paging.visibleCount >= currentPhotos.length || currentPhotos.length === 0;
    }
  });

  suppressNextFade = false;
  lastRenderedCount   = slice.length;
  lastRenderedVersion = listVersion;

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
    suppressNextFade = true;
    updateView();

    try {
      const { query } = getSearchState();
      const key = query ? 'visibleSearch' : 'visibleAll';
      sessionStorage.setItem(key, String(paging.visibleCount));
    } catch {}
  });
}

// ========== ПОИСК И СОРТИРОВКА ==========
// Вызываем основную логику с опицей авто-ренедра
initSearchAndSort(photosData, { autoRender: false });

// Читаем параметры из URL
const params = new URLSearchParams(location.search);
const urlQ = (params.get('q') || '').trim();
const urlSort = (params.get('sort') || '').trim();
const urlShuffle = params.has('shuffle') || '';

const hasSavedState = !!readSavedState();
const hasUrlFilters = !!(urlQ || urlSort || urlShuffle);

const SCROLL_IDLE_MS = 200;
const SCROLL_EPS = 12;

// Флаг для полного сброса всех состояний
const forceReset = sessionStorage.getItem('forceReset') === '1';
if (forceReset) {
  sessionStorage.removeItem('forceReset');
}

// ===== ИНИЦИАЛИЗАЦИЯ СОСТОЯНИЯ =====
const restored = !forceReset && restoreState();

if (restored) {
  // Уже восстановили: не вызываем applySearchState повторно
  suppressNextFade = true;
  lastRenderedCount = paging.visibleCount;
} else if (urlQ || urlSort || urlShuffle) {
  // Применяем фильтры из URL (если есть)
  applySearchState(
    {
      query: urlQ,
      sort: urlShuffle ? '' : urlSort,
      isShuffle: urlShuffle,
      shuffleOrder: []
    },
    { preserveVisible: false }
  );
} else {
  // Иначе — стартовое состояние/автоперемешивание
  const AUTO_SHUFFLE_ON_LOAD = !hasSavedState && !hasUrlFilters;
  if (AUTO_SHUFFLE_ON_LOAD) {
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
    return;
  }

  const shown = n > 99 ? '99+' : String(n);
  const prev = favCountEl.textContent;

  favLinkEl.classList.add('has-count');
  favCountEl.textContent = shown;
  favLinkEl.setAttribute('aria-label', `Избранное, ${shown} фото`);

  if (prev && prev !== shown) bump(favCountEl);
}

renderFavCount();

window.addEventListener('favorites:changed', renderFavCount);

window.addEventListener('storage', (e) => {
  if (e.key === 'provatorov:favorites') renderFavCount();
});

window.addEventListener('pageshow', () => {
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

function doClear({
  keepFocus    = false,
  keepExpanded = false,
  keepScroll   = false,
  preserveSort    = true,
  preserveShuffle = true,
} = {}) {
  const { sort, isShuffle, shuffleOrder } = getSearchState();

  _clearingProgrammatically = true;
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  _clearingProgrammatically = false;

  sync();

  const url = new URL(location.href);
  url.searchParams.delete('q');
  history.replaceState(history.state, '', url);

  applySearchState(
    {
      query: '',
      sort: preserveSort    ? sort        : '',
      isShuffle: preserveShuffle ? isShuffle   : false,
      shuffleOrder: preserveShuffle ? shuffleOrder : []
    },
    { preserveVisible: false }
  );

  if (paging.visibleCount === 0) {
    setCurrentPhotos(photosData, { preserveVisible: false });
  }

  if (!keepExpanded) {
    collapse();
  } else {
    mid?.classList.add('is-expanded');
  }

  if (keepFocus) input.focus();
  if (!keepScroll) scrollToTopSmooth();
}

input.addEventListener('focus', expand);
input.addEventListener('blur', () => { if (!input.value) collapse(); });

input.addEventListener('input', () => {
  if (!mid.classList.contains('is-expanded')) expand();
  sync();

  if (!_clearingProgrammatically && input.value === '') {
    doClear({
      keepFocus: true,
      keepExpanded: true,
      keepScroll: true,
      preserveSort: true,
      preserveShuffle: true,
    });
  }
});

clearBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  doClear({ preserveSort: true, preserveShuffle: true });
});

clearBtn.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { 
    e.preventDefault(); 
    doClear({ preserveSort: true, preserveShuffle: true });
  }
});

input.addEventListener('input', sync);
sync();

let collapsedThisBurst = false;
let collapseTimer = 0;
let canScroll = false;
const KEEP_WHEN_HAS_QUERY = false;

function refreshScrollability() {
  const doc = document.documentElement;
  canScroll = (doc.scrollHeight - doc.clientHeight) > SCROLL_EPS;
  doc.classList.toggle('can-scroll', canScroll);
}

function onScrollStartCollapse(e) {
  if (collapsedThisBurst) return;
  if (document.activeElement === input) return;
  if (KEEP_WHEN_HAS_QUERY && input.value) return;

  // Любая прокрутка — сразу схлопываем
  onUserScrollCollapse();
}

function collapseAndBlur(){
  if (!mid) return;
  mid.classList.remove('is-expanded');
  input?.blur();
}

function onUserScrollCollapse() {
  if (collapsedThisBurst) return;
  collapseAndBlur();
  collapsedThisBurst = true;
  clearTimeout(collapseTimer);
  collapseTimer = setTimeout(() => (collapsedThisBurst = false), SCROLL_IDLE_MS);
}

window.addEventListener('wheel',     onUserScrollCollapse, { passive: true });
window.addEventListener('touchmove', onUserScrollCollapse, { passive: true });


addEventListener('load',  refreshScrollability);
addEventListener('resize', refreshScrollability);

// ========== Typewriter ==========
const searchExamples = [
  'Алтай, лето, день...',
  'Афганистан, портрет, девушка...',
  'Чили, озеро, фламинго...',
  'Занзибар, ч/б, интерьер...',
  'Аконкагуа, пейзаж, облако...',
  'Монголия, ч/б, интерьер...',
  'Антарктида, пингвины, снег...',
  'Пакистан, пейзаж, скалы...'
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

let _lastScrollSave = 0;

function saveScrollPositionInline() {
  const hs = history.state || {};
  const saved = readSavedState() || {};
  const next = {
    ...saved,
    scrollY: window.scrollY,
    visibleCount: paging.visibleCount,
  };
  history.replaceState({ ...hs, ...next }, '', location.href);
  try { sessionStorage.setItem('galleryState', JSON.stringify(next)); } catch {}
}

window.addEventListener('scroll', () => {
  const now = performance.now();
  if (now - _lastScrollSave > 120) {
    _lastScrollSave = now;
    saveScrollPositionInline();
  }
}, { passive: true });

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

// Восстанавливаем состояние страницы
function restoreState() {
  // Достаем сохраненное состояние из localStorage
  const state = readSavedState();
  if (!state || state.pageKey !== location.pathname) return false;

  isRestoring = true;
  window.__isRestoringScroll = true;
  suppressNextFade = true;

  if (typeof state.visibleCount === 'number') {
    paging.visibleCount = Math.min(state.visibleCount, currentPhotos.length);
  }

  // Применяем сохраненные фильтры
  applySearchState(
    {
      query: state.query || '',
      ...(state.sort !== undefined ? { sort: state.sort } : {}),
      ...(Object.prototype.hasOwnProperty.call(state, 'isShuffle')
        ? { isShuffle: !!state.isShuffle }
        : {}),
      ...(Array.isArray(state.shuffleOrder)
        ? { shuffleOrder: state.shuffleOrder }
        : {}),
    },
    { preserveVisible: true }
  );

  if (typeof state.searchExpanded === 'boolean') {
    mid?.classList.toggle('is-expanded', state.searchExpanded);
  }
  if (state.placeholderText && input) {
    input.placeholder = state.placeholderText;
  }

  const ySaved = state.scrollY || 0;
  suppressNextFade = true;

  const finish = () => { 
    isRestoring = false; 
    window.__isRestoringScroll = false;
  };

  const gridEl = document.querySelector('.grid');
  waitGridImagesLoaded(gridEl, 4000).then(() => {
    requestAnimationFrame(() => {
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo(0, Math.min(ySaved, max));

      setTimeout(() => {
        const max2 = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo(0, Math.min(ySaved, max2));
        finish();
      }, 300);
    });
  });

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
window.addEventListener('beforeunload', () => {
  saveState();
  saveScrollPositionInline();
});
window.addEventListener('pagehide', saveState);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveState();
});

// Гарантируем восстановление страницы, если она пришла из кеша
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    restoreState();
  }
});

/* =============== SORT DROPDOWN (rewrite) =============== */
(() => {
  const native  = document.getElementById('sortSelect');
  const dd      = document.getElementById('sortDropdown');
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

  dd.addEventListener('keydown', (e) => {
    const opts = [...menu.querySelectorAll('.sort-option')];
    const i = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown'){ e.preventDefault(); (opts[i+1] || opts[0])?.focus(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); (opts[i-1] || opts.at(-1))?.focus(); }
    else if (e.key === 'Escape'){ close(); trigger.focus(); }
    else if (e.key === 'Enter'){ document.activeElement?.click(); }
  });

  native.addEventListener('change', () => {
    const o = [...native.options].find(x => x.value === native.value);
    if (o) label.textContent = o.textContent;
  });

  const closeIfOpen = () => {
    if (dd.classList.contains('open')) close();
  };

  window.addEventListener('scroll', closeIfOpen,    { passive: true });
  window.addEventListener('wheel',  closeIfOpen,    { passive: true });
  window.addEventListener('touchmove', closeIfOpen, { passive: true });
})();

(function attachPressAnimation(minHold = 180) {
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

    btn.addEventListener('pointerdown', pressDown);
    btn.addEventListener('pointerup', pressUp);
    btn.addEventListener('pointerleave', pressUp);
    btn.addEventListener('pointercancel', pressUp);

    btn.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (!btn.classList.contains('is-pressed')) pressDown();
      }
    });
    btn.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') pressUp();
    });
  });
})();

const btn  = document.getElementById('shuffleBtn');
const icon = btn?.querySelector('svg');
let angle = 0;

if (btn && icon) {
  btn.addEventListener('click', (e) => {
    if (btn.hasAttribute('disabled')) return;
    e.preventDefault();
    angle -= 180;
    icon.style.transform = `rotate(${angle}deg)`;
  });
}


document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('js-ready');

  const input = document.querySelector('.input-section');
  const clearBtn = document.querySelector('.clear-btn');
  if (!input || !clearBtn) return;

  const sync = () => {
    const hasText = input.value.trim() !== '';
    clearBtn.toggleAttribute('hidden', !hasText);
  };

  sync();

  input.addEventListener('input', sync);
  input.addEventListener('search', sync);

  clearBtn.addEventListener('click', () => {
    input.value = '';
    input.focus();
    sync();
  });
});