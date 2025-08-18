import photos from '../data/photos.json' with { type: 'json' };
import { clearFavorites, getFavorites, isFavorite, toggleFavorite } from './favoritesStore.js';
import { initSearchAndSort } from './utils/initSearchAndSort.js';
import { mapPhotos } from './utils/mapPhotos.js';

// ========== ПОДГОТОВКА ДАННЫХ ==========
const photosData = mapPhotos(photos);
export let currentPhotos = [...photosData];

// Параметры ленивой загрузки
export const paging = {
  PAGE_SIZE: 6,
  visibleCount: Math.min(6, photosData.length),
};

// Публичный сеттер (обновляем список + сбрасываем пагинацию)
export function setCurrentPhotos(list) {
  currentPhotos = Array.isArray(list) ? list : [];
  paging.visibleCount = Math.min(paging.PAGE_SIZE, currentPhotos.length);
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
            <p class="card-photo-title">${card.location}</p>

            <button
              class="card-like-button ${isFav ? 'is-fav' : ''}" 
              data-fav-id="${card.id}">
              ❤
            </button>
          </div>
          
          <p class="card-photo-year">${card.year}</p>
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
initSearchAndSort(photosData, renderGallery);

// После инициализации — восстанавливаем видимую часть и скролл
restoreState();

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
// Изменяем режим пролистыания страницы на ручной
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
  // Собираем состояние и положение страницы
  const state = {
    pageKey: location.pathname,
    visibleCount: paging.visibleCount,
    scrollY: window.scrollY
  };
  // Сохраняем в sessionStorage
  sessionStorage.setItem('galleryState', JSON.stringify(state));
  // Записываем состояние в историю браузера
  history.replaceState(state, '', location.href);
}

// Восстанавливаем состояние страницы
function restoreState() {
  // Достаем сохраненное состояние
  const state = readSavedState();
  if (!state || state.pageKey !== location.pathname) return;

  // Если в состоянии есть число visibleCount, обновляем paging.visibleCount
  if (typeof state.visibleCount === 'number') {
    paging.visibleCount = Math.min(state.visibleCount, currentPhotos.length);
  }

  // Перерисовываем сетку с учетом нового visibleCount
  updateView();

  // Переносим пользователя туда, где он был
  requestAnimationFrame(() => {
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const y = Math.min(state.scrollY || 0, maxScroll);
    window.scrollTo(0, y);
  });
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

// Гарантируем восстановление страницы, если оан пришла из кеша
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    restoreState();
  }
})