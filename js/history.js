// === ИСТОРИЯ РАСЧЁТОВ (ИСПРАВЛЕННАЯ ВЕРСИЯ) ===
const HISTORY_KEY = 'hvac_calc_history';
const MAX_HISTORY = 20; 

/**
 * Сохраняет текущий расчет в LocalStorage.
 * Исправление: сохраняет финальную цену из calculationResults.totalPrice, 
 * а не пытается пересчитать её через getPrice().
 */
function saveToHistory() {
  if (!calculationResults || !calculationResults.outdoorUnit) {
    console.warn('️ Нечего сохранять: нет результатов или наружного блока');
    return;
  }

  // Берем уже рассчитанную итоговую цену, которую видит пользователь
  const finalPrice = calculationResults.totalPrice || 0;

  const historyItem = {
    id: Date.now(),
    date: new Date().toLocaleString('ru-RU'),
    brand: currentBrand,
    brandName: brands[currentBrand]?.name || 'Неизвестный бренд',
    roomsCount: Object.keys(calculationResults.roomsData).length,
    
    // Данные комнат для восстановления формы
    roomsData: JSON.parse(JSON.stringify(calculationResults.roomsData)), // Глубокая копия
    
    // Данные внутренних блоков
    indoorUnits: calculationResults.indoorUnits.map(u => ({
        model: u.selectedUnit?.model || '',
        hcCode: u.selectedUnit?.hcCode || '',
        power: u.power || 0,
        type: u.type || '',
        line: u.line || '',
        room: u.room || '',
        loadW: u.loadW || 0,
        margin: u.margin || 0,
        requiredKW: u.requiredKW || 0
    })),
    
    // Данные наружного блока
    outdoorUnit: {
        model: calculationResults.outdoorUnit.model,
        hcCode: calculationResults.outdoorUnit.hcCode,
        power: calculationResults.outdoorUnit.power,
        minRooms: calculationResults.outdoorUnit.minRooms,
        maxRooms: calculationResults.outdoorUnit.maxRooms,
        specs: calculationResults.outdoorUnit.specs,
        requiresBranch: calculationResults.outdoorUnit.requiresBranch || false
    },
    
    // Распределители
    branchOptions: calculationResults.branchOptions || [],
    selectedBranchOption: calculationResults.selectedBranchOption || null,
    
    // Процент загрузки
    loadPercent: ((calculationResults.indoorUnits.reduce((sum, u) => sum + (u.power || 0), 0) / (calculationResults.outdoorUnit.power || 1)) * 100).toFixed(1),
    
    // ✅ СОХРАНЯЕМ ФИНАЛЬНУЮ ЦЕНУ КАК ЕСТЬ
    totalPrice: finalPrice
  };

  try {
    let history = getHistory();
    history.unshift(historyItem);
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    console.log('✅ Расчёт сохранён в историю. Цена:', finalPrice);
  } catch (e) {
    console.error('❌ Ошибка при сохранении в историю:', e);
  }
}

/**
 * Получает массив истории из LocalStorage
 */
function getHistory() {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Ошибка чтения истории:', e);
    return [];
  }
}

/**
 * Переключает видимость панели истории
 */
function toggleHistoryPanel() {
  const panel = document.getElementById('historyPanel');
  if (!panel) return;
  
  if (panel.style.display === 'none' || panel.style.display === '') {
    panel.style.display = 'block';
    renderHistory();
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth' }), 100);
  } else {
    panel.style.display = 'none';
  }
}

/**
 * Отрисовывает список сохраненных расчетов
 */
function renderHistory() {
  const history = getHistory();
  const listEl = document.getElementById('historyList');
  const emptyEl = document.getElementById('historyEmpty');
  
  if (!listEl || !emptyEl) return;

  if (history.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  
  emptyEl.style.display = 'none';
  
  listEl.innerHTML = history.map(item => `
    <div class="history-item">
      <div class="history-info" onclick="loadFromHistory(${item.id})">
        <div class="history-title">
          ${item.brandName} • ${item.roomsCount} комн.
          <span style="color: #27ae60; font-weight: 600;">
            ${item.totalPrice > 0 ? item.totalPrice.toLocaleString('ru-RU') + ' ₽' : 'Цена не сохранена'}
          </span>
        </div>
        <div class="history-details">
          📅 ${item.date} | Наружный: ${item.outdoorUnit.model} | Загрузка: ${item.loadPercent}%
        </div>
      </div>
      <div class="history-actions">
        <button class="history-btn history-btn-load" onclick="loadFromHistory(${item.id})">Загрузить</button>
        <button class="history-btn history-btn-delete" onclick="deleteFromHistory(${item.id})">Удалить</button>
      </div>
    </div>
  `).join('');
}

/**
 * Загружает расчет из истории и восстанавливает состояние калькулятора
 * Исправление: принудительно восстанавливает totalPrice и вызывает перерисовку UI
 */
function loadFromHistory(id) {
  const history = getHistory();
  const item = history.find(h => h.id === id);
  
  if (!item) {
    alert('Расчёт не найден');
    return;
  }
  
  if (!confirm(`Загрузить расчёт от ${item.date}?\n\nБренд: ${item.brandName}\nКомнат: ${item.roomsCount}\n\nТекущие несохраненные данные будут заменены.`)) {
    return;
  }
  
  // 1. Переключаем бренд если нужно
  if (item.brand !== currentBrand && typeof switchBrand === 'function') {
    switchBrand(item.brand);
  }
  
  // 2. Восстанавливаем данные комнат
  if (item.roomsData) {
    // Очищаем текущие данные
    for (let key in roomsData) {
      delete roomsData[key];
    }
    // Восстанавливаем из истории
    Object.assign(roomsData, item.roomsData);
    
    // Обновляем сетку комнат и UI
    if (typeof updateRoomGrid === 'function') updateRoomGrid();
    if (typeof renderRooms === 'function') renderRooms();
    
    const roomCountInput = document.getElementById('roomCount');
    if (roomCountInput) roomCountInput.value = Object.keys(item.roomsData).length;
  }
  
  // 3. Восстанавливаем глобальный объект результатов
  calculationResults = {
    indoorUnits: item.indoorUnits.map(u => ({
        room: u.room,
        loadW: u.loadW,
        margin: u.margin,
        requiredKW: u.requiredKW,
        selectedUnit: {
            model: u.model,
            hcCode: u.hcCode,
            power: u.power,
            type: u.type,
            line: u.line
        },
        type: u.type,
        line: u.line,
        power: u.power
    })),
    outdoorUnit: item.outdoorUnit,
    roomsData: item.roomsData,
    branchOptions: item.branchOptions || [],
    selectedBranchOption: item.selectedBranchOption || null,
    
    // ✅ КРИТИЧЕСКИ ВАЖНО: Восстанавливаем сохраненную цену!
    totalPrice: item.totalPrice || 0 
  };

  // Восстанавливаем информацию о подобранном блоке в roomsData
  if (item.indoorUnits) {
    item.indoorUnits.forEach(u => {
      if (roomsData[u.room]) {
        roomsData[u.room].selectedUnit = {
          model: u.model,
          hcCode: u.hcCode,
          power: u.power,
          type: u.type,
          line: u.line
        };
      }
    });
  }
  
  // 4. Показываем блок результатов
  const resultBlock = document.getElementById('result');
  if (resultBlock) resultBlock.classList.add('active');
  
  // 5. Показываем распределители если есть
  if (typeof displayBranchOptions === 'function') displayBranchOptions();

  // 6. Генерируем таблицы результатов
  // Передаем fixedTotalPrice, чтобы таблица строилась по сохраненной цене
  if (typeof renderResultsHTML === 'function') {
      const results = renderResultsHTML({
        indoorUnits: calculationResults.indoorUnits,
        outdoorUnit: item.outdoorUnit,
        roomsData: item.roomsData,
        requiredOutdoorPower: item.outdoorUnit.power * parseFloat(item.loadPercent) / 100,
        isFromHistory: true,
        fixedTotalPrice: item.totalPrice 
      });
      
      const summaryEl = document.getElementById('summary');
      if (summaryEl) summaryEl.innerHTML = results.html;
  }
  
  // 7. Показываем и генерируем спецификацию
  const specBlock = document.getElementById('specificationBlock');
  if (specBlock) specBlock.style.display = 'block';
  if (typeof generateSpecification === 'function') generateSpecification();
  
  // 8. Прокручиваем к результатам
  if (resultBlock) resultBlock.scrollIntoView({ behavior: 'smooth' });
  
  // 9. Закрываем панель истории
  const panel = document.getElementById('historyPanel');
  if (panel) panel.style.display = 'none';
  
  // 10. Обновляем кнопку расчёта
  if (typeof updateCalcButtonState === 'function') updateCalcButtonState();
  
  console.log('✅ Расчёт загружен из истории. Цена восстановлена:', calculationResults.totalPrice);
}

/**
 * Удаляет один расчет из истории
 */
function deleteFromHistory(id) {
  if (!confirm('Удалить этот расчёт из истории?')) return;
  
  let history = getHistory();
  history = history.filter(h => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

/**
 * Очищает всю историю
 */
function clearAllHistory() {
  if (!confirm('Удалить ВСЕ расчёты из истории? Это действие нельзя отменить.')) return;
  
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}