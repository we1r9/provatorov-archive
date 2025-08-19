import photos from '../data/photos.json' with { type: 'json' };
import { mapPhotos } from './utils/mapPhotos.js';
import { isFavorite, toggleFavorite } from './favoritesStore.js';

// Готовим данные для вставки по ID
const photosData = mapPhotos(photos);
const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const photo = photosData.find(photo => photo.id === id);

// Инициализирует отображение фото
function renderPhoto() {
  const isFav = isFavorite(photo.id);
  const view = document.querySelector('.view');
  if (!view) return;

  // Создаем HTML для секции с отображением
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
            <p>Фокусное расстояние</p>
            <p>${photo.cameraFocalLength || '—'} мм</p>
          </div>

          <div class="row">
            <p>Объектив</p>
            <p>${photo.cameraLens || '—'}</p>
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

        <div class="photo-actions">
          <button
          class="card-like-button ${isFav ? 'is-fav' : ''}" 
          data-fav-id="${photo.id}">
          ❤
          </button>
          <button class="download-hq-btn">Скачать HQ</button>
        </div>
      </div>
    </section>
  `;

  // Вставляем HTML в секцию
  view.innerHTML = viewHTML;

  // Возвращаем контейнер для использования извне
  return view;
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

// Обработчик скачивания HQ
const btn = document.querySelector('.download-hq-btn');

btn.addEventListener('click', async () => {
  if (!photo.hq) {
    alert('HQ-версия недоступна');
    return;
  }
  try {
    const response = await fetch(photo.hq, { method: 'HEAD' });
    if (!response.ok) throw new Error (`Ошибка ${response.status}`);
    const link = document.createElement('a');
    link.href = photo.hq;
    link.download = `${photo.id}-hq.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    alert('Не удалось скачать HQ: ' + error.message);
  }
});

// Обработчик добавления в избранное
const view = renderPhoto();
if (view) {
  view.addEventListener('click', (event) => {
    const btn = event.target.closest('.card-like-button');
    if (!btn) return;
    event.preventDefault();
    const id = btn.dataset.favId;
    toggleFavorite(id);
    btn.classList.toggle('is-fav', isFavorite(id));
  });
}

// Переход на главную с параметром q
const searchInput = document.querySelector('.input-section');
const searchButton = document.querySelector('.search-button');

if (searchButton && searchInput) {
  // Будет вызываться при кнлике на кнопку или "Enter"
  const goToGalleryWithQuery = () => {

    // Берем текст из инпута
    const q = (searchInput.value || '').trim();

    // Создаем объект URL
    const url = new URL('index.html', location.origin);

    // Добавляем текст инпута в параметр
    if (q) url.searchParams.set('q', q);

    // Перенаправляем браузер на собранный URL
    location.href = url.toString();
  };

  // Обработчики поиска
  searchButton.addEventListener('click', goToGalleryWithQuery);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      goToGalleryWithQuery();
    }
  });
}