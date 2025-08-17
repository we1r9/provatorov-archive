// Имя ключа в localStorage
export const STORAGE_KEY = 'provatorov:favorites';

// Читает данные из localStorage
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || []);
  } catch {
    return [];
  }
}

// Текущее состояние в памяти
let set = new Set(load());

// Сохраняем массив избранных в localStorage
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

// Возвращает массив всех id в избранном
export function getFavorites() {
  return [...set];
}

// Проверяет, есть ли фото в избранном
export function isFavorite(id) {
  return set.has(String(id));
}

// Добавление/удаление избранного и сохранение в localStorage
export function toggleFavorite(id) {
  const key = String(id);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  save();
}

// Очищает список избранного
export function clearFavorites() {
  set.clear();
  save();
}

// Синхронизация между вкладками
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  set = new Set(load());
});