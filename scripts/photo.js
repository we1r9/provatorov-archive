import photos from '../data/photos.json' with { type: 'json' };
import { mapPhotos } from './utils/mapPhotos.js';

// Готовим данные для вставки по ID
const photosData = mapPhotos(photos);
const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const photo = photosData.find(photo => photo.id === id);

// Инициализирует отображение фото
function renderPhoto() {
  const view = document.querySelector('.view');
  if (!view) return;

  const viewHTML = `
    <section class="view-container">
      <div class="photo-wrap">
        <img class="photo-img" src="${photo.web}">
      </div>

      <div class="photo-aside">
        <header class="aside-header">
          <span>${photo.location}</span>
          <span>${photo.month} ${photo.year}</span>
        </header>

        <section class="aside-description">
          <p class="description">${photo.description || ''}</p>
        </section>

        <section class="aside-block-camera">
          <div class="row">
            <p>Камера</p>
            <p>${photo.cameraModel || '—'}</p>
            <p>Объектив</p>
            <p>${photo.cameraLens || '—'}</p>
          </div>

          <div class="row">
            <p>Фокусное расстояние</p>
            <p>${photo.cameraFocalLength || '—'} мм</p>
            <p>Выдержка</p>
            <p>${photo.cameraShutter || '—'} с.</p>
          </div>

          <div class="row">
            <p>Диафрагма</p>
            <p>ƒ/${photo.cameraAperture || '—'}</p>
            <p>ISO</p>
            <p>${photo.cameraIso || '—'}</p>
          </div>
        </section>
      </div>
    </section>
  `;

  view.innerHTML = viewHTML;
}
renderPhoto(photosData);

// Авто-определение ориентации кадра
const img = new Image();
img.src = photo.web;
img.onload = () => {
  const viewLayout = document.querySelector('.view-container');
  const viewPhoto  = document.querySelector('.photo-wrap');

  if (img.naturalWidth > img.naturalHeight) {
    viewPhoto.classList.add('is-landscape');
  } else if (img.naturalWidth < img.naturalHeight) {
    viewPhoto.classList.add('is-portrait');
    viewLayout.classList.add('is-portrait');
  } else {
    viewPhoto.classList.add('is-landscape');
  }
};