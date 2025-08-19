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

// ========== ХЭЛПЕРЫ ДЛЯ ПОИСКА ПОХОЖИХ ==========
// Нормализация поиска
function norm(v) {
  return (v || '').toString().trim().toLowerCase();
}

// Ищем похожие фото
function getSimilarPhotos(current, list) {
  // Вытаскиваем регион/страну/локацию и прогоняем через norm, чтобы позднее сравнивать в одном формате
  const region = norm(current.region);
  const country = norm(current.country);
  const location = norm(current.location);

  // Создаем список всех фото, кроме текущего
  const pool = list.filter(photo => photo.id !== current.id);

  // Поиск по региону
  // Если у текущего фото указан region, ищем все фото с таким же region
  let result = region ? pool.filter(photo => norm(photo.region) === region) : [];
  // Если что-то нашли, возвращаем первые 20
  if (result.length) return result.slice(0, 20);

  // Поиск по стране
  result = country ? pool.filter(photo => norm(photo.country) === country) : [];
  if (result.length) return result.slice(0, 20);

  // Поиск по цельной локации
  result = location ? pool.filter(photo => norm(photo.location) === location) : [];
  return result.slice(0, 20);
}

// Рендер похожих фото
function renderSimilar(similar, mount) {
  if (!similar || !similar.length) return;

  const html = `
    <section class="similar">
      <p class="similar-title">Похожие фото</p>
      <div class="similar-strip" role="list">
        ${similar.map(photo => `
          <a class="similar-card" role="listitem" href="photo.html?id=${photo.id}" title="${photo.location || ''}">
            <img class="similar-img" src="${photo.thumb || photo.web}">
            <div class="similar-caption">
              <span class="cap-loc">${photo.location || ''}</span>
              <span class="cap-date">${photo.year || ''}</span>
            </div>
          </a>
          `).join('')}
      </div>
    </section>
  `;

  mount.insertAdjacentHTML('beforeend', html);
}

// ========== РЕНДЕР + ОБРАБОТЧИКИ ==========
const viewRoot = renderPhoto();
if (viewRoot) {
  // Обработчик добавления в избранное
  viewRoot.addEventListener('click', (event) => {
    const btn = event.target.closest('.card-like-button');
    if (!btn) return;
    event.preventDefault();
    const id = btn.dataset.favId;
    toggleFavorite(id);
    btn.classList.toggle('is-fav', isFavorite(id));
  });

  // Обработчик скачивания HQ
  const downloadButton = viewRoot.querySelector('.download-hq-btn');
  if (downloadButton) {
    downloadButton.addEventListener('click', async () => {
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
  }

  const similar = getSimilarPhotos(photo, photosData);
  const container = viewRoot.querySelector('.view-container');
  renderSimilar(similar, container || viewRoot);
}

// Сохранение горизонтального скролла карусели
(function initSimilarScrollPersistence() {
  const strip = document.querySelector('.similar-strip');
  if (!strip) return;

  // Уникальный ключ для sessionStorage
  const key = `similarScroll:${photo.id}`;

  // Допустимые пределы горизонтальной прокрутки
  const clamp = (val, el) => Math.max(0, Math.min(val, el.scrollWidth - el.clientWidth));

  // Восстанавливаем сохраненную горизонтальную позицию прокрутки
  const saved = parseInt(sessionStorage.getItem(key) || '0', 10);
  if (!Number.isNaN(saved)) {
    strip.scrollLeft = clamp(saved, strip);
  }

  // Сохраняем горизонтальную позицию прокрутки
  let timeout;
  // Вызывается каждый раз при скролле
  const save = () => {
    //Очищаем предыдыщий таймер
    clearTimeout(timeout);

    // Оптимизация памяти
    timeout = setTimeout(() => {
      // Сохраняем текущую горизонатльную позицию
      sessionStorage.setItem(key, String(strip.scrollLeft));
    }, 80);
  }
  strip.addEventListener('scroll', save, { passive: true });

  // Сохраняем перед уходом по клику
  strip.addEventListener('click', (event) => {
    if (event.target.closest('a.similar-card')) save();
  });

  // Восстанавливаем, если страница вернулась из кеша
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      const el = document.querySelector('.similar-strip');
      if (el) {
        const s = parseInt(sessionStorage.getItem(key) || '0', 10);
        if (!Number.isNaN(s)) el.scrollLeft = clamp(s, el);
      }
    }
  });
})();

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

// Обработчик возврата назад
const back = document.querySelector('.go-back-arrow');
back.addEventListener('click', () => {
  if (history.length > 1) history.back();
  else location.href = 'index.html';
});