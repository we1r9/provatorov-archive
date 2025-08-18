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

// Публичный сеттер (одновляем список + сбраслываем пагинацию)
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