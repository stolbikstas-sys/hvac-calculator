// === ОСНОВНАЯ ЛОГИКА РАСЧЁТА ===
// === ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: Получение кода мощности (07, 09, 12, 18, 24) ===
function getIndoorCode(powerKw) {
  if (powerKw <= 2.3) return "07";
  if (powerKw <= 2.8) return "09";
  if (powerKw <= 3.6) return "12";
  if (powerKw <= 5.5) return "18"; // Включает 5.0 и 5.3
  if (powerKw <= 6.5) return "21"; // Electrolux specific
  return "24"; // 7.0+
}

// === ФУНКЦИЯ ПРОВЕРКИ СОВМЕСТИМОСТИ ===
function checkCompatibility(brandKey, outdoorModel, indoorUnits) {
  const brandData = brands[brandKey];
  // Если таблиц нет для этого бренда, пропускаем проверку (разрешаем всё)
  if (!brandData.combinations || !brandData.combinations[outdoorModel]) return true;

  const allowedCombos = brandData.combinations[outdoorModel];
  const roomCount = indoorUnits.length;
  
  // Получаем коды мощностей (07, 09, 12...)
  const codes = indoorUnits.map(u => getIndoorCode(u.power)).sort();
  const comboString = codes.join("+");
  
  // Проверяем, есть ли такая комбинация в списке разрешенных для этого кол-ва комнат
  if (allowedCombos[roomCount]) {
    return allowedCombos[roomCount].includes(comboString);
  }
  
  return false;
}

function calcRoomLoad(data) {
  const V = data.area * data.height;
  const Q_ins = V * data.insolation;
  const Q_people = data.peopleCount * data.peopleType;
  const Q_equip = data.equipCount * data.equipType;
  return Q_ins + Q_people + Q_equip;
}

function selectIndoorUnit(requiredKW, type, line) {
  // 1. Ищем точное совпадение по типу и линейке
  if (type === 'Настенный' && line) {
    const exactMatch = database.indoor.filter(u => u.type === type && u.line === line);
    for (let unit of exactMatch) {
      if (unit.power >= requiredKW) return unit;
    }
    // Если не нашли в выбранной линейке — возвращаем null
    return null;
  }
  
  // 2. Для кассетных/канальных/консольных ищем по типу
  const typeMatch = database.indoor.filter(u => u.type === type);
  for (let unit of typeMatch) {
    if (unit.power >= requiredKW) return unit;
  }
  
  return null;
}

function selectOutdoorUnit() {
 
    const totalIndoorCapacity = calculationResults.indoorUnits.reduce((sum, room) => {
        return sum + (room.selectedUnit ? room.selectedUnit.power : 0);
    }, 0);
    
    const diversityFactor = parseFloat(document.getElementById('diversityFactor').value) || 125;
    const roomCount = calculationResults.indoorUnits.length;
    
    // Получаем коды мощностей внутренних блоков (07, 09, 12, 18, 24)
    const indoorCodes = calculationResults.indoorUnits
        .map(room => {
            if (!room.selectedUnit) return null;
            const power = room.selectedUnit.power;
            return getIndoorCode(power);
        })
        .filter(code => code !== null)
        .sort();
    
    const combinationKey = indoorCodes.join('+');
    
    // Находим ВСЕ подходящие наружные блоки
    const outdoorUnits = database.outdoor.filter(unit => {
        const unitCapacity = unit.power;
        
        // === ПРОВЕРКА СОВМЕСТИМОСТИ ===
        const brandData = brands[currentBrand];
        let isCompatible = false;
        let compatibilityChecked = false;
        
        if (brandData && brandData.combinations && brandData.combinations[unit.model]) {
            const allowedCombos = brandData.combinations[unit.model];
            compatibilityChecked = true;
            
            // Проверяем для текущего количества комнат
            if (allowedCombos[roomCount]) {
                isCompatible = allowedCombos[roomCount].includes(combinationKey);
            }
            
            // Если не нашли для точного кол-ва комнат, проверяем для меньшего
            // (например, блок для 2-3 комнат может работать и с 4-мя, если мощность позволяет)
            if (!isCompatible) {
                for (let i = roomCount; i >= 1; i--) {
                    if (allowedCombos[i] && allowedCombos[i].includes(combinationKey)) {
                        isCompatible = true;
                        break;
                    }
                }
            }
        }
        
        // Если таблиц совместимости нет — разрешаем все комбинации
        if (!compatibilityChecked) {
            isCompatible = true;
        }
        
        // Проверяем мощность (с учетом diversity factor)
        const maxAllowedSum = (unitCapacity * diversityFactor) / 100;
        const isPowerSufficient = totalIndoorCapacity <= maxAllowedSum;
        
        // Проверяем загрузку (от 50% до 160%)
        const loadPercent = (totalIndoorCapacity / unitCapacity) * 100;
        const isLoadAcceptable = loadPercent <= 160 && loadPercent >= 50;
        
        return isCompatible && isPowerSufficient && isLoadAcceptable;
    });
    
    // Если ничего не нашли — пробуем найти просто по мощности (без проверки совместимости)
    if (outdoorUnits.length === 0) {
        console.warn('Не найдено блоков с проверкой совместимости. Пробуем поиск только по мощности...');
        console.log('Комбинация:', combinationKey);
        
        const fallbackUnits = database.outdoor.filter(unit => {
            const unitCapacity = unit.power;
            const maxAllowedSum = (unitCapacity * diversityFactor) / 100;
            const isPowerSufficient = totalIndoorCapacity <= maxAllowedSum;
            const loadPercent = (totalIndoorCapacity / unitCapacity) * 100;
            return isPowerSufficient && loadPercent <= 130 && loadPercent >= 50;
        });
        
        fallbackUnits.forEach(u => u.isFallback = true);
        
        return fallbackUnits.map(unit => {
            const capacity = unit.power;
            const loadPercent = (totalIndoorCapacity / capacity) * 100;
            const price = getPrice(unit.hcCode);
            
            return {
                unit: unit,
                loadPercent: loadPercent.toFixed(1),
                price: price,
                isRecommended: loadPercent >= 80 && loadPercent <= 100,
                requiresBranch: unit.requiresBranch || capacity >= 48
            };
        });
    }
    
    // Сортируем по мощности (от меньшей к большей)
    outdoorUnits.sort((a, b) => a.power - b.power);
    
    // Возвращаем варианты с расчетами
    return outdoorUnits.map(unit => {
        const capacity = unit.power;
        const loadPercent = (totalIndoorCapacity / capacity) * 100;
        const price = getPrice(unit.hcCode);
        
        return {
            unit: unit,
            loadPercent: loadPercent.toFixed(1),
            price: price,
            isRecommended: loadPercent >= 80 && loadPercent <= 100,
            requiresBranch: unit.requiresBranch || capacity >= 48
        };
    });
}

function renderOutdoorOptions() {
    const options = calculationResults.outdoorOptions;
    

     // === ВРЕМЕННАЯ ОТЛАДКА ===
    console.log('=== ПРОВЕРКА renderOutdoorOptions ===');
    console.log('options:', options);
    console.log('Длина массива:', options ? options.length : 'undefined');
    if (options && options.length > 0) {
        console.log('Первый вариант:', options[0]);
    }
    // =========================
    
    if (!options || options.length === 0) {
        return '<p style="color: #e74c3c; font-weight: 600; padding: 20px; background: #fee; border-radius: 8px;">❌ Не найдено подходящих наружных блоков. Проверьте комбинацию внутренних блоков.</p>';
    }


    if (!options || options.length === 0) {
        return '<p style="color: #e74c3c; font-weight: 600;">❌ Не найдено подходящих наружных блоков</p>';
    }
    
    let html = '<div style="margin: 20px 0;">';
    html += '<h3 style="color: #2c3e50; margin-bottom: 15px;">Выберите наружный блок:</h3>';
    html += '<div style="display: grid; gap: 15px;">';
    
    options.forEach((option, index) => {
        const { unit, loadPercent, price, isRecommended } = option;
        const isSelected = index === 0;
        
        // Цвет загрузки
        let loadColor = '#27ae60';
        let loadText = 'Оптимальная';
        if (loadPercent > 130) { loadColor = '#e74c3c'; loadText = 'Высокая'; }
        if (loadPercent < 60) { loadColor = '#3498db'; loadText = 'Низкая'; }
        
        const recommendedBadge = '';  // Просто пустая строка
        html += `
            <div style="border: 2px solid ${isSelected ? 'var(--brand-color)' : '#e2e8f0'}; 
                        border-radius: 8px; padding: 20px; background: white; 
                        cursor: pointer; transition: all 0.3s;"
                 onclick="selectOutdoorOption(${index})"
                 id="outdoor-option-${index}">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div>
                         <h4 style="margin: 0 0 5px 0; color: #2c3e50;">
                           ${unit.model}
                          </h4>
                        <p style="margin: 0; color: #718096; font-size: 14px;">
                            ${unit.fullName || unit.model}
                        </p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 20px; font-weight: 700; color: var(--brand-color);">
                            ${price.toLocaleString('ru-RU')} ₽
                        </div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
                    <div style="background: #f7fafc; padding: 10px; border-radius: 6px;">
                        <div style="font-size: 12px; color: #718096; margin-bottom: 5px;">Мощность</div>
                        <div style="font-weight: 600; color: #2d3748;">${unit.power} кВт</div>
                    </div>
                    <div style="background: #f7fafc; padding: 10px; border-radius: 6px;">
                        <div style="font-size: 12px; color: #718096; margin-bottom: 5px;">Загрузка</div>
                        <div style="font-weight: 600; color: ${loadColor};">${loadPercent}% (${loadText})</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    // Блок с характеристиками выбранного блока (как на скриншоте)
    html += '<div id="selectedOutdoorSpecs" style="margin-top: 30px;"></div>';
    
    html += '</div>';
    
    return html;
}

function selectOutdoorOption(index) {
    // Убираем выделение со всех вариантов
    document.querySelectorAll('[id^="outdoor-option-"]').forEach(el => {
        el.style.borderColor = '#e2e8f0';
    });
    
    // Выделяем выбранный
    const selectedElement = document.getElementById(`outdoor-option-${index}`);
    if (selectedElement) {
        selectedElement.style.borderColor = 'var(--brand-color)';
    }
    
    // Сохраняем выбранный вариант
    const selectedOption = calculationResults.outdoorOptions[index];
    calculationResults.selectedOutdoorOption = selectedOption;
    calculationResults.outdoorUnit = selectedOption.unit;
    
    // === ЛОГИКА РАСПРЕДЕЛИТЕЛЕЙ (ИСПРАВЛЕННАЯ) ===
    if (selectedOption.requiresBranch) {
        const branchBlock = document.getElementById('branchOptionsBlock');
        if (branchBlock) {
            // 1. СНАЧАЛА подбираем варианты и сохраняем в calculationResults!
            const branchResult = selectAllBranchOptions(calculationResults.indoorUnits.length, currentBrand);
            
            if (branchResult.error) {
                console.warn(branchResult.error);
                calculationResults.branchOptions = [];
                branchBlock.style.display = 'none';
            } else {
                calculationResults.branchOptions = branchResult.options;
                
                // Выбираем первый (рекомендуемый) по умолчанию
                if (calculationResults.branchOptions.length > 0) {
                    calculationResults.selectedBranchOption = calculationResults.branchOptions[0];
                }

                branchBlock.style.display = 'block';
                
                // 2. ТОЛЬКО ТЕПЕРЬ отображаем
                if (typeof displayBranchOptions === 'function') {
                    displayBranchOptions();
                }

                
                // Прокрутка к блоку распределителей
                   setTimeout(() => {
                    branchBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
                 }, 300);
            }
        }
    } else {
        // Если распределитель не нужен, скрываем блок и очищаем данные
        calculationResults.branchOptions = [];
        calculationResults.selectedBranchOption = null;
        const branchBlock = document.getElementById('branchOptionsBlock');
        if (branchBlock) branchBlock.style.display = 'none';
    }

    // Показываем таблицу характеристик
    renderSelectedOutdoorSpecs(selectedOption);
    
    // Пересчитываем общую стоимость
    calculateTotalPrice();
}

function calculateSystem() {
    const totalRooms = parseInt(document.getElementById('roomCount').value);

    // === ВАЛИДАЦИЯ ПЕРЕД РАСЧЁТОМ ===
    for (let i = 1; i <= totalRooms; i++) {
        const d = roomsData[i];
        if (!d || !d.area || d.area <= 0) { alert(`⚠️ Комната ${i}: не указана площадь`); selectRoom(i); return; }
        if (!d.height || d.height <= 0) { alert(`⚠️ Комната ${i}: не указана высота потолка`); selectRoom(i); return; }
        if (!d.unitType) { alert(`⚠️ Комната ${i}: не выбран тип блока`); selectRoom(i); return; }
        if (d.unitType === 'Настенный' && !d.unitLine) { alert(`⚠️ Комната ${i}: не выбрана линейка блока`); selectRoom(i); return; }
    }

    const btn = document.getElementById('calcBtn');
    if (btn.classList.contains('waiting')) {
        let missing = [];
        for(let i=1; i<=totalRooms; i++) if(!roomsData[i] || !roomsData[i].unitType) missing.push(i);
        if (missing.length > 0) {
            alert(`⚠️ Вы заполнили не все комнаты. Введите данные для: ${missing.join(', ')}`);
            return;
        }
    }
    
    const diversity = parseInt(document.getElementById('diversityFactor').value) / 100;
    let sumIndoorPower = 0;
    const indoorUnits = [];
    let hasError = false;
    let errorMessage = '';
    
    for (let i = 1; i <= totalRooms; i++) {
        const d = roomsData[i];
        const qRaw = calcRoomLoad(d);
        const margin = d.margin / 100;
        const requiredKW = qRaw * (1 + margin) / 1000;
        const selectedUnit = selectIndoorUnit(requiredKW, d.unitType, d.unitLine);
        
        if (!selectedUnit) {
            hasError = true;
            errorMessage += `• Комната ${i}: в линейке "${d.unitLine || d.unitType}" нет блока мощностью ${requiredKW.toFixed(2)} кВт\n`;
            continue;
        }
        
        sumIndoorPower += selectedUnit.power;
        indoorUnits.push({ 
            room: i, loadW: qRaw, margin: d.margin, requiredKW: requiredKW,
            selectedUnit: selectedUnit, type: d.unitType, line: d.unitLine, power: selectedUnit.power
        });
    }
    
    if (hasError) {
        alert(`⚠️ Не удалось подобрать блоки:\n\n${errorMessage}\nУменьшите площадь/нагрузку или выберите другую линейку.`);
        return;
    }

    // 1. Сначала сохраняем внутренние блоки в глобальный объект!
    calculationResults.indoorUnits = indoorUnits;
    calculationResults.roomsData = roomsData;
    calculationResults.projectName = document.getElementById('projectName').value.trim();
    calculationResults.projectComment = document.getElementById('projectComment').value.trim();

    // 2. Получаем МАССИВ вариантов наружных блоков
    const outdoorOptions = selectOutdoorUnit();

    if (!outdoorOptions || outdoorOptions.length === 0) {
        alert("⚠️ Не найдено подходящих наружных блоков для выбранной комбинации внутренних блоков.");
        return;
    }

    calculationResults.outdoorOptions = outdoorOptions;

    // 3. Генерируем HTML
    const results = renderResultsHTML({
        indoorUnits: indoorUnits,
        outdoorOptions: outdoorOptions,
        roomsData: roomsData,
        requiredOutdoorPower: sumIndoorPower / diversity
    });
    
    document.getElementById('specificationBlock').style.display = 'block';
    document.getElementById('summary').innerHTML = results.html;
    document.getElementById('result').classList.add('active');
    document.getElementById('result').scrollIntoView({ behavior: 'smooth' });

    // 4. Автоматически выбираем первый вариант наружного блока БЕЗ лишнего скролла
    setTimeout(() => {
        const firstOption = calculationResults.outdoorOptions[0];
        if (firstOption) {
            // Сохраняем выбор в память
            calculationResults.selectedOutdoorOption = firstOption;
            calculationResults.outdoorUnit = firstOption.unit;
            
            // Пересчитываем итоговую цену
            calculateTotalPrice();
            
            // Если блоку нужны распределители — сразу подбираем их
            if (firstOption.requiresBranch && typeof selectAllBranchOptions === 'function') {
                 const branchResult = selectAllBranchOptions(calculationResults.indoorUnits.length, currentBrand);
                 if (branchResult.options && branchResult.options.length > 0) {
                     calculationResults.branchOptions = branchResult.options;
                     calculationResults.selectedBranchOption = branchResult.options[0];
                     displayBranchOptions();
                     document.getElementById('branchOptionsBlock').style.display = 'block';
                 }
            }
        }
        
        // СКРОЛЛИМ СТРОГО К НАЧАЛУ БЛОКА РЕЗУЛЬТАТОВ
        const resultBlock = document.getElementById('result');
        if (resultBlock) {
            resultBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);

    saveToHistory();
}

// === ГЕНЕРАЦИЯ ТАБЛИЦЫ ХАРАКТЕРИСТИК НАРУЖНОГО БЛОКА ===
function getOutdoorSpecsHTML(unit) {
  // Если реальных данных ещё нет, используем заглушку (потом заменим на ваши данные)
  const s = unit.specs || {
    cooling: "4.1", heating: "4.5", efficiency: "A++/A+", noise: "52",
    dimensions: "720×550×285", weight: "28", pipeLenSingle: "15",
    pipeLenTotal: "25", heightDiff: "5", refrigerant: "R32",
    tempCool: "-15...+46", tempHeat: "-15...+24"
  };

  return `
    <h4 style="margin: 35px 0 15px; color: var(--brand-color); font-weight: 600; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
      Технические характеристики наружного блока
    </h4>
    <table class="outdoor-specs-table">
      <tbody>
        <tr><th>Производительность охлаждения</th><td>${s.cooling} кВт</td></tr>
        <tr><th>Производительность обогрева</th><td>${s.heating} кВт</td></tr>
        <tr><th>Класс энергоэффективности</th><td>${s.efficiency}</td></tr>
        <tr><th>Уровень шума</th><td>${s.noise} дБ</td></tr>
        <tr><th>Размеры внешнего блока (Ш×В×Г)</th><td>${s.dimensions} мм</td></tr>
        <tr><th>Вес нетто</th><td>${s.weight} кг</td></tr>
        <tr><th>Макс. длина трассы (до 1 блока)</th><td>${s.pipeLenSingle} м</td></tr>
        <tr><th>Макс. длина трассы (общая)</th><td>${s.pipeLenTotal} м</td></tr>
        <tr><th>Максимальный перепад высот</th><td>${s.heightDiff} м</td></tr>
        <tr><th>Хладагент</th><td>${s.refrigerant} г</td></tr>
        <tr><th>Рабочая температура (охлаждение)</th><td>${s.tempCool} °C</td></tr>
        <tr><th>Рабочая температура (обогрев)</th><td>${s.tempHeat} °C</td></tr>
      </tbody>
    </table>
  `;
}

function renderResultsHTML(data) {
    const { indoorUnits, outdoorOptions, roomsData, requiredOutdoorPower } = data;
    
    let totalPrice = 0;
    let html = `
    <div style="overflow-x: auto;">
    <table class="result-table">
    <thead>
    <tr>
        <th>Комната</th><th>Площадь, м²</th><th>Тип / Линейка</th><th>Запас, %</th>
        <th>Требуемая мощность</th><th>Номинальная мощность</th><th>Внутренний блок</th><th>HC-код</th>
    </tr>
    </thead>
    <tbody>`;
    
    indoorUnits.forEach(u => {
        const typeBadge = `<span class="badge badge-type">${u.type}</span>`;
        const lineBadge = u.line ? `<span class="badge badge-line">${u.line}</span>` : '';
        const price = getPrice(u.selectedUnit.hcCode);
        totalPrice += price;
        const roomData = roomsData[u.room] || {};
        
        html += `<tr>
            <td><strong>${u.room}</strong></td>
            <td>${roomData.area || '—'}</td>
            <td>${typeBadge}${lineBadge}</td>
            <td>${u.margin || 0}%</td>
            <td>${u.requiredKW.toFixed(2)} кВт</td>
            <td style="font-weight: 600; color: var(--brand-color);">${u.power} кВт</td>
            <td>${u.selectedUnit.model}</td>
            <td><span class="hc-code">${u.selectedUnit.hcCode}</span></td>
        </tr>`;
    });
    
    html += `</tbody></table></div>`;
    
    // === БЛОК ВЫБОРА НАРУЖНЫХ БЛОКОВ ===
    html += '<div id="outdoorSelection" style="margin-top: 30px;">';
    html += renderOutdoorOptions();
    html += '</div>';
    return { html, totalPrice };
}

function calculateTotalPrice() {
    let totalPrice = 0;
    
    // 1. Сумма внутренних блоков
    calculationResults.indoorUnits.forEach(room => {
        if (room.selectedUnit) {
            totalPrice += getPrice(room.selectedUnit.hcCode);
        }
    });
    
    // 2. Добавляем выбранный наружный блок
    if (calculationResults.selectedOutdoorOption) {
        totalPrice += calculationResults.selectedOutdoorOption.price;
    }
    
    // 3. === ДОБАВЛЕНО: Сумма блоков-распределителей ===
    if (calculationResults.selectedBranchOption) {
        totalPrice += calculationResults.selectedBranchOption.totalPrice;
    }
    
    calculationResults.totalPrice = totalPrice;
    
    // Обновляем отображение общей стоимости
    const totalElement = document.querySelector('#result .total-price');
    if (totalElement) {
        totalElement.textContent = totalPrice.toLocaleString('ru-RU') + ' ₽';
    }
}

function renderSelectedOutdoorSpecs(option) {
    const { unit, loadPercent, price } = option;
    
    // Считаем общую мощность внутренних блоков для таблицы
    const totalIndoorCapacity = calculationResults.indoorUnits.reduce((sum, room) => {
        return sum + (room.selectedUnit ? room.selectedUnit.power : 0);
    }, 0);

    const container = document.getElementById('selectedOutdoorSpecs');
    if (!container) {
        console.error("Контейнер #selectedOutdoorSpecs не найден!");
        return;
    }

    // Цвет загрузки (преобразуем строку "85.0" в число для сравнения)
    const loadNum = parseFloat(loadPercent);
    let loadColor = '#27ae60'; // Зеленый
    if (loadNum > 130) loadColor = '#e74c3c'; // Красный
    if (loadNum < 60) loadColor = '#3498db';  // Синий

    // Берем specs из unit. Если вдруг их нет, ставим заглушки, чтобы не ломалось
    const specs = unit.specs || {
        cooling: unit.power,
        heating: "—",
        efficiency: "—",
        noise: "—",
        dimensions: "—",
        weight: "—",
        pipeLenSingle: "—",
        pipeLenTotal: "—",
        heightDiff: "—",
        refrigerant: "—",
        tempCool: "—",
        tempHeat: "—"
    };

    let html = '';

    // === ТАБЛИЦА 1: Основная информация ===
    html += `
        <h3 style="color: var(--brand-color); margin: 30px 0 15px; font-size: 18px; font-weight: 600;">
            Выбранный наружный блок
        </h3>
        <div style="overflow-x: auto; margin-bottom: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <table style="width: 100%; border-collapse: collapse; background: white;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                        <th style="padding: 12px 16px; text-align: left; font-size: 14px; color: #4a5568;">Модель</th>
                        <th style="padding: 12px 16px; text-align: left; font-size: 14px; color: #4a5568;">HC-код</th>
                        <th style="padding: 12px 16px; text-align: left; font-size: 14px; color: #4a5568;">Мощность блока</th>
                        <th style="padding: 12px 16px; text-align: left; font-size: 14px; color: #4a5568;">Требуемая мощность</th>
                        <th style="padding: 12px 16px; text-align: left; font-size: 14px; color: #4a5568;">Загрузка</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px 16px; font-weight: 600; color: #2d3748;">${unit.model}</td>
                        <td style="padding: 12px 16px;"><code style="background: #edf2f7; padding: 4px 8px; border-radius: 4px; font-size: 13px;">${unit.hcCode}</code></td>
                        <td style="padding: 12px 16px;">${unit.power} кВт</td>
                        <td style="padding: 12px 16px;">${totalIndoorCapacity.toFixed(2)} кВт</td>
                        <td style="padding: 12px 16px; font-weight: 700; color: ${loadColor}; font-size: 16px;">${loadPercent}%</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    // === ТАБЛИЦА 2: Технические характеристики (строго по твоему brands.js) ===
    html += `
        <h3 style="color: var(--brand-color); margin: 30px 0 15px; font-size: 18px; font-weight: 600;">
            Технические характеристики
        </h3>
        <div style="overflow-x: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <table style="width: 100%; border-collapse: collapse; background: white;">
                <tbody>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 12px 16px; text-align: left; width: 60%; color: #4a5568; font-weight: 500;">Производительность охлаждения</th>
                        <td style="padding: 12px 16px; font-weight: 600; color: #2d3748;">${specs.cooling} кВт</td>
                    </tr>
                    <tr>
                        <th style="padding: 12px 16px; text-align: left; color: #4a5568; font-weight: 500;">Производительность обогрева</th>
                        <td style="padding: 12px 16px; font-weight: 600; color: #2d3748;">${specs.heating} кВт</td>
                    </tr>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 12px 16px; text-align: left; color: #4a5568; font-weight: 500;">Класс энергоэффективности</th>
                        <td style="padding: 12px 16px; font-weight: 600; color: #2d3748;">${specs.efficiency}</td>
                    </tr>
                    <tr>
                        <th style="padding: 12px 16px; text-align: left; color: #4a5568; font-weight: 500;">Уровень шума</th>
                        <td style="padding: 12px 16px; font-weight: 600; color: #2d3748;">${specs.noise} дБ</td>
                    </tr>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 12px 16px; text-align: left; color: #4a5568; font-weight: 500;">Размеры внешнего блока (Ш×В×Г)</th>
                        <td style="padding: 12px 16px; font-weight: 600; color: #2d3748;">${specs.dimensions} мм</td>
                    </tr>
                    <tr>
                        <th style="padding: 12px 16px; text-align: left; color: #4a5568; font-weight: 500;">Вес нетто</th>
                        <td style="padding: 12px 16px; font-weight: 600; color: #2d3748;">${specs.weight} кг</td>
                    </tr>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 12px 16px; text-align: left; color: #4a5568; font-weight: 500;">Макс. длина трассы (до 1 блока)</th>
                        <td style="padding: 12px 16px; font-weight: 600; color: #2d3748;">${specs.pipeLenSingle} м</td>
                    </tr>
                    <tr>
                        <th style="padding: 12px 16px; text-align: left; color: #4a5568; font-weight: 500;">Макс. длина трассы (общая)</th>
                        <td style="padding: 12px 16px; font-weight: 600; color: #2d3748;">${specs.pipeLenTotal} м</td>
                    </tr>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 12px 16px; text-align: left; color: #4a5568; font-weight: 500;">Максимальный перепад высот</th>
                        <td style="padding: 12px 16px; font-weight: 600; color: #2d3748;">${specs.heightDiff} м</td>
                    </tr>
                    <tr>
                        <th style="padding: 12px 16px; text-align: left; color: #4a5568; font-weight: 500;">Хладагент</th>
                        <td style="padding: 12px 16px; font-weight: 600; color: #2d3748;">${specs.refrigerant}</td>
                    </tr>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 12px 16px; text-align: left; color: #4a5568; font-weight: 500;">Рабочая температура (охлаждение)</th>
                        <td style="padding: 12px 16px; font-weight: 600; color: #2d3748;">${specs.tempCool} °C</td>
                    </tr>
                    <tr>
                        <th style="padding: 12px 16px; text-align: left; color: #4a5568; font-weight: 500;">Рабочая температура (обогрев)</th>
                        <td style="padding: 12px 16px; font-weight: 600; color: #2d3748;">${specs.tempHeat} °C</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    // Вставляем HTML в контейнер
    container.innerHTML = html;
    
    // Плавная прокрутка к таблицам
    setTimeout(() => {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// === ПОКАЗАТЬ ПОЧТУ ===
function showEmail() {
    const emailBlock = document.getElementById('emailBlock');
    emailBlock.style.display = 'block';
    
    // Автоматически скрыть через 10 секунд
    setTimeout(() => {
        emailBlock.style.display = 'none';
    }, 10000);
}

function shareCalculation() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        showToast('✅ Ссылка на расчет скопирована! Теперь вы можете отправить её коллеге или клиенту.');
    }).catch(() => {
        showToast('❌ Не удалось скопировать ссылку. Скопируйте адрес из адресной строки браузера.');
    });
}

// Функция показа toast-уведомления
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            toast.style.display = 'none';
            toast.style.animation = '';
        }, 300);
    }, duration);
}

// === КОПИРОВАНИЕ EMAIL ПРИ КЛИКЕ ===
document.addEventListener('DOMContentLoaded', () => {
    const emailText = document.getElementById('emailText');
    if (emailText) {
        emailText.addEventListener('click', () => {
           const email = emailText.textContent;
           navigator.clipboard.writeText(email).then(() => {
           showToast('✅ Email скопирован в буфер обмена!');
            });
        });
    }
});