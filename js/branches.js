// === БЛОКИ-РАСПРЕДЕЛИТЕЛИ ===

// === ПОДБОР ВСЕХ ВАРИАНТОВ БЛОКОВ-РАСПРЕДЕЛИТЕЛЕЙ ===
function selectAllBranchOptions(roomCount, brandKey) {
  const brandData = brands[brandKey];
  
  // Если у бренда нет распределителей
  if (!brandData.branchConfigs || !brandData.branchUnits) {
    return { options: [], error: null };
  }
  
  const configs = brandData.branchConfigs[roomCount];
  
  if (!configs || configs.length === 0) {
    return { 
      options: [], 
      error: `❌ Нет конфигурации распределителей для ${roomCount} комнат` 
    };
  }
  
  // Формируем все варианты
  const options = configs.map((config, index) => {
    const branches = [];
    let totalPrice = 0;
    
    config.config.forEach(branch => {
      const branchUnit = brandData.branchUnits[branch.type];
      const price = getPrice(branchUnit.hcCode);
      
      branches.push({
        model: branchUnit.model,
        hcCode: branchUnit.hcCode,
        maxPorts: branchUnit.maxPorts,
        qty: branch.qty,
        price: price
      });
      totalPrice += price * branch.qty;
    });
    
    return {
      id: index,
      name: config.name,
      branches: branches,
      totalPorts: config.totalPorts,
      totalPrice: totalPrice,
      isRecommended: index === 0
    };
  });
  
  return { options, error: null };
}

// === ОТОБРАЖЕНИЕ ВАРИАНТОВ РАСПРЕДЕЛИТЕЛЕЙ ===
function displayBranchOptions() {
  const block = document.getElementById('branchOptionsBlock');
  const list = document.getElementById('branchOptionsList');
  
  // Страховка: если элементов нет на странице, выходим
  if (!block || !list) return;
  
  if (!calculationResults.branchOptions || calculationResults.branchOptions.length === 0) {
    block.style.display = 'none';
    return;
  }
  
  block.style.display = 'block';
  
  list.innerHTML = calculationResults.branchOptions.map(option => {
    const isSelected = calculationResults.selectedBranchOption && 
                       calculationResults.selectedBranchOption.id === option.id;
    
    const branchesHTML = option.branches.map(branch => 
      `<div style="font-size: 13px; color: #4a5568; margin: 4px 0;">
        • ${branch.model} (${branch.maxPorts} порта) × ${branch.qty} шт.
      </div>`
    ).join('');
    
    return `
      <div onclick="selectBranchOption(${option.id})" 
           style="padding: 20px; border: 2px solid ${isSelected ? 'var(--brand-color)' : '#e2e8f0'}; 
                  border-radius: 10px; cursor: pointer; transition: all 0.3s ease; 
                  background: ${isSelected ? '#ebf8ff' : 'white'};"
           onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';"
           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="font-weight: 600; font-size: 16px; color: #2d3748;">
            ${option.name}
            ${option.isRecommended ? '<span style="background: #27ae60; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; margin-left: 10px;">РЕКОМЕНДУЕМ</span>' : ''}
          </div>
          <div style="font-weight: 600; color: var(--brand-color); font-size: 18px;">
            ${option.totalPrice > 0 ? option.totalPrice.toLocaleString('ru-RU') + ' ₽' : '—'}
          </div>
        </div>
        
        <div style="margin: 10px 0;">
          ${branchesHTML}
        </div>
        
        <div style="font-size: 12px; color: #718096; margin-top: 10px;">
          Всего портов: ${option.totalPorts} | 
          Комнат: ${calculationResults.indoorUnits ? calculationResults.indoorUnits.length : Object.keys(calculationResults.roomsData || {}).length}
        </div>
      </div>
    `;
  }).join('');
}

function selectBranchOption(optionId) {
  const option = calculationResults.branchOptions.find(o => o.id === optionId);
  if (!option) return;
  
  calculationResults.selectedBranchOption = option;
  displayBranchOptions(); // Обновляем визуальное выделение
  
  // Пересчитываем общую стоимость (ВАЖНО!)
  if (typeof calculateTotalPrice === 'function') {
    calculateTotalPrice();
  }
  
  // Пересчитываем спецификацию, если она показана
  const specTable = document.getElementById('specificationTable');
  if (specTable && specTable.style.display === 'block' && typeof generateSpecification === 'function') {
    generateSpecification();
  }
  
  console.log('✅ Выбран вариант распределителей:', option.name);
}