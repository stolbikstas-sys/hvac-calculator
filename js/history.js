// === ИСТОРИЯ РАСЧЁТОВ ===
// === СОХРАНЕНИЕ ИСТОРИИ РАСЧЁТОВ ===
const HISTORY_KEY = 'hvac_calc_history';
const MAX_HISTORY = 20; // Максимальное количество записей

// Функция сохранения расчёта
function saveToHistory() {
  if (!calculationResults || !calculationResults.outdoorUnit) {
    return; // Нечего сохранять
  }

const historyItem = {
    id: Date.now(),
    date: new Date().toLocaleString('ru-RU'),
    brand: currentBrand,
    brandName: brands[currentBrand].name,
    roomsCount: Object.keys(calculationResults.roomsData).length,
    // Сохраняем ВСЕ данные для восстановления
    roomsData: calculationResults.roomsData,
    indoorUnits: calculationResults.indoorUnits.map(u => ({
        model: u.selectedUnit.model,
        hcCode: u.selectedUnit.hcCode,
        power: u.power,
        type: u.type,
        line: u.line,
        room: u.room,
        loadW: u.loadW,
        margin: u.margin,
        requiredKW: u.requiredKW
    })),
    outdoorUnit: {
        model: calculationResults.outdoorUnit.model,
        hcCode: calculationResults.outdoorUnit.hcCode,
        power: calculationResults.outdoorUnit.power,
        minRooms: calculationResults.outdoorUnit.minRooms,
        maxRooms: calculationResults.outdoorUnit.maxRooms,
        specs: calculationResults.outdoorUnit.specs,
        requiresBranch: calculationResults.outdoorUnit.requiresBranch || false
    },
    // ✅ СОХРАНЯЕМ распределители
    branchOptions: calculationResults.branchOptions || [],
    selectedBranchOption: calculationResults.selectedBranchOption || null,
    loadPercent: ((calculationResults.indoorUnits.reduce((sum, u) => sum + u.power, 0) / calculationResults.outdoorUnit.power) * 100).toFixed(1),
    totalPrice: calculationResults.indoorUnits.reduce((sum, u) => sum + getPrice(u.selectedUnit.hcCode), 0) + getPrice(calculationResults.outdoorUnit.hcCode)
};

  // Загружаем существующую историю
  let history = getHistory();
  
  // Добавляем в начало
  history.unshift(historyItem);
  
  // Ограничиваем количество
  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }
  
  // Сохраняем
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  
  console.log('✅ Расчёт сохранён в историю');
}

// Получить всю историю
function getHistory() {
  const data = localStorage.getItem(HISTORY_KEY);
  return data ? JSON.parse(data) : [];
}

// Показать/скрыть панель истории
function toggleHistoryPanel() {
  const panel = document.getElementById('historyPanel');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    renderHistory();
    panel.scrollIntoView({ behavior: 'smooth' });
  } else {
    panel.style.display = 'none';
  }
}

// Отрисовать список истории
function renderHistory() {
  const history = getHistory();
  const listEl = document.getElementById('historyList');
  const emptyEl = document.getElementById('historyEmpty');
  
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
          <span style="color: #27ae60; font-weight: 600;">${item.totalPrice > 0 ? item.totalPrice.toLocaleString('ru-RU') + ' ₽' : '—'}</span>
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

// Загрузить расчёт из истории
// Загрузить расчёт из истории
function loadFromHistory(id) {
  const history = getHistory();
  const item = history.find(h => h.id === id);
  
  if (!item) {
    alert('Расчёт не найден');
    return;
  }
  
  if (!confirm(`Загрузить расчёт от ${item.date}?\n\nБренд: ${item.brandName}\nКомнат: ${item.roomsCount}\n\nТекущие данные будут заменены.`)) {
    return;
  }
  
  // 1. Переключаем бренд если нужно
  if (item.brand !== currentBrand) {
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
    
    // Обновляем сетку комнат
    updateRoomGrid();
    
    // Обновляем количество комнат в UI
    const roomCount = Object.keys(item.roomsData).length;
    document.getElementById('roomCount').value = roomCount;
    renderRooms();
  }
  
// 3. Восстанавливаем результаты расчёта
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
    // ✅ ВОССТАНАВЛИВАЕМ распределители
    branchOptions: item.branchOptions || [],
    selectedBranchOption: item.selectedBranchOption || null
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
  
  // 4. Показываем результаты
  document.getElementById('result').classList.add('active');
  // ✅ Показываем блок выбора распределителей, если они есть
  displayBranchOptions();


// 5. Генерируем таблицы результатов
const results = renderResultsHTML({
    indoorUnits: calculationResults.indoorUnits,
    outdoorUnit: item.outdoorUnit,
    roomsData: item.roomsData,
    requiredOutdoorPower: item.outdoorUnit.power * parseFloat(item.loadPercent) / 100,
    isFromHistory: true
});

const totalPrice = results.totalPrice;
const tableHTML = results.html;
  
  document.getElementById('summary').innerHTML = tableHTML;
  
  // 6. Показываем блок спецификации
  document.getElementById('specificationBlock').style.display = 'block';
  
  // 7. Автоматически генерируем спецификацию
  generateSpecification();
  
  // 8. Прокручиваем к результатам
  document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
  
  // 9. Закрываем панель истории
  document.getElementById('historyPanel').style.display = 'none';
  
  // 10. Обновляем кнопку расчёта
  updateCalcButtonState();
  
  console.log('✅ Расчёт загружен из истории');
}

// Удалить один расчёт
function deleteFromHistory(id) {
  if (!confirm('Удалить этот расчёт из истории?')) {
    return;
  }
  
  let history = getHistory();
  history = history.filter(h => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

// Очистить всю историю
function clearAllHistory() {
  if (!confirm('Удалить ВСЕ расчёты из истории?')) {
    return;
  }
  
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}