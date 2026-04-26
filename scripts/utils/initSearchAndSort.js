import { paging, setCurrentPhotos } from "../gallery.js";

let indexedPhotos = [];
let searchInput = null;
let isShuffleMode = false;
let lastQuery = '';
let shuffleOrder = [];
let sortSelect  = null;
let currentSort = '';
let metaWrap = null;
let metaCount = null;

const grid = document.querySelector('.grid');

function showCount(show, text = '') {
  if (!metaCount) return;
  if (show) {
    metaCount.textContent = text;
    metaCount.removeAttribute('hidden');
  } else {
    metaCount.textContent = '';
    metaCount.setAttribute('hidden', '');
  }
}

function hideCounterNow() {
  if (!metaCount) return;
  metaCount.textContent = '';
  metaCount.setAttribute('hidden', '');
}

function updateCounterFromCurrentQuery() {
  const q = (searchInput?.value || '').trim();
  if (!q) { showCount(false); return; }
  const cnt = filterByQuery(indexedPhotos, q).length;
  showCount(cnt > 0,  `Найдено ${cnt} фото`);
}

export function scrollToTopSmooth() {
  if (window.__isRestoringScroll) return;
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    window.scrollTo(0, 0);
  }
}

function revealGrid() {
  if (!grid) return;
  requestAnimationFrame(() => grid.classList.remove('is-fading'));
}

function updateUrlState({ q, sort, shuffle }, { push = false} = {}) {
  const url = new URL(location.href);
  q ? url.searchParams.set('q', q) : url.searchParams.delete('q');
  sort ? url.searchParams.set('sort', sort) : url.searchParams.delete('sort');
  shuffle ? url.searchParams.set('shuffle', shuffle) : url.searchParams.delete('shuffle');

  const state = history.state || {};
  if (push) history.pushState(state, '', url);
  else history.replaceState(state, '', url);

}

const collator = new Intl.Collator(['ru', 'en'], {
  sensitivity: 'base',
  numeric: true,
  ignorePunctuation: true
});

function extractYear(date) {
  if (!date) return '';
  const string = String(date);
  const year = string.split('-')[0];
  const validYear = /^\d{4}$/.test(year);
  if (validYear) {
    return year;
  } else {
    return '';
  }
}

function norm(search='') {
  return String(search)
    .toLowerCase()
    .replaceAll('ё', 'е')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeQuery(query) {
  return norm(query).trim().split(/\s+/).filter(Boolean);
}

function filterByQuery(photos, query) {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return photos;

  return photos.filter(photo => tokens.every(token => photo.search.includes(token)));
}

function initSort(list, sortKey) {
  const copy = [...list];
  switch (sortKey) {
    case 'year_desc':
      return copy.sort((a, b) => 
        (Number(b.year || 0) - Number(a.year || 0)) ||
        collator.compare(String(a.location || ''), String(b.location || ''))
      );
    case 'year_asc':
      return copy.sort((a, b) => 
        (Number(a.year || 0) - Number(b.year || 0)) ||
        collator.compare(String(a.location || ''), String(b.location || ''))
      );
    case 'location_asc':
      return copy.sort((a, b) => 
        collator.compare(String(a.location || ''), String(b.location || '')));
    case 'location_desc':
      return copy.sort((a, b) => 
        collator.compare(String(b.location || ''), String(a.location || '')));
    default:
      return copy;
  }
}

function shuffle(array) {
  let shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function showEmptyState(list, query) {
  if (!grid) return;

  const emptyEl = document.querySelector(".empty-state");
  const hasQuery = query && query.trim().length > 0;
  const isEmpty = !list || list.length === 0;

  if (hasQuery && isEmpty) {
    emptyEl.querySelector(".title").textContent = "По вашему запросу ничего не найдено.";
    emptyEl.hidden = false;
    requestAnimationFrame(() => emptyEl.classList.add("is-show"));
  } else {
    emptyEl.classList.remove("is-show");
    emptyEl.hidden = true;
  }
}

function runSearch(preserveVisible = false) {
  const query = searchInput ? searchInput.value : '';

  const filtered = filterByQuery(indexedPhotos, query);

  let result = filtered;

  if (isShuffleMode) {
    if (!shuffleOrder.length || !arrayEqualIds(shuffleOrder, filtered)) {
      shuffleOrder = shuffle(filtered.map(photo => photo.id));
    }

    const map = new Map(filtered.map(photo => [photo.id, photo]));

    result = shuffleOrder.map(id => map.get(id)).filter(Boolean);

  } else if (currentSort) {
    result = initSort(filtered, currentSort);

    shuffleOrder = [];
  }

  setCurrentPhotos(result, { preserveVisible });

  showEmptyState(result, query);

  return result;
}

function arrayEqualIds(order, list) {
  const ids = list.map(photo => photo.id).sort();

  const saved = [...order].sort();

  return JSON.stringify(ids) === JSON.stringify(saved);
}

export function initSearchAndSort(photosData, { autoRender = true } = {}) {
  indexedPhotos = photosData.map(photo => {
    const country = photo.country || '';
    const region = photo.region || '';
    const year = extractYear(photo.year);
    const tags = (photo.tags || []).join(' ');
    const description = photo.description || '';
    const search = norm([
      country, region, year, tags, description
    ].join(' '));
    return { ...photo, search };
  });

  searchInput = document.querySelector('.input-section');
  sortSelect = document.querySelector('#sortSelect');
  const shuffleBtn = document.querySelector('.shuffle-button');
  metaWrap = document.querySelector('.search-meta');
  metaCount = metaWrap ? metaWrap.querySelector('.count.search-counter') : null;

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentSort = sortSelect.value;
      isShuffleMode = false;
      document.documentElement.dataset.shuffle = '0';

      runSearch(false);
      scrollToTopSmooth();

      const q = (searchInput?.value || '').trim();
      updateUrlState({ q, sort: currentSort, shuffle: false});

      updateCounterFromCurrentQuery();

      if (!window.__isRestoringScroll) {
        scrollToTopSmooth();
      }
    });
  }

  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
      isShuffleMode = true;
      currentSort = '';
      shuffleOrder = [];

  if (sortSelect) {
    sortSelect.value = '';
    const dd = document.getElementById('sortDropdown');
    const label = dd?.querySelector('.sort-label');
    if (label) label.textContent = 'Сортировать';
    dd?.querySelectorAll('.sort-option').forEach(li => li.removeAttribute('aria-selected'));
  }
  document.documentElement.dataset.shuffle = '1';

      runSearch(false);
      scrollToTopSmooth();

      const q = (searchInput?.value || '').trim();
      updateUrlState({ q, sort: '', shuffle: true});

      updateCounterFromCurrentQuery();

      if (!window.__isRestoringScroll) {
        scrollToTopSmooth();
      }
    });
  }

  let t;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(t);
      hideCounterNow();

      if (grid) grid.classList.add('is-fading');

      t = setTimeout(() => {
        submitSearch();
      }, 300);
    });

    searchInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        clearTimeout(t);
        hideCounterNow();
        submitSearch();
      }
    });
  }

  function submitSearch() {
    const q = searchInput ? searchInput.value.trim() : '';
    const isClearing = !!lastQuery&& !q;

    if (isClearing) {
      let savedAll = parseInt(sessionStorage.getItem('visibleAll') || '0', 10);
      if (!Number.isFinite(savedAll) || savedAll <= 0) savedAll = paging.PAGE_SIZE;

      paging.visibleCount = Math.min(savedAll, indexedPhotos.length);

      const res = runSearch(true);
      showCount(false);
      updateUrlState({ q: '', sort: currentSort, shuffle: isShuffleMode }, { push: false });

      revealGrid();
      lastQuery = '';
      return;
    }

    const res = runSearch(false);

    updateCounterFromCurrentQuery();

    if (grid) requestAnimationFrame(() => {
      grid.classList.remove('is-fading');
    });

    revealGrid();

    updateUrlState({ q, sort: currentSort, shuffle: isShuffleMode }, {push: false});

    if (!window.__isRestoringScroll) {
      scrollToTopSmooth();
    }

    lastQuery = q;
  }

  if (autoRender && !window.__isRestoringScroll) runSearch(false);
}

export function applySearchState(state = {}, opts = {}) {
  const {
    query,
  } = state;

  const preserveVisible = opts?.preserveVisible ?? true;

  if (!searchInput) searchInput = document.querySelector('.input-section');
  if (!sortSelect)  sortSelect  = document.querySelector('#sortSelect');

  if (typeof query === 'string' && searchInput) {
    searchInput.value = query;
  }

  const hasSort       = Object.prototype.hasOwnProperty.call(state, 'sort');
  const hasShuffle    = Object.prototype.hasOwnProperty.call(state, 'isShuffle');
  const hasOrder      = Object.prototype.hasOwnProperty.call(state, 'shuffleOrder');

  if (hasShuffle) {
    isShuffleMode = !!state.isShuffle;
  }
  if (hasOrder) {
    shuffleOrder = Array.isArray(state.shuffleOrder) ? state.shuffleOrder.slice() : [];
  }

  if (isShuffleMode) {
    currentSort = '';
  } else {
    if (hasSort) {
      if (sortSelect) sortSelect.value = state.sort;
      currentSort = state.sort;
    }
  }

  document.documentElement.dataset.shuffle = isShuffleMode ? '1' : '0';

  const res = runSearch(preserveVisible);
  updateCounterFromCurrentQuery();

  return res;
}

export function getSearchState() {
  return {
    query: searchInput ? searchInput.value : '',

    sort:  sortSelect ? sortSelect.value  : '',

    isShuffle: isShuffleMode,

    shuffleOrder: [...shuffleOrder]
  }
}

export function setShuffleOrder(order = []) {
  shuffleOrder = Array.isArray(order) ? order.slice() : [];
}