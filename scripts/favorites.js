import photos from '../data/photos.json' with { type: 'json' };
import { mapPhotos } from "./utils/mapPhotos.js";
import { getFavorites, isFavorite, toggleFavorite } from './favoritesStore.js';
import { STORAGE_KEY } from './favoritesStore.js';

// Готовим данные
const photosData = mapPhotos(photos);

// Находим элементы для вставки на странице
const grid = document.querySelector('.grid');
const empty = document.querySelector('.empty-state');

// Создаем сет из массива для быстрых проверок
// Оставляем только те фото, чей id есть в сете
function buildFavoritesList() {
  const ids = new Set(getFavorites());
  return photosData.filter(photo => ids.has(String(photo.id)));
}

// Элемент пустого состояния
function renderEmpty() {
  if (!empty || !grid) return;
  grid.hidden = true;
  empty.hidden = false;
  empty.style.removeProperty('display');
}

// Рендерим галерею только для избранных
function renderGallery(list) {
  if (!grid) return;
  const html = list.map(card => {
    const fav = isFavorite(card.id);
    return `
      <a class="card-link" href="photo.html?id=${card.id}">
        <article class="card" data-id="${card.id}">
          <img class="card-photo" src="${card.thumb}">
          <div class="card-content">
            <p class="card-photo-title">${card.location}</p>
            <button
              class="card-like-button ${fav ? 'is-fav' : ''}" 
              data-fav-id="${card.id}">
              ❤
            </button>
          </div>
          <p class="card-photo-year">${card.year}</p>
        </article>
      </a>
    `;
  }).join('');
  grid.innerHTML = html;

  // Показываем элемент пустого состояния
  grid.hidden = false;
  if (empty) empty.hidden = true;
}

// Если избранные есть — отображаем галерею
// Если нет — отображаем элемеент пустого состояния
function render() {
  const list = buildFavoritesList();
  if (list.length === 0) renderEmpty();
  else renderGallery(list);
}
render();

// Удаляем карточку при удалении из избранного
grid?.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-fav-id]');
  if (!btn) return;
  event.preventDefault();

  const id = btn.dataset.favId;
  toggleFavorite(id);

  // Убираем карточку из DOM
  const cardLink = btn.closest('.card-link');
  cardLink?.remove();

  // Если карточек нет — показываем пустое состояние
  if (grid.children.length === 0) renderEmpty();
});

// Если избранное изменили на другой вкладке
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) render();
});

// Обработчик возврата назад
const back = document.querySelector('.go-back-arrow');
back.addEventListener('click', () => {
  if (history.length > 1) history.back();
  else location.href = 'index.html';
});