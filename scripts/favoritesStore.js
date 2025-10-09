export const STORAGE_KEY = 'provatorov:favorites';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

let set = new Set(load());

function saveAndNotify() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));

  const count =  set.size;
  window.dispatchEvent(new CustomEvent('favorites:changed', { detail: { count } }));
}

export function getFavorites() {
  return [...set];
}

export function getFavoritesCount() {
  return set.size;
}

export function isFavorite(id) {
  return set.has(String(id));
}

export function toggleFavorite(id) {
  const key = String(id);
  set.has(key) ? set.delete(key) : set.add(key);
  saveAndNotify();
}

export function clearFavorites() {
  set.clear();
  saveAndNotify();
}

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  set = new Set(load());
  window.dispatchEvent(new CustomEvent('favorites:changed', { detail: { count: set.size } }));
});