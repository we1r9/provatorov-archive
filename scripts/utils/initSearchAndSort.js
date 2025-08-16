// Инициализирует функционал поиска по галерее и сортировки
export function initSearchAndSort(photosData, renderGallery) {
  // ========== СОРТИРОВКА ==========
  // Инициализирует функционал сортировки
  function initSort(list, sortKey) {
    const copy = [...list];
    switch (sortKey) {
      case 'year_desc':
        return copy.sort((a, b) => 
          Number(b.year || 0) - Number(a.year || 0) ||
          String(a.location || '').localeCompare(String(b.location || ''), 'ru')
        );
      case 'year_asc':
        return copy.sort((a, b) => 
          Number(a.year || 0) - Number(b.year || 0) ||
          String(a.location || '').localeCompare(String(b.location || ''), 'ru')
        );
      case 'location_asc':
        return copy.sort((a, b) => 
          String(a.location || '').localeCompare(
            String(b.location || ''), 
            ['ru', 'en'],
            { sensitivity: 'base', numeric: true, ignorePunctuation: true }
        ));
      case 'location_desc':
        return copy.sort((a, b) => 
          String(b.location || '').localeCompare(
            String(a.location || ''), 
            ['ru', 'en'],
            { sensitivity: 'base', numeric: true, ignorePunctuation: true }
        ));
      default:
        console.warn(`Unknown sortKey: ${sortKey}`);
        return copy;
    }
  }

  // Обработчик выбранной сортировки
  const sortSelect = document.querySelector('#sortSelect');
  let currentSort = sortSelect ? sortSelect.value : 'year_desc';
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentSort = sortSelect.value;
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

  // Готовим индекс
  const indexedPhotos = photosData.map(photo => {
    const country = photo.country || '';
    const region = photo.region || '';
    const year = extractYear(photo.year);
    const tags = (photo.tags || []).join(' ');
    const description = photo.description || '';

    const search = [
      country, region, year, tags, description
    ].join(' ').toLowerCase();

    return { ...photo, search }; // ...photo раскрывает все свойства объекта photo в новый объект, к которому добавляется search
  });

  // Токенезируем запрос, чтобы получить одну большую строку
  function tokenizeQuery(query) {
    return String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
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
    const sorted = initSort(filtered, currentSort);
    renderGallery(sorted);
    showEmptyState(sorted, query);
  }

  // Запускаем поиск по кнопке поиска или "Enter"
  searchButton.addEventListener('click', runSearch);
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
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