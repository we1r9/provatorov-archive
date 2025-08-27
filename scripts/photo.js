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

// Сохраняем вертикальный скролл карточки
(function initPhotoScrollY() {
  const KEY = `photoScrollY:${photo.id}`;

  // Пределы
  const clampY = (y) => 
    Math.max(0, Math.min(y, document.documentElement.scrollHeight - window.innerHeight));

  // Восстановление позиции
  const restore = () => {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    const y = clampY(parseInt(raw, 10) || 0);
    if (y > 0) window.scrollTo({ top: y, behavior: 'auto' });
  };

  // Сохранение позиции
  const save = () => sessionStorage.setItem(KEY, String(window.scrollY || 0));

  // Ставим ручное управление скролом
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // Сохраняем с дебаунсом во время скролла
  let t;
  window.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(save, 80);
  }, { passive: true });

  // Сохраняем перед уходом со страницы
  window.addEventListener('pagehide', save);

  // Сохраняем при клике по любым ссылкам
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a, button.go-back-arrow, .go-back-arrow');
    if (a) save();
  });

  // Восстанавливаем после полной загрузки
  window.addEventListener('load', restore);

  // При возврате из кэша
  window.addEventListener('pageshow', (e) => { 
    if (e.persisted) restore();
  });

  // Сохраняем позицию перед навигацией по кнопке назад
  const backBtn = document.querySelector('.go-back-arrow');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      save();
      if (history.length > 1) history.back();
      else location.href = 'index.html';
    });
  }
})();

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
          <a class="similar-card" data-id="${photo.id}" href="photo.html?id=${photo.id}" title="${photo.location || ''}">
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

// Хелперы для скачивания HQ
function markHqUnavailable(btn, msg = 'HQ недоступна') {
  if (!btn) return;
  btn.classList.add('is-unavailable');
  btn.setAttribute('aria-disabled', 'true');
  btn.disabled = true;
  btn.textContent = msg;
}

function setBtnLoading(btn, on) {
  if (!btn) return;
  btn.classList.toggle('is-loading', !!on);
  btn.disabled = !!on;
}

async function probeUrl(url, { timeout = 8000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);

  try {
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);

    if (res.ok) return { ok: true, canDownload: true };
    if (res.status === 403 || res.status === 405) return { ok: false, canDownload: true };

    return { ok: false, canDownload: false, status: res.status };
  } catch (e) {
    clearTimeout(timer);

    return { ok: false, canDownload: false, error: e?.message || 'network error' };
  }
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

  // Создаем универсальный тост
  function getToastEl() {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  // Показываем тост
  function showToast(msg) {
    const el = getToastEl();
    el.textContent = msg;
    el.classList.add('is-show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('is-show'), 3000);
  }

  // Обработчик скачивания HQ
  const downloadButton = viewRoot.querySelector('.download-hq-btn');

  if (downloadButton) {
    if (!photo.hq) {
      markHqUnavailable(downloadButton);
    } else {
      downloadButton.addEventListener('click',  async () => {
        if (downloadButton.disabled) return;

        if (!navigator.onLine) {
          showToast('⚠️ Нет подключения к интернету :(');
          return;
        }

        setBtnLoading(downloadButton, true);
        try {
          const probe = await probeUrl(photo.hq, { timeout: 4000 });

          if (probe.status === 404 || probe.status === 410) {
            markHqUnavailable(downloadButton, 'HQ недоступна');
            showToast('⚠️ Файл не найден');
            return;
          }

          if (probe.ok || probe.canDownload) {
            const a = document.createElement('a');
            a.href = photo.hq;
            a.download = `${photo.id}-hq.jpg`;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
            return;
          }

          if (probe.error) {
            showToast('⚠️ Проблема с подключением');
            return;
          }

          showToast('⚠️ Сервер временно недоступен');
        } finally {
          if (!downloadButton.classList.contains('is-unavailable')) {
            setBtnLoading(downloadButton, false);
          }
        }
      });

      window.addEventListener('offline', () => {
        downloadButton.classList.add('is-offline');
      });

      window.addEventListener('online', () => {
        downloadButton.classList.remove('is-offline');
        showToast('Подключение к интернету восстановлено!')
      });

      const syncNetworkState = () => {
        if (!navigator.onLine) {
          downloadButton.classList.add('is-offline');
        } else {
          downloadButton.classList.remove('is-offline');
        }
      };
      window.addEventListener('load', syncNetworkState);
      window.addEventListener('pageshow', syncNetworkState);
    }
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