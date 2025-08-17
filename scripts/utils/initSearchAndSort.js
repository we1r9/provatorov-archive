// Инициализирует функционал поиска по галерее и сортировки
export function initSearchAndSort(photosData, renderGallery) {
  // ========== СОРТИРОВКА ==========
  // Компаратор
  const collator = new Intl.Collator(['ru', 'en'], {
    sensitivity: 'base',
    numeric: true,
    ignorePunctuation: true
  });
  
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

  // Текущий список и состояние
  let currentPhotos = [...photosData];
  let currentSort = '';
  let isShuffleMode = false;

  // Обработчик выбранной сортировки
  const sortSelect = document.querySelector('#sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentSort = sortSelect.value;
      isShuffleMode = false;
      runSearch();
    });
  }

  // ========== ПЕРЕМЕШИВАНИЕ ==========
  function shuffle(array) {
    let shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Обработчик перемешивания
  const shuffleBtn = document.querySelector('.shuffle-button');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
      isShuffleMode = true;
      currentSort = '';
      if (sortSelect) sortSelect.value = '';
      runSearch();
    });
  }

  // ========== ПОИСК ==========
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

  // Готовим индекс
  const indexedPhotos = photosData.map(photo => {
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

  // Токенезируем запрос, чтобы получить одну большую строку
  function tokenizeQuery(query) {
    return norm(query).trim().split(/\s+/).filter(Boolean);
  }

  // Фильтруем результат поиска
  function filterByQuery(photos, query) {
    const tokens = tokenizeQuery(query);
    if (tokens.length === 0) return photos;

    return photos.filter(photo => 
      tokens.every(token => 
        photo.search.includes(token)));
  }

  // Обработчики кнопки поиска и Enter
  const searchInput = document.querySelector('.input-section');
  const searchButton = document.querySelector('.search-button');
  if (!searchButton || !searchInput) return;

  // Запускаем поиск и сортировку
  function runSearch() {
    const query = searchInput.value;
    const filtered = filterByQuery(indexedPhotos, query);

    let result = filtered;
    if (isShuffleMode) {
      result = shuffle(filtered);
    } else if (currentSort) {
      result = initSort(filtered, currentSort);
    }

    currentPhotos = result;
    renderGallery(result);
    showEmptyState(result, query);
  }

  // Запускаем поиск по кнопке поиска или "Enter"
  searchButton.addEventListener('click', runSearch);
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch();
    }
  });

  // Лайв-поиск
  let timeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(timeout);
    timeout = setTimeout(runSearch, 100);
  });

  // Создаем элемент пустого состояния результата поиска
  function emptyStateElement() {
    let element = document.querySelector('.empty-state');

    if (!element) {
      element = document.createElement('div');
      element.className = 'empty-state';
      element.style.display = 'none';
      const grid = document.querySelector('.grid');
      grid.insertAdjacentElement('afterend', element);
    }
    return element;
  }

  // Показываем сообщение пустого состояния, если поиск не дал результатов
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
  
  runSearch();
}