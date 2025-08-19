import { setCurrentPhotos } from "../gallery.js";

// ========== СОСТОЯНИЕ МОДУЛЯ ==========
let indexedPhotos = [];
let searchInput = null;
let searchButton = null;
let isShuffleMode = false;
let shuffleOrder = [];
let sortSelect  = null;
let currentSort = '';

// ========== УТИЛИТЫ ==========
// Компаратор
const collator = new Intl.Collator(['ru', 'en'], {
  sensitivity: 'base',
  numeric: true,
  ignorePunctuation: true
});

// Вытаскиваем год из даты и проверяем, что он состоит из 4 цифр
function extractYear(date) {
  if (!date) return '';
  const string = String(date);
  const year = string.split('-')[0];
  const validYear = /^\d{4}$/.test(year);
  if (validYear) {
    return year;
  } else {
    return '';
  }
}

// Нормализация поиска
function norm(search='') {
  return String(search)
    .toLowerCase()
    .replaceAll('ё', 'е')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Токенезируем запрос, чтобы получить одну большую строку
function tokenizeQuery(query) {
  return norm(query).trim().split(/\s+/).filter(Boolean);
}

// Фильтруем результат поиска
function filterByQuery(photos, query) {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return photos;

  return photos.filter(photo => tokens.every(token => photo.search.includes(token)));
}

// Правила сортировки
function initSort(list, sortKey) {
  const copy = [...list];
  switch (sortKey) {
    case 'year_desc':
      return copy.sort((a, b) => 
        (Number(b.year || 0) - Number(a.year || 0)) ||
        collator.compare(String(a.location || ''), String(b.location || ''))
      );
    case 'year_asc':
      return copy.sort((a, b) => 
        (Number(a.year || 0) - Number(b.year || 0)) ||
        collator.compare(String(a.location || ''), String(b.location || ''))
      );
    case 'location_asc':
      return copy.sort((a, b) => 
        collator.compare(String(a.location || ''), String(b.location || '')));
    case 'location_desc':
      return copy.sort((a, b) => 
        collator.compare(String(b.location || ''), String(a.location || '')));
    default:
      return copy;
  }
}

// Перемешивание
function shuffle(array) {
  let shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Элемент пустого состояния результата поиска
function emptyStateElement() {
  let element = document.querySelector('.empty-state');

  if (!element) {
    element = document.createElement('div');
    element.className = 'empty-state';
    element.style.display = 'none';
    const grid = document.querySelector('.grid');
    if (grid) grid.insertAdjacentElement('afterend', element);
  }
  return element;
}

// Показываем элемент пустого состояния, если поиск не дал результатов
function showEmptyState(list, query) {
  const grid = document.querySelector('.grid');
  if (!grid) return;

  const emptyElement = emptyStateElement();
  
  const hasQuery = query && query.trim().length > 0;
  const isEmpty = !list || list.length === 0;

  // Если поиск не дал результатов
  if (hasQuery && isEmpty) {
    emptyElement.textContent = `По вашему запросу ничего не найдено :(`;
    emptyElement.style.display = 'block';
    grid.style.display = 'none';
  } else {
    emptyElement.style.display = 'none';
    grid.style.display = '';
  }
}

// ========== ГЛАВНЫЙ РЕНДЕР ==========
// Собираем результат и рендерим
function runSearch(preserveVisible = false) {
  // Читаем текущую строку из инпута
  const query = searchInput ? searchInput.value : '';

  // Фильтруем фото по запросу
  const filtered = filterByQuery(indexedPhotos, query);

  let result = filtered;

  // Если включен режим перемешивания
  if (isShuffleMode) {
    // Проверяем, есть ли уже сохраненный порядок ID
    if (!shuffleOrder.length || !arrayEqualIds(shuffleOrder, filtered)) {
      // Генерируем новую перестановку для текущих ID и сохраняем
      shuffleOrder = shuffle(filtered.map(photo => photo.id));
    }

    // Создаем словарь ID → объект фото
    const map = new Map(filtered.map(photo => [photo.id, photo]));

    // Восстанавливаем результат в сохраненном порядке ID
    result = shuffleOrder.map(id => map.get(id)).filter(Boolean);

    // Иначе сортируем отфильтрованные карточки по ключу
  } else if (currentSort) {
    result = initSort(filtered, currentSort);

    // Сбрасываем порядок перемешивания
    shuffleOrder = [];
  }

  // Отдаем список в галерею с сохраненным состоянием галереи
  setCurrentPhotos(result, { preserveVisible });

  // Показываем блок пустого состояния, если результата нет
  showEmptyState(result, query);
}

// Хэлпер
// order — массив ID из сохраненного shuffleOrder
// list — новый список карточек
function arrayEqualIds(order, list) {
  // Берем все ID из текущего списка картчоек и сортируем их
  const ids = list.map(photo => photo.id).sort();

  // Берем сохраненный orderShuffle, копируем и сортируем
  const saved = [...order].sort();

  // Сравниваем отсортированные списки
  // Если ID совпадают — вернет true
  return JSON.stringify(ids) === JSON.stringify(saved);
}

// ========== ПУБЛИЧНЫЕ ФУНКЦИИ ==========
// Инициализирует функционал поиска по галерее и сортировки
// Принимает массив карточек и объект с опциями
export function initSearchAndSort(photosData, { autoRender = true } = {}) {
  // Готовим индекс
  indexedPhotos = photosData.map(photo => {
    const country = photo.country || '';
    const region = photo.region || '';
    const year = extractYear(photo.year);
    const tags = (photo.tags || []).join(' ');
    const description = photo.description || '';
    const search = norm([
      country, region, year, tags, description
    ].join(' '));
    return { ...photo, search }; // ...photo раскрывает все свойства объекта photo в новый объект, к которому добавляется search
  });

  // DOM
  searchInput = document.querySelector('.input-section');
  searchButton = document.querySelector('.search-button');
  sortSelect = document.querySelector('#sortSelect');
  const shuffleBtn = document.querySelector('.shuffle-button');

  // Обработчик выбранной сортировки
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentSort = sortSelect.value;
      isShuffleMode = false; // Выключаем shuffleMode
      document.documentElement.dataset.shuffle = '0';

      // Перезапускаем рендер
      runSearch(false);
    });
  }

  // Обработчик перемешивания
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
      isShuffleMode = true;
      currentSort = ''; // Сбрасываем сортировку
      shuffleOrder = []; // Очищаем старый порядок
      if (sortSelect) sortSelect.value = '';
      document.documentElement.dataset.shuffle = '1';
      runSearch(true);
    });
  }

  // Запускаем поиск по кнопке поиска или "Enter"
  if (searchButton) searchButton.addEventListener('click', () => runSearch(false));
  
  // Лайв-поиск с задержкой 100 мс
  let timeout;
  if (searchInput) searchInput.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => runSearch(false), 100);
  });

  // Поиск по "Enter"
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch(false);
    }
  });

  // Если включен автозапуск, сразу показываем результат
  if (autoRender) runSearch(false);
}

// Применяет сохраненное состояние поиска/сортировки/перемешивания. Параметры передаются объектом: 
// query — текст поиска
// sort — выбранная сортировка
// isShuffle — флаг режима перемешивания (false по умолч.)
// savedOrder — сохраненный порядок карточек при shuffle
export function applySearchState({ 
  query = '', 
  sort = '', 
  isShuffle = false,
  shuffleOrder: savedOrder = [] 
} = {}) {

  if (!searchInput) searchInput = document.querySelector('.input-section');
  if (!sortSelect) sortSelect = document.querySelector('#sortSelect');

  if (searchInput) searchInput.value = query;
  if (sortSelect) sortSelect.value = sort;

  // Логика переключения
  isShuffleMode = !!isShuffle;
  currentSort = isShuffle ? '' : sort;

  // Восстанавливаем сохранённый порядок перемешанных карточек
  shuffleOrder = Array.isArray(savedOrder) ? savedOrder.slice() : [];

  // Ставим атрибут data-shuffle на <html>
  document.documentElement.dataset.shuffle = isShuffleMode ? '1' : '0';

  runSearch(true);
}

// Собирает текущее состояние поиска/сортировки/перемешивания и возвращает в виде объекта
export function getSearchState() {
  return {
    // Если поле поиска есть на странице — берем введенный текст, если нет — ставим пустую строку
    query: searchInput ? searchInput.value : '',

    // Если элемент сортировки есть на странице — берем выбранное значение, если нет — ставим пустую строку
    sort:  sortSelect ? sortSelect.value  : '',

    // Флаг shuffleMode
    isShuffle: isShuffleMode,

    // Копия массива текущего порядка перемешивания
    shuffleOrder: [...shuffleOrder]
  }
}

// Позволяет задать порядок перемешивания извне
export function setShuffleOrder(order = []) {
  // Если это массив — создает его копию, иначе — делает пустым
  shuffleOrder = Array.isArray(order) ? order.slice() : [];
}