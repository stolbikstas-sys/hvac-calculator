// === UI-ФУНКЦИИ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let currentBrand = "ballu-free";
let database = brands[currentBrand].database;
let lineImages = brands[currentBrand].lineImages;
const roomsData = {};
let currentRoom = null;
let projectName = '';
let projectComment = '';
let pricesData = {};
let calculationResults = {
    indoorUnits: [],
    outdoorUnit: null,
    roomsData: {}
};

// === ФУНКЦИЯ ЗАГРУЗКИ CSV ===
async function loadPrices() {
  const statusEl = document.getElementById('priceStatus');
  
  try {
    const response = await fetch('prices.csv');
    if (!response.ok) throw new Error('Файл не найден');
    
    let csvText = await response.text();
    
    // Удаляем BOM-символ
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1);
    }
    
    const rows = csvText.split('\n').map(row => row.trim()).filter(row => row);
    
    if (rows.length < 2) throw new Error('Файл пустой');
    
    // Автоопределение разделителя
    const firstRow = rows[0];
    let separator = ',';
    if (firstRow.includes(';')) separator = ';';
    else if (firstRow.includes('\t')) separator = '\t';
    
    const headers = firstRow.split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Функция гибкого поиска колонки (ищет по подстроке, без учета регистра)
    function findColumn(searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      // Точное совпадение
      let idx = headers.findIndex(h => h.toLowerCase() === lowerSearch);
      if (idx !== -1) return idx;
      // Поиск по подстроке
      idx = headers.findIndex(h => h.toLowerCase().includes(lowerSearch));
      return idx;
    }
    
    const hcIndex = findColumn('HC');
    const articleIndex = findColumn('Артикул');
    const розницаIdx = findColumn('Розница');
    const дилерIdx = findColumn('Дилер');
    const д2Idx = findColumn('Д2');
    const bigIdx = findColumn('BIG');
    
    if (hcIndex === -1) {
      throw new Error('Колонка HC-код не найдена. Заголовки в файле: [' + headers.join(', ') + ']');
    }
    
    pricesData = {};
    let loadedCount = 0;
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // Пропускаем пустые строки и строки без HC-кода
      if (!row || row.length < 5) continue;
      
      const values = row.split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
      if (values.length < hcIndex + 1) continue;
      
      let hcCode = values[hcIndex];
      // Пропускаем пустые HC-коды и заголовки разделов
      if (!hcCode || hcCode.length < 5 || hcCode.includes('FREE') || hcCode.includes('MATCH')) continue;
      
      // Заменяем кириллицу на латиницу
      hcCode = hcCode.replace(/НС/g, 'HC').replace(/Н/g, 'H').replace(/С/g, 'C').trim();
      
      const article = articleIndex !== -1 ? values[articleIndex] : '';
      
      pricesData[hcCode] = {
        article: article,
        Розница: розницаIdx !== -1 ? parseFloat(String(values[розницаIdx]).replace(/\s/g, '')) || 0 : 0,
        Дилер: дилерIdx !== -1 ? parseFloat(String(values[дилерIdx]).replace(/\s/g, '')) || 0 : 0,
        Д2: д2Idx !== -1 ? parseFloat(String(values[д2Idx]).replace(/\s/g, '')) || 0 : 0,
        BIG: bigIdx !== -1 ? parseFloat(String(values[bigIdx]).replace(/\s/g, '')) || 0 : 0
      };
      loadedCount++;
    }
    
    statusEl.textContent = `✅ Загружено ${loadedCount} позиций`;
    statusEl.style.color = '#27ae60';
    
    localStorage.setItem('pricesData', JSON.stringify(pricesData));
    localStorage.setItem('priceLoadTime', new Date().toLocaleString());
    
  } catch (error) {
    statusEl.textContent = `❌ Ошибка: ${error.message}`;
    statusEl.style.color = '#e74c3c';
  }
}

// === ЗАГРУЗКА ЦЕН ПРИ СТАРТЕ ===
function loadPricesFromStorage() {
  const saved = localStorage.getItem('pricesData');
  if (saved) {
    pricesData = JSON.parse(saved);
    const statusEl = document.getElementById('priceStatus');
    const loadTime = localStorage.getItem('priceLoadTime') || '';
    const count = Object.keys(pricesData).length;
    statusEl.textContent = `Загружено ${count} позиций ${loadTime ? '(' + loadTime + ')' : ''}`;
    statusEl.style.color = '#27ae60';
  }
}

// === ПОЛУЧЕНИЕ ЦЕНЫ ===
function getPrice(hcCode) {
  if (pricesData[hcCode]) {
    return pricesData[hcCode]['Розница'] || 0;
  }
  return 0;
}

// === ПОЛУЧЕНИЕ АРТИКУЛА ===
function getArticle(hcCode) {
  if (pricesData[hcCode]) {
    return pricesData[hcCode].article || '';
  }
  return '';
}

function initBrandTabs() {
  const container = document.getElementById('brandTabs');
  container.innerHTML = '';
  for (const [key, brand] of Object.entries(brands)) {
    const btn = document.createElement('button');
    btn.className = `brand-btn ${key === currentBrand ? 'active' : ''}`;
    btn.textContent = brand.name;
    btn.onclick = () => switchBrand(key);
    container.appendChild(btn);
  }
}

function switchBrand(brandKey) {
  if (brandKey === currentBrand) return;
  currentBrand = brandKey;
  const brandData = brands[currentBrand];
  document.documentElement.style.setProperty('--brand-color', brandData.color);
  document.documentElement.style.setProperty('--brand-color-hover', brandData.color);
  lineImages = brands[currentBrand].lineImages;
  database = brands[currentBrand].database;
  document.querySelectorAll('.brand-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === brandData.name);
  });
  for (let key in roomsData) delete roomsData[key];
  document.getElementById('result').classList.remove('active');
  document.getElementById('roomInputs').classList.remove('active');
  updateDropdownsForBrand();
  renderRooms();
  updateBrandLogo();
  updateMaxRooms(); // ← Добавить эту строку
}

// === ФУНКЦИЯ ОБНОВЛЕНИЯ ЛОГОТИПА ===
function updateBrandLogo() {
  const logoImg = document.getElementById('brandLogo');
  const brandData = brands[currentBrand];
  
  if (brandData.logo) {
    logoImg.src = brandData.logo;
    logoImg.classList.add('visible');
  } else {
    logoImg.classList.remove('visible');
    setTimeout(() => {
      logoImg.src = '';
    }, 300);
  }
}

function updateDropdownsForBrand() {
  const typeSelect = document.getElementById('unitType');
  const brandData = brands[currentBrand];
  typeSelect.innerHTML = '';
  brandData.types.forEach(type => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    typeSelect.appendChild(opt);
  });
  updateLinesForType(typeSelect.value);
}

function updateLinesForType(type) {
  const lineSelect = document.getElementById('unitLine');
  const brandData = brands[currentBrand];
  lineSelect.innerHTML = '';
  const lines = brandData.lines[type];
  if (lines && lines.length > 0) {
    lines.forEach(line => {
      const opt = document.createElement('option');
      opt.value = line;
      opt.textContent = line === null ? "Стандарт" : line;
      lineSelect.appendChild(opt);
    });
    document.getElementById('seriesRow').classList.remove('hidden');
  } else {
    document.getElementById('seriesRow').classList.add('hidden');
  }
}

function toggleSeriesField() {
  const type = document.getElementById('unitType').value;
  updateLinesForType(type);
  updateUnitImage();
}

function updateUnitImage() {
  const type = document.getElementById('unitType').value;
  const line = document.getElementById('unitLine').value;
  const img = document.getElementById('unitImage');
  const placeholder = document.getElementById('unitPlaceholder');
  const featuresIcon = document.getElementById('featuresIcon');
  const featuresList = document.getElementById('featuresList');
  
  let src = null;
  let featureKey = null;
  
  // Определяем ключ для поиска УТП
  if (type === 'Настенный' && line) {
    // Для настенных — используем линейку
    featureKey = line;
    if (lineImages[line]) src = lineImages[line];
  } else {
    // Для кассетных, канальных, консольных — используем тип
    featureKey = type;
    if (lineImages[type]) src = lineImages[type];
  }
  
  if (src) {
    img.src = src;
    img.style.display = 'inline-block';
    placeholder.style.display = 'none';
    
    // Ищем УТП с учётом бренда
    const brandFeatures = featuresDB[currentBrand];
    if (brandFeatures && brandFeatures[featureKey]) {
      featuresList.innerHTML = brandFeatures[featureKey].map(f => `<li>${f}</li>`).join('');
      featuresIcon.style.display = 'flex';
    } else {
      featuresIcon.style.display = 'none';
    }
  } else {
    img.style.display = 'none';
    placeholder.innerHTML = `🖼️ Изображение ${type.toLowerCase()}`;
    placeholder.style.display = 'block';
    featuresIcon.style.display = 'none';
  }
}

function renderRooms() {
    const count = parseInt(document.getElementById('roomCount').value) || 2;
    const container = document.getElementById('apartment');
    container.innerHTML = '';
    
    // ✅ СОХРАНЯЕМ существующие данные, удаляем только лишние
    const existingRooms = Object.keys(roomsData).map(Number);
    for(let key in roomsData) {
        if (Number(key) > count) {
            delete roomsData[key];
        }
    }
    
    updateCalcButtonState();
    updateRoomGrid(); // ✅ Обновляем визуальные метки
    
    for (let i = 1; i <= count; i++) {
        const room = document.createElement('div');
        let className = 'room';
        if (roomsData[i]) className += ' filled'; // ✅ Показываем заполненные
        room.className = className;
        room.textContent = `Комната ${i}`;
        room.onclick = () => selectRoom(i);
        container.appendChild(room);
    }
    
    // Если есть хотя бы одна комната — выбираем первую незаполненную
    if(count >= 1) {
        let firstEmpty = null;
        for (let i = 1; i <= count; i++) {
            if (!roomsData[i]) { firstEmpty = i; break; }
        }
        selectRoom(firstEmpty || 1);
    }
}

function selectRoom(num) {
  currentRoom = num;
  document.getElementById('currentRoomNum').textContent = num;
  document.getElementById('roomInputs').classList.add('active');
  updateDropdownsForBrand();
  if (roomsData[num]) {
    const d = roomsData[num];
    document.getElementById('unitType').value = d.unitType;
    updateLinesForType(d.unitType);
if (d.unitLine) {
  document.getElementById('unitLine').value = d.unitLine;
}
    document.getElementById('area').value = d.area;
    document.getElementById('height').value = d.height;
    document.getElementById('insolation').value = d.insolation;
    document.getElementById('peopleType').value = d.peopleType;
    document.getElementById('peopleCount').value = d.peopleCount;
    document.getElementById('equipType').value = d.equipType;
    document.getElementById('equipCount').value = d.equipCount;
    document.getElementById('margin').value = d.margin ?? 20;
  } else {
    document.getElementById('area').value = 15;
    document.getElementById('height').value = 2.7;
    document.getElementById('peopleCount').value = 1;
    document.getElementById('equipCount').value = 1;
    document.getElementById('margin').value = 0;
  }
  updateUnitImage();
  document.querySelectorAll('.room').forEach((el, idx) => {
    el.classList.toggle('active', idx + 1 === num);
  });
}

function saveRoomData() {
  const area = parseFloat(document.getElementById('area').value);
  const height = parseFloat(document.getElementById('height').value);
  const insolation = parseFloat(document.getElementById('insolation').value);
  const peopleCount = parseInt(document.getElementById('peopleCount').value);
  const equipCount = parseInt(document.getElementById('equipCount').value);
  const margin = parseInt(document.getElementById('margin').value);
  const unitType = document.getElementById('unitType').value;
  const unitLine = document.getElementById('unitLine').value;
  
  if (!area || area <= 0) {
    alert('Укажите площадь комнаты');
    document.getElementById('area').focus();
    return;
  }
  
  if (!height || height <= 0) {
    alert('Укажите высоту потолка');
    document.getElementById('height').focus();
    return;
  }
  
  if (!insolation || insolation <= 0) {
    alert('Укажите уровень инсоляции');
    return;
  }
  
  if (!unitType) {
    alert('Выберите тип блока');
    return;
  }
  
  if (unitType === 'Настенный' && !unitLine) {
    alert('Выберите линейку блока');
    return;
  }

  if (!currentRoom) return;
  
  const finalUnitLine = (document.getElementById('seriesRow').classList.contains('hidden')) 
    ? null 
    : unitLine;
  
  roomsData[currentRoom] = {
    unitType: unitType,
    unitLine: finalUnitLine === "null" || finalUnitLine === "Стандарт" ? null : finalUnitLine,
    area: area,
    height: height || 2.7,
    insolation: insolation,
    peopleType: parseInt(document.getElementById('peopleType').value),
    peopleCount: peopleCount || 0,
    equipType: parseInt(document.getElementById('equipType').value),
    equipCount: equipCount || 0,
    margin: isNaN(margin) ? 0 : margin
  };
  updateRoomGrid();
  updateCalcButtonState();
  const total = parseInt(document.getElementById('roomCount').value);
  let next = null;
  for (let i = 1; i <= total; i++) {
    if (!roomsData[i]) { next = i; break; }
  }
  if (next) {
    setTimeout(() => selectRoom(next), 300);
  } else {
    document.getElementById('roomInputs').classList.remove('active');
    document.getElementById('calcBtn').scrollIntoView({behavior: "smooth"});
  }
}

function updateRoomGrid() {
  document.querySelectorAll('.room').forEach((el, idx) => {
    const roomNum = idx + 1;
    if (roomsData[roomNum]) {
      el.classList.add('filled');
      el.textContent = `Комната ${roomNum}`;
    } else {
      el.classList.remove('filled');
      el.textContent = `Комната ${roomNum}`;
    }
  });
}

function updateCalcButtonState() {
  const total = parseInt(document.getElementById('roomCount').value) || 2;
  const btn = document.getElementById('calcBtn');
  let allFilled = true;
  let emptyCount = 0;
  for (let i = 1; i <= total; i++) {
    if (!roomsData[i]) { allFilled = false; emptyCount++; }
  }
  if (allFilled && total > 0 && Object.keys(roomsData).length > 0) {
    btn.classList.remove('waiting');
    btn.classList.add('ready');
    btn.textContent = `Рассчитать систему`;
  } else {
    btn.classList.add('waiting');
    btn.classList.remove('ready');
    btn.textContent = `Заполните комнаты (осталось ${emptyCount})`;
  }
}

// === ДИНАМИЧЕСКОЕ ИЗМЕНЕНИЕ МАКСИМУМА КОМНАТ ===
function updateMaxRooms() {
  const roomCountInput = document.getElementById('roomCount');
  const maxRoomsLabel = document.getElementById('maxRoomsLabel');
  
  let maxRooms;
  if (currentBrand === 'electrolux') {
    maxRooms = 9;
  } else {
    maxRooms = 5;
  }
  
  roomCountInput.max = maxRooms;
  maxRoomsLabel.textContent = maxRooms;
  
  // Если текущее значение больше нового максимума — сбрасываем
  if (parseInt(roomCountInput.value) > parseInt(roomCountInput.max)) {
    roomCountInput.value = roomCountInput.max;
  }
}

// === ГРУППИРОВКА ВНУТРЕННИХ БЛОКОВ ПО МОДЕЛИ ===
function groupIndoorUnits() {
    const indoorGroups = {};
    calculationResults.indoorUnits.forEach(unit => {
        const key = unit.selectedUnit.model;
        if (!indoorGroups[key]) {
            indoorGroups[key] = {
                model: unit.selectedUnit.model,
                hcCode: unit.selectedUnit.hcCode,
                power: unit.selectedUnit.power,
                price: getPrice(unit.selectedUnit.hcCode),
                count: 0
            };
        }
        indoorGroups[key].count++;
    });
    return indoorGroups;
}

function scrollToCalculator() {
    const calculator = document.getElementById('apartment');
    if (calculator) {
        calculator.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    const landing = document.getElementById('landingPage');
    if (landing) {
        setTimeout(() => {
            landing.style.opacity = '0';
            landing.style.transform = 'translateY(-50px)';
            setTimeout(() => {
                landing.style.display = 'none';
            }, 600);
        }, 800);
    }
}

initBrandTabs();
switchBrand('ballu-free');
updateDropdownsForBrand();
renderRooms();
updateBrandLogo();
loadPricesFromStorage();
updateMaxRooms();

