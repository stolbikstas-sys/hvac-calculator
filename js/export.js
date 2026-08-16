// === ЭКСПОРТ В EXCEL / PDF / EMAIL ===
// === ФУНКЦИЯ ГЕНЕРАЦИИ СПЕЦИФИКАЦИИ ===
function generateSpecification() {
  const tableContainer = document.getElementById('specificationTable');
  
let html = `
  <div style="width: 100%; overflow-x: visible;">
  <table class="spec-table" style="width: 100% !important; table-layout: fixed !important; border-collapse: collapse;">
  <colgroup>
    <col style="width: 5%">
    <col style="width: 40%">
    <col style="width: 18%">
    <col style="width: 12%">
    <col style="width: 25%">
  </colgroup>
`;

html += `
  <thead>
    <tr>
      <th class="number" style="color: white; text-align: center;">№</th>
      <th style="color: white;">Наименование товара</th>
      <th class="price" style="color: white; text-align: right;">Цена, шт./руб.</th>
      <th class="qty" style="color: white; text-align: center;">Кол-во, шт.</th>
      <th class="total" style="color: white; text-align: right;">Итого, руб.</th>
    </tr>
  </thead>
`;
  
  let totalSum = 0;
  let lineNumber = 1;
  
// Внутренние блоки
const indoorGroups = groupIndoorUnits();
  
  for (const [model, data] of Object.entries(indoorGroups)) {
    const itemTotal = data.price * data.count;
    totalSum += itemTotal;
    
    html += `
      <tr>
        <td class="number">${lineNumber}</td>
        <td class="name">
          <strong>${data.model}</strong><br>
          <small style="color: #7f8c8d;">Код: ${data.hcCode}</small>
        </td>
        <td class="price">${data.price > 0 ? data.price.toLocaleString('ru-RU') : '—'}</td>
        <td class="qty">${data.count}</td>
        <td class="total">${itemTotal > 0 ? itemTotal.toLocaleString('ru-RU') : '—'}</td>
      </tr>
    `;
    lineNumber++;
  }
  
  // Наружный блок
  if (calculationResults.outdoorUnit) {
    const outdoorPrice = getPrice(calculationResults.outdoorUnit.hcCode);
    const outdoorTotal = outdoorPrice;
    totalSum += outdoorTotal;
    
    html += `
      <tr>
        <td class="number">${lineNumber}</td>
        <td class="name">
          <strong>${calculationResults.outdoorUnit.model}</strong><br>
          <small style="color: #7f8c8d;">Код: ${calculationResults.outdoorUnit.hcCode}</small>
        </td>
        <td class="price">${outdoorPrice > 0 ? outdoorPrice.toLocaleString('ru-RU') : '—'}</td>
        <td class="qty">1</td>
        <td class="total">${outdoorTotal > 0 ? outdoorTotal.toLocaleString('ru-RU') : '—'}</td>
      </tr>
    `;
     lineNumber++;  // ← ДОБАВИТЬ ЭТУ СТРОКУ!
  }
  
// === БЛОКИ-РАСПРЕДЕЛИТЕЛИ (НОВЫЙ КОД) ===
if (calculationResults.selectedBranchOption && 
    calculationResults.selectedBranchOption.branches.length > 0) {
  
  html += `
    <tr style="background: #f0f8ff;">
      <td class="number" colspan="5" style="text-align: left; padding: 10px; font-weight: 600;">
        БЛОКИ-РАСПРЕДЕЛИТЕЛИ (${calculationResults.selectedBranchOption.name})
      </td>
    </tr>
  `;
  
  calculationResults.selectedBranchOption.branches.forEach(branch => {
    const branchTotal = branch.price * branch.qty;
    totalSum += branchTotal;
    
    html += `
      <tr>
        <td class="number">${lineNumber}</td>
        <td class="name">
          <strong>${branch.model}</strong> (${branch.maxPorts} порта)<br>
          <small style="color: #7f8c8d;">Код: ${branch.hcCode}</small>
        </td>
        <td class="price">${branch.price > 0 ? branch.price.toLocaleString('ru-RU') : '—'}</td>
        <td class="qty">${branch.qty}</td>
        <td class="total">${branchTotal > 0 ? branchTotal.toLocaleString('ru-RU') : '—'}</td>
      </tr>
    `;
    lineNumber++;
  });
}

   html += '</tbody></table></div>';
  
  // Итоги
  const vat = totalSum * 0.20; // НДС 20%
  
html += `
  <div class="spec-summary">
    <div class="spec-summary-row total-sum">
      <span>Итого к оплате:</span>
      <span>${totalSum.toLocaleString('ru-RU')} ₽</span>
    </div>
    <div class="spec-summary-row vat">
      <span>в т. ч. НДС (20%):</span>
      <span>${vat.toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ₽</span>
    </div>
<div class="spec-summary-row info">
  <span>Дата формирования: ${new Date().toLocaleDateString('ru-RU')}</span>
</div>
  </div>
`;
  
  tableContainer.innerHTML = html;
  tableContainer.style.display = 'block';
  

// Показываем все кнопки экспорта
const exportExcelBtn = document.getElementById('exportExcelBtn');
const exportEmailBtn = document.getElementById('exportEmailBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');

if (exportExcelBtn) exportExcelBtn.style.display = 'flex';
if (exportEmailBtn) exportEmailBtn.style.display = 'flex';
if (exportPdfBtn) exportPdfBtn.style.display = 'flex';
}

// === ФУНКЦИЯ ЭКСПОРТА В PDF ===
function exportToPDF() {  
  // Показываем спецификацию если ещё не показана
  const specTable = document.getElementById('specificationTable');
  if (specTable && specTable.style.display === 'none') {
    generateSpecification();
  }
  
  // Прокручиваем к результатам
  document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
  
  // Запускаем печать через 500мс (чтобы пользователь увидел результат)
  setTimeout(() => {
    window.print();
  }, 500);
}

// === ЭКСПОРТ В EXCEL (EXCELJS) ===
async function exportToExcel() {
  if (!calculationResults || !calculationResults.outdoorUnit) {
    alert('Сначала выполните расчёт системы');
    return;
  }

  if (typeof ExcelJS === 'undefined') {
    alert('Библиотека ExcelJS не загружена. Обновите страницу (Ctrl + Shift + R)');
    return;
  }

  // Создаём рабочую книгу
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Спецификация');
  
  // Настройка ТОЛЬКО 5 колонок
  worksheet.columns = [
    { key: 'num', width: 5 },
    { key: 'name', width: 45 },
    { key: 'price', width: 18 },
    { key: 'qty', width: 12 },
    { key: 'total', width: 18 }
  ];
  
  // === ЗАГОЛОВОК ===
  const headerRow1 = worksheet.addRow(['РУСКЛИМАТ']);
  headerRow1.font = { bold: true, size: 14, color: { argb: '0F62FE' } };
  worksheet.mergeCells('A1:E1');
  
  const headerRow2 = worksheet.addRow(['www.rusklimat.ru | Тел: +7 (495) 123-45-67']);
  worksheet.mergeCells('A2:E2');
  
  worksheet.addRow([]);
  
  if (calculationResults.projectName) {
    const projectRow = worksheet.addRow([`Проект: ${calculationResults.projectName}`]);
    worksheet.mergeCells(`A${projectRow.number}:E${projectRow.number}`);
  }
  
  worksheet.addRow([]);
  
  // === ШАПКА ТАБЛИЦЫ - ТОЛЬКО 5 ЯЧЕЕК ===
  const headerRowIndex = worksheet.rowCount + 1;
  const headerRow = worksheet.getRow(headerRowIndex);
  
  headerRow.getCell(1).value = '№';
  headerRow.getCell(2).value = 'НАИМЕНОВАНИЕ ТОВАРА';
  headerRow.getCell(3).value = 'ЦЕНА, ШТ./РУБ.';
  headerRow.getCell(4).value = 'КОЛ-ВО, ШТ.';
  headerRow.getCell(5).value = 'ИТОГО, РУБ.';
  
  // Применяем стили ТОЛЬКО к 5 ячейкам
  for (let i = 1; i <= 5; i++) {
    const cell = headerRow.getCell(i);
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '2C3E50' }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thick', color: { argb: '000000' } },
      bottom: { style: 'thick', color: { argb: '000000' } },
      left: { style: 'thick', color: { argb: '000000' } },
      right: { style: 'thick', color: { argb: '000000' } }
    };
  }
  
  // === ДАННЫЕ ===
  const allItems = [];
  
// Внутренние блоки
const indoorGroups = groupIndoorUnits();
for (const [model, item] of Object.entries(indoorGroups)) {
    allItems.push(item);
}
  
// Наружный блок
const outdoorPrice = getPrice(calculationResults.outdoorUnit.hcCode);
allItems.push({
    model: calculationResults.outdoorUnit.model,
    hcCode: calculationResults.outdoorUnit.hcCode,
    price: outdoorPrice,
    count: 1
});

// ✅ БЛОКИ-РАСПРЕДЕЛИТЕЛИ (если они есть)
if (calculationResults.selectedBranchOption && 
    calculationResults.selectedBranchOption.branches && 
    calculationResults.selectedBranchOption.branches.length > 0) {
    calculationResults.selectedBranchOption.branches.forEach(branch => {
        allItems.push({
            model: `${branch.model} (${branch.maxPorts} порта)`,
            hcCode: branch.hcCode,
            price: branch.price,
            count: branch.qty
        });
    });
}
  
  let lineNumber = 1;
  let totalSum = 0;
  
  for (const item of allItems) {
    const itemTotal = item.price * item.count;
    totalSum += itemTotal;
    
    // Строка с наименованием - ТОЛЬКО 5 ячеек
    const nameRowIndex = worksheet.rowCount + 1;
    const nameRow = worksheet.getRow(nameRowIndex);
    
    nameRow.getCell(1).value = lineNumber;
    nameRow.getCell(2).value = item.model;
    nameRow.getCell(3).value = item.price > 0 ? item.price : '';
    nameRow.getCell(4).value = item.count;
    nameRow.getCell(5).value = item.price > 0 ? itemTotal : '';
    
    // Форматирование
    nameRow.getCell(1).alignment = { horizontal: 'center' };
    nameRow.getCell(2).font = { bold: true, size: 11 };
    nameRow.getCell(3).alignment = { horizontal: 'right' };
    nameRow.getCell(4).alignment = { horizontal: 'center' };
    nameRow.getCell(5).alignment = { horizontal: 'right' };
    
    // Границы ТОЛЬКО для 5 ячеек
    for (let i = 1; i <= 5; i++) {
      nameRow.getCell(i).border = {
        top: { style: 'thin', color: { argb: 'CCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
        left: { style: 'thin', color: { argb: 'CCCCCC' } },
        right: { style: 'thin', color: { argb: 'CCCCCC' } }
      };
    }
    
    // Строка с HC-кодом - ТОЛЬКО 5 ячеек
    const codeRowIndex = worksheet.rowCount + 1;
    const codeRow = worksheet.getRow(codeRowIndex);
    
    codeRow.getCell(1).value = '';
    codeRow.getCell(2).value = `Код: ${item.hcCode}`;
    codeRow.getCell(3).value = '';
    codeRow.getCell(4).value = '';
    codeRow.getCell(5).value = '';
    
    codeRow.getCell(2).font = { size: 10, color: { argb: '7F8C8D' } };
    
    // Границы ТОЛЬКО для 5 ячеек
    for (let i = 1; i <= 5; i++) {
      codeRow.getCell(i).border = {
        top: { style: 'thin', color: { argb: 'CCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'CCCCCC' } },
        left: { style: 'thin', color: { argb: 'CCCCCC' } },
        right: { style: 'thin', color: { argb: 'CCCCCC' } }
      };
    }
    
    lineNumber++;
  }
  
  worksheet.addRow([]);
  
  // === ИТОГО ===
  const vat = totalSum * 0.20;
  const sumWithoutVat = totalSum - vat;
  
  const totalRow1Index = worksheet.rowCount + 1;
  const totalRow1 = worksheet.getRow(totalRow1Index);
  totalRow1.getCell(1).value = 'Итого к оплате:';
  totalRow1.getCell(5).value = totalSum;
  totalRow1.getCell(1).font = { bold: true, size: 12 };
  totalRow1.getCell(1).alignment = { horizontal: 'left' };
  totalRow1.getCell(5).font = { bold: true, size: 12 };
  totalRow1.getCell(5).alignment = { horizontal: 'right' };
  totalRow1.getCell(5).border = {
    top: { style: 'thick', color: { argb: '000000' } },
    bottom: { style: 'thick', color: { argb: '000000' } }
  };
  
  const totalRow2Index = worksheet.rowCount + 1;
  const totalRow2 = worksheet.getRow(totalRow2Index);
  totalRow2.getCell(1).value = `в т. ч. НДС (20%):`;
  totalRow2.getCell(5).value = vat;
  totalRow2.getCell(1).font = { bold: true, size: 12 };
  totalRow2.getCell(1).alignment = { horizontal: 'left' };
  totalRow2.getCell(5).font = { bold: true, size: 12 };
  totalRow2.getCell(5).alignment = { horizontal: 'right' };
  totalRow2.getCell(5).border = {
    bottom: { style: 'thick', color: { argb: '000000' } }
  };
  
  worksheet.addRow([]);
  
  const dateRowIndex = worksheet.rowCount + 1;
  const dateRow = worksheet.getRow(dateRowIndex);
  dateRow.getCell(1).value = `Дата формирования: ${new Date().toLocaleDateString('ru-RU')}`;
  worksheet.mergeCells(`A${dateRowIndex}:E${dateRowIndex}`);
  
  // Генерация файла
  const fileName = `Спецификация_${calculationResults.projectName || 'HVAC'}_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`;
  
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// === ФУНКЦИЯ ПЕЧАТИ / СОХРАНЕНИЯ PDF ===
function printSpecification() {
  window.print();
}

// === ОТПРАВКА НА ПОЧТУ ===
function sendToEmail() {
  if (!calculationResults || !calculationResults.outdoorUnit) {
    alert('Сначала выполните расчёт системы');
    return;
  }
  
  const email = prompt('Введите email получателя:');
  if (!email) return;
  
  // Формируем текст письма
  let body = 'СПЕЦИФИКАЦИЯ ОБОРУДОВАНИЯ\n';
  body += `Дата: ${new Date().toLocaleDateString('ru-RU')}\n\n`;
  
  if (calculationResults.projectName) {
    body += `Проект: ${calculationResults.projectName}\n`;
  }
  if (calculationResults.projectComment) {
    body += `Комментарий: ${calculationResults.projectComment}\n`;
  }
  body += '\n';
  
// Внутренние блоки
body += 'ВНУТРЕННИЕ БЛОКИ:\n';
const indoorGroups = groupIndoorUnits();
  
  for (const [model, data] of Object.entries(indoorGroups)) {
    body += `- ${data.model} (${data.power} кВт) x ${data.count} шт. = ${data.price > 0 ? (data.price * data.count).toLocaleString('ru-RU') : '—'} руб.\n`;
  }
  
body += '\nНАРУЖНЫЙ БЛОК:\n';
const outdoorPrice = getPrice(calculationResults.outdoorUnit.hcCode);
body += `- ${calculationResults.outdoorUnit.model} (${calculationResults.outdoorUnit.power} кВт) = ${outdoorPrice > 0 ? outdoorPrice.toLocaleString('ru-RU') : '—'} руб.\n`;

// ✅ БЛОКИ-РАСПРЕДЕЛИТЕЛИ (если они есть)
let branchTotalSum = 0;
if (calculationResults.selectedBranchOption && 
    calculationResults.selectedBranchOption.branches && 
    calculationResults.selectedBranchOption.branches.length > 0) {
    body += `\nБЛОКИ-РАСПРЕДЕЛИТЕЛИ (${calculationResults.selectedBranchOption.name}):\n`;
    calculationResults.selectedBranchOption.branches.forEach(branch => {
        const branchTotal = branch.price * branch.qty;
        branchTotalSum += branchTotal;
        body += `- ${branch.model} (${branch.maxPorts} порта) × ${branch.qty} шт. = ${branch.price > 0 ? branchTotal.toLocaleString('ru-RU') : '—'} руб.\n`;
    });
}

// Итого
const totalSum = Object.values(indoorGroups).reduce((sum, data) => sum + (data.price * data.count), 0) + outdoorPrice + branchTotalSum;
  body += `\nИТОГО: ${totalSum.toLocaleString('ru-RU')} руб.\n`;
  
  // Открываем почтовый клиент
  const subject = encodeURIComponent(`Спецификация HVAC${calculationResults.projectName ? ': ' + calculationResults.projectName : ''}`);
  const bodyEncoded = encodeURIComponent(body);
  
  window.location.href = `mailto:${email}?subject=${subject}&body=${bodyEncoded}`;
}



