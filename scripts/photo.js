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
function getSimilarPhotos(current, list, limit = Infinity) {
  // Вытаскиваем регион/страну/локацию и прогоняем через norm, чтобы позднее сравнивать в одном формате
  const region = norm(current.region);
  const country = norm(current.country);
  const location = norm(current.location);

  // Создаем список всех фото, кроме текущего
  const pool = list.filter(photo => photo.id !== current.id);

  // Поиск по региону
  // Если у текущего фото указан region, ищем все фото с таким же region
  let result = region ? pool.filter(photo => norm(photo.region) === region) : [];
  if (result.length) return result.slice(0, limit);

  // Поиск по стране
  result = country ? pool.filter(photo => norm(photo.country) === country) : [];
  if (result.length) return result.slice(0, limit);

  // Поиск по цельной локации
  result = location ? pool.filter(photo => norm(photo.location) === location) : [];
  return result.slice(0, limit);
}

// Рендер похожих фото
function renderSimilar(similar, mount, { pageSize = 10 } = {}) {
  if (!similar || !similar.length) return;

  // Корневой блок секции
  const section = document.createElement('section');
  section.className = 'similar';

  // Заголовок
  const title = document.createElement('p');
  title.className = 'similar-title';
  title.textContent = 'Похожие фото';

  // Лента
  const strip = document.createElement('div');
  strip.className = 'similar-strip';
  strip.setAttribute('role', 'list');

  // Скрытая точка конца
  const sentinel = document.createElement('div');
  sentinel.className = 'similar-sentinel';
  sentinel.setAttribute('aria-hidden', 'true');

  // Ленивая загрузка
  const imgObserver = new IntersectionObserver((entries,  obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const img = entry.target;
      const src = img.getAttribute('data-src');
      if (src) {
        img.src = src;
        img.removeAttribute('data-src');
      }
      obs.unobserve(img);
    }
  }, {
    root: strip,
    rootMargin: '0px 600px 0px 600px',
    threshold: 0.01
  });

  // Фабрика карточки
  function createCard(p) {
    const a = document.createElement('a');
    a.className = 'similar-card';
    a.href = `photo.html?id=${p.id}`;
    a.title = p.location || '';
    a.setAttribute('role', 'listitem');

    const img = document.createElement('img');
    img.className = 'similar-img';
    img.alt = p.location || '';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.setAttribute('data-src', p.thumb || p.web);
    imgObserver.observe(img);

    const cap = document.createElement('div');
    cap.className = 'similar-caption';
    const loc = document.createElement('span');
    loc.className = 'cap-loc';
    loc.textContent = p.location || '';
    const year = document.createElement('span');
    year.className = 'cap-date';
    year.textContent = p.year || '';
    cap.appendChild(loc);
    cap.appendChild(year);

    a.appendChild(img);
    a.appendChild(cap);
    return a;
  }

  // Пагинация и догрузка
  const total = similar.length;
  let nextIndex = 0;

  function appendChunk() {
    if (nextIndex >= total) return false;
    const end = Math.min(nextIndex + pageSize, total);
    const frag = document.createDocumentFragment();
    for (let i = nextIndex; i < end; i++) {
      frag.appendChild(createCard(similar[i]));
    }

    strip.insertBefore(frag, sentinel);
    nextIndex = end;

    if (nextIndex >= total) {
      endObserver.unobserve(sentinel);
      sentinel.remove();
    }

    return true;
  }

  // Наблюдатель за концом ленты
  const endObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      appendChunk();
    }
  }, {
    root: strip,
    rootMargin: '0px 1200px 0px 0px',
    threshold: 0.01
  });

  // Сборка секции
  strip.appendChild(sentinel);
  section.appendChild(title);
  section.appendChild(strip);

  // Вставка
  mount.insertAdjacentElement('beforeend', section);

  // Первичная загрузка (10 шт)
  appendChunk();

  // Вкл. наблюдение за концом
  endObserver.observe(sentinel);

  // Состояние скролла
  const key = `similarScroll:${photo.id}`;

  const save = (() => {
    let t;
    return () => {
      clearTimeout(t);
      t = setTimeout(() => sessionStorage.setItem(key, String(strip.scrollLeft)), 80);
    };
  })();

  strip.addEventListener('scroll', save, { passive: true });

  // Сохраняем перед кликом по карточке
  strip.addEventListener('click', (e) => {
    if (e.target.closest('a.similar-card')) save();
  });

  // Восстановление
  function restore() {
    const s  = parseInt(sessionStorage.getItem(key) || '0', 10);
    if (!Number.isNaN(s) && s > 0) {
      let guard = 0;
      while ((strip.scrollWidth - strip.clientWidth) < s && nextIndex < total && guard < 100) {
        if (!appendChunk()) break;
        guard++;
      }
      strip.scrollLeft = Math.min(s, strip.scrollWidth - strip.clientWidth);
    }
  }
  requestAnimationFrame(restore);

  // При возврате из кэша
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) restore();
  });
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