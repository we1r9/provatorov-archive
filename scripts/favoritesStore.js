// Имя ключа в localStorage
export const STORAGE_KEY = 'provatorov:favorites';

// Читает данные из localStorage
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

// Текущее состояние в памяти
let set = new Set(load());

// Сохраняем массив избранных в localStorage
function saveAndNotify() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));

  // Уведомляем весь сайт
  const count =  set.size;
  window.dispatchEvent(new CustomEvent('favorites:changed', { detail: { count } }));
}

// Возвращает массив всех id в избранном
export function getFavorites() {
  return [...set];
}

// Считаем кол-во избранных
export function getFavoritesCount() {
  return set.size;
}

// Проверяет, есть ли фото в избранном
export function isFavorite(id) {
  return set.has(String(id));
}

// Добавление/удаление избранного и сохранение в localStorage
export function toggleFavorite(id) {
  const key = String(id);
  set.has(key) ? set.delete(key) : set.add(key);
  saveAndNotify();
}

// Очищает список избранного
export function clearFavorites() {
  set.clear();
  saveAndNotify();
}

// Синхронизация между вкладками
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  set = new Set(load());
  window.dispatchEvent(new CustomEvent('favorites:changed', { detail: { count: set.size } }));
});