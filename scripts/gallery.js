import photos from '../data/photos.json' with { type: 'json' };
import { clearFavorites, getFavorites, isFavorite, toggleFavorite } from './favoritesStore.js';
import { initSearchAndSort } from './utils/initSearchAndSort.js';
import { mapPhotos } from './utils/mapPhotos.js';

// ========== ПОДГОТОВКА ДАННЫХ ==========
const photosData = mapPhotos(photos);
let currentPhotos = [...photosData];

// Находим сетку галереи на странице
const grid = document.querySelector('.grid');

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
renderGallery(currentPhotos);

// ========== ПОИСК И СОРТИРОВКА ==========
initSearchAndSort(photosData, renderGallery);

// Обработчик добавления в избранное
grid.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-fav-id]');
  if (!btn) return;

  event.preventDefault();
  
  const id = btn.dataset.favId;
  toggleFavorite(id);
  btn.classList.toggle('is-fav', isFavorite(id));
});