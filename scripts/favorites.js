import photos from '../data/photos.json' with { type: 'json' };
import { mapPhotos } from "./utils/mapPhotos.js";
import { getFavorites, isFavorite, toggleFavorite, getFavoritesCount } from './favoritesStore.js';

import { STORAGE_KEY } from './favoritesStore.js';

const photosData = mapPhotos(photos);

const grid = document.querySelector('.grid');
const empty = document.querySelector('.empty-state');

function buildFavoritesList() {
  const ids = new Set(getFavorites());
  return photosData.filter(photo => ids.has(String(photo.id)));
}

function renderEmpty() {
  if (!empty || !grid) return;

  grid.hidden = true;

  empty.hidden = false;
  empty.classList.remove('is-show');
  requestAnimationFrame(() => empty.classList.add('is-show'));
}

function renderGallery(list) {
  if (!grid) return;
  const html = list.map(card => {
    const fav = isFavorite(card.id);
    return `
      <a class="card-link" href="photo.html?id=${card.id}">
        <article class="card" data-id="${card.id}">
          <div class="card-media">
            <img class="card-photo" src="${card.thumb}" alt="">
          </div>

          <button
            class="card-like-button ${fav ? 'is-fav' : ''}"
            data-fav-id="${card.id}"
            aria-label="${fav ? 'Убрать из избранного' : 'В избранное'}">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#292929ff" viewBox="0 0 256 256" aria-hidden="true">
              <path d="M240,98a57.63,57.63,0,0,1-17,41L133.7,229.62a8,8,0,0,1-11.4,0L33,139a58,58,0,0,1,82-82.1L128,69.05l13.09-12.19A58,58,0,0,1,240,98Z"></path>
            </svg>
          </button>

          <div class="card-content">
            <div class="card-meta">
              <p class="card-photo-title">${card.location || ''}</p>
              <p class="card-photo-year">${card.year || ''}</p>
            </div>
          </div>
        </article>
      </a>
    `;
  }).join('');
  grid.innerHTML = html;
  grid.hidden = false;
  if (empty) empty.hidden = true;
}

function render() {
  const list = buildFavoritesList();
  if (list.length === 0) renderEmpty();
  else renderGallery(list);
}
render();

grid?.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-fav-id]');
  if (!btn) return;
  event.preventDefault();

  const id = btn.dataset.favId;
  toggleFavorite(id);

  window.dispatchEvent(new Event('favorites:changed'));

  const card = btn.closest('.card');
  const cardLink = btn.closest('.card-link');
  if (!card || !cardLink) return;

  if (card.classList.contains('is-leaving')) return;
  
  card.classList.add('is-leaving');

  const onEnd = (ev) => {
    if (ev.propertyName !== 'opacity') return;
    cardLink.remove();
    if (grid.children.length === 0) renderEmpty();
  };
  card.addEventListener('transitionend', onEnd, { once: true });

  setTimeout(() => {
    if (card.isConnected) {
      cardLink.remove();
      if (grid.children.length === 0) renderEmpty();
    }
  }, 400);
});

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    render();
    renderFavCount();
  }
});

const back = document.querySelector('.go-back-arrow');
back?.addEventListener('click', () => {
  if (history.length > 1) history.back();
  else location.href = 'index.html';
});

const favCountEl = document.getElementById('favCount');
const favLinkEl = document.querySelector('.fav-btn');

function bump(el){
  el.classList.remove('is-updating');
  el.offsetWidth;
  el.classList.add('is-updating');
}

function renderFavCount() {
  if(!favCountEl || !favLinkEl) return;

  const n = getFavoritesCount();

  if (n === 0) {
    favCountEl.textContent = '';
    favLinkEl.classList.remove('has-count');
    favLinkEl.setAttribute('aria-label', 'Избранное, нет фото');
  } else {
    const shown = n > 99 ? '99+' : String(n);
    const prev = favCountEl.textContent;

    favLinkEl.classList.add('has-count');
    favCountEl.textContent = shown;
    favLinkEl.setAttribute('aria-label', `Избранное, ${shown} фото`);

    if (prev !== shown) bump(favCountEl);
  }
}

renderFavCount();

window.addEventListener('favorites:changed', renderFavCount);

window.addEventListener('pageshow', () => {
  renderFavCount();
  if (document.activeElement === favLinkEl) favLinkEl.blur();
});

document.addEventListener('mousedown', (e) => {
  const a = e.target.closest('.fav-btn');
  if (a) a.blur();
});

requestAnimationFrame(() => {
    document.documentElement.classList.add('html-blur-ready');
  });

requestAnimationFrame(() => {
  favLinkEl?.classList.add('is-ready');
});