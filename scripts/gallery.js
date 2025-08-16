import photos from '../data/photos.json' with { type: 'json' };
import { initSearchAndSort } from './utils/initSearchAndSort.js';

// // ========== ПОДГОТОВКА ДАННЫХ ==========
export const photosData = photos.map(item => {
  const hasRegion = item.location && item.location.region;
  const hasCountry = item.location && item.location.country;

  const region = hasRegion ? item.location.region : '';
  const country = hasCountry ? item.location.country : '';

  let location = '';
  if (region && country) location = region + ' • ' + country;
  else if (region) location = region;
  else if (country) location = country;
  else location = '';

  return {
    id: item.id,
    year: item.date.split('-')[0],
    month: item.date.split('-')[1] || '',
    region,
    country,
    location,
    tags: item.tags || [],
    thumb: item.files.thumb,
    web: item.files.web,
    hq: item.files.hq || null,
    description: item.description || '',
    cameraModel: (item.camera && item.camera.model) || '',
    cameraLens: (item.camera && item.camera.lens) || ''
  };
});

// ========== РЕНЕДЕР ГАЛЕРЕИ ==========
function renderGallery(photosData) {
  const grid = document.querySelector('.grid');
  if (!grid) return;

  // Генерируем HTML для всех карточек
  const cardsHTML = photosData.map(card => `
    <article class="card" data-id="${card.id}">
      <img class="card-photo" src="${card.thumb}">
      <div class="card-content">
        <p class="card-photo-title">${card.location}</p>
        <button class="card-like-button">❤</button>
      </div>
      <p class="card-photo-year">${card.year}</p>
    </article>
  `).join('');

  grid.innerHTML = cardsHTML;
}
renderGallery(photosData);

// ========== ПОИСК И СОРТИРОВКА ==========
initSearchAndSort(photosData, renderGallery);