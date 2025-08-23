import photos from '../data/photos.json' with { type: 'json' };
import { isFavorite, toggleFavorite } from './favoritesStore.js';
import { initSearchAndSort, applySearchState, getSearchState } from './utils/initSearchAndSort.js';
import { mapPhotos } from './utils/mapPhotos.js';

// ========== ПОДГОТОВКА ДАННЫХ ==========
const photosData = mapPhotos(photos);
export let currentPhotos = [...photosData];

// Ленивый рендер (paging) — разбиваем контент на страницы по PAGE_SIZE картчоек
export const paging = {
  PAGE_SIZE: 6,
  visibleCount: Math.min(6, photosData.length),
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

// DOM
const grid = document.querySelector('.grid');
const loadMoreBtn = document.querySelector('.load-more-btn');

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
}

// Обработчик "Показать еще"
if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', () => {
    paging.visibleCount = Math.min(
      paging.visibleCount + paging.PAGE_SIZE,
      currentPhotos.length
    );
    updateView();
  });
}

updateView();

// ========== ПОИСК И СОРТИРОВКА ==========
// Вызываем основную логику с опицей авто-ренедра
initSearchAndSort(photosData, { autoRender: false });
// Вытаскиваем q из URL
const urlQ = (new URLSearchParams(location.search).get('q') || '').trim();

// Если поступил запрос с другой страницы, он — приоритетный
if (urlQ) {
  applySearchState({
    query: urlQ, isShuffle:false
  },
  {
    preserveVisible: false
  });

// Иначе — обычныя логика
// Возвращаем галерею в то состояние, в котором пользователь ее оставил
// Если restoreState ничего не восстановило
} else if (!restoreState()) {
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
  const { query, sort, isShuffle, shuffleOrder } = getSearchState();

  // Собираем состояние и положение страницы
  const state = {
    pageKey: location.pathname,
    visibleCount: paging.visibleCount,
    scrollY: window.scrollY,
    query,
    sort,
    isShuffle,
    shuffleOrder,
  };

  // Сохраняем в sessionStorage
  sessionStorage.setItem('galleryState', JSON.stringify(state));
  // Записываем состояние в историю браузера
  history.replaceState(state, '', location.href);
}

// Восстанавливаем состояние страницы
function restoreState() {
  // Достаем сохраненное состояние из localStorage
  const state = readSavedState();
  if (!state || state.pageKey !== location.pathname) return false;

  // Если в state нет фильтров query/sort/shuffle
  const emptyFilters = !state.query && !state.sort && !state.isShuffle;
  if (emptyFilters) return false;

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

  // Переносим пользователя туда, где он был
  requestAnimationFrame(() => {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const y = Math.min(state.scrollY || 0, maxScroll);
    window.scrollTo(0, y);
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

// Очистка поиска
const input = document.querySelector('.input-section');
const clearBtn = document.querySelector('.clear-btn');

function sync() {
  const wrap = input.closest('.input-wrap');
  if (wrap) wrap.classList.toggle('has-value', !!input.value);
}

clearBtn.addEventListener('click', () => {
  input.value = '',
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  sync();
  const url = new URL(location.href);
  url.searchParams.delete('q');
  history.replaceState(history.state, '', url);
});

input.addEventListener('input', sync);
sync();

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