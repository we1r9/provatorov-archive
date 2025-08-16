import photos from '../data/photos.json' with { type: 'json' };
import { initSearchAndSort } from './utils/initSearchAndSort.js';
import { mapPhotos } from './utils/mapPhotos.js';

// ========== ПОДГОТОВКА ДАННЫХ ==========
const photosData = mapPhotos(photos);

// ========== РЕНЕДЕР ГАЛЕРЕИ ==========
function renderGallery(photosData) {
  const grid = document.querySelector('.grid');
  if (!grid) return;

  // Генерируем HTML для всех карточек
  const cardsHTML = photosData.map(card => `
    <a class="card-link" href="photo.html?id=${card.id}">
      <article class="card" data-id="${card.id}">
        <img class="card-photo" src="${card.thumb}">
        <div class="card-content">
          <p class="card-photo-title">${card.location}</p>
          <button class="card-like-button" onclick="event.stopPropagation(); event.preventDefault();">❤</button>
        </div>
        <p class="card-photo-year">${card.year}</p>
      </article>
    </a>
  `).join('');

  grid.innerHTML = cardsHTML;
}
renderGallery(photosData);

// ========== ПОИСК И СОРТИРОВКА ==========
initSearchAndSort(photosData, renderGallery);