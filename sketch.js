const variableCountSelect = document.querySelector('#variableCount');
const variableList = document.querySelector('#variableList');
const formulaInput = document.querySelector('#formulaInput');
const variableChips = document.querySelector('#variableChips');
const answer = document.querySelector('#answer');
const statusMessage = document.querySelector('#statusMessage');
const calculateButton = document.querySelector('#calculateButton');
const targetValueInput = document.querySelector('#targetValue');
const resetAllButton = document.querySelector('#resetAllButton');
const solveMissingButton = document.querySelector('#solveMissingButton');
const clearFormulaButton = document.querySelector('#clearFormulaButton');

const defaultVariableCount = 4;
let variableNames = Array(defaultVariableCount).fill('');
let variableValues = Array(defaultVariableCount).fill('');

function normalizeName(value, fallback) {
  const cleaned = String(value ?? '').trim().replace(/\s+/g, '');
  if (cleaned.length === 0) {
    return fallback;
  }
  return cleaned.slice(0, 20);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return Number(value.toFixed(2)).toLocaleString('ja-JP');
}

function updateStatus(message, type = 'default') {
  statusMessage.textContent = message;
  statusMessage.dataset.type = type;
}

function getCurrentNames() {
  const rows = [...document.querySelectorAll('.variable-item')];
  return rows.map((row, index) => normalizeName(row.querySelector('.variable-name').value, `変数${index + 1}`));
}

function getCurrentValues() {
  const rows = [...document.querySelectorAll('.variable-item')];
  return rows.map((row) => {
    const raw = row.querySelector('.variable-value').value.trim();
    return raw === '' ? Number.NaN : Number.parseFloat(raw);
  });
}

function ensureVariableState(length) {
  while (variableNames.length < length) {
    variableNames.push('');
  }
  while (variableNames.length > length) {
    variableNames.pop();
  }

  while (variableValues.length < length) {
    variableValues.push('');
  }
  while (variableValues.length > length) {
    variableValues.pop();
  }
}

function renderVariables() {
  const count = Number(variableCountSelect.value);
  ensureVariableState(count);

  variableList.innerHTML = '';

  for (let index = 0; index < count; index += 1) {
    const item = document.createElement('div');
    item.className = 'variable-item';
    item.innerHTML = `
      <label>
        <span>名前</span>
        <input type="text" class="variable-name" value="${variableNames[index] ?? ''}" aria-label="変数${index + 1}の名前" placeholder="変数${index + 1}">
      </label>
      <label>
        <span>値</span>
        <input type="number" class="variable-value" step="any" value="${variableValues[index] ?? ''}" aria-label="変数${index + 1}の値" placeholder="0">
      </label>
    `;
    variableList.appendChild(item);
  }

  refreshVariableChips();
}

function refreshVariableChips() {
  const names = getCurrentNames();
  variableChips.innerHTML = names
    .map((name) => `<button type="button" class="variable-chip" data-name="${name}">${name}</button>`)
    .join('');
}

function insertTextAtCursor(text) {
  const start = formulaInput.selectionStart;
  const end = formulaInput.selectionEnd;
  formulaInput.setRangeText(text, start, end, 'end');
  formulaInput.focus();
}

function replaceVariableNamesWithTokens(expression, names) {
  let prepared = expression.trim();
  if (!prepared) {
    return '';
  }

  const orderedNames = names
    .map((name, index) => ({ name: normalizeName(name, `変数${index + 1}`), index }))
    .filter(({ name }) => name.length > 0)
    .sort((a, b) => b.name.length - a.name.length);

  for (const { name, index } of orderedNames) {
    prepared = prepared.split(name).join(`v${index}`);
  }

  prepared = prepared
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/＋/g, '+')
    .replace(/−/g, '-')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/,/g, '');

  return prepared;
}

function evaluateExpression(expression, names, values) {
  const prepared = replaceVariableNamesWithTokens(expression, names);
  if (!prepared) {
    return { valid: false, message: '式を入力してください。' };
  }

  const functionArgs = names.map((_, index) => `v${index}`);

  try {
    const evaluator = new Function(...functionArgs, `return (${prepared});`);
    const result = evaluator(...values);

    if (!Number.isFinite(result)) {
      return { valid: false, message: '計算できません。0で割っていないか、式を確認してください。' };
    }

    return { valid: true, value: result };
  } catch (error) {
    return { valid: false, message: '式の書き方を確認してください。' };
  }
}

function calculate() {
  const names = getCurrentNames();
  const values = getCurrentValues();
  const expression = formulaInput.value.trim();

  if (!expression) {
    updateStatus('計算式を入力してください。', 'warning');
    answer.textContent = '—';
    return;
  }

  const evaluation = evaluateExpression(expression, names, values);
  if (!evaluation.valid) {
    updateStatus(evaluation.message, 'warning');
    answer.textContent = '—';
    return;
  }

  const result = evaluation.value;
  answer.textContent = formatNumber(result);
  updateStatus(`計算完了: ${expression}`, 'success');
}

function evaluateWithMissingValue(expression, names, values, missingIndex, candidate) {
  const filled = values.map((value, index) => {
    if (index === missingIndex) {
      return candidate;
    }
    return Number.isFinite(value) ? value : 0;
  });

  const evaluation = evaluateExpression(expression, names, filled);
  return evaluation.valid ? evaluation.value : Number.NaN;
}

function solveMissingVariable() {
  const expression = formulaInput.value.trim();
  const target = Number(targetValueInput.value);
  const names = getCurrentNames();
  const values = getCurrentValues();
  const missingIndexes = values
    .map((value, index) => (Number.isFinite(value) ? -1 : index))
    .filter((index) => index !== -1);

  if (!expression) {
    updateStatus('計算式を入力してください。', 'warning');
    return;
  }

  if (!Number.isFinite(target)) {
    updateStatus('目標値を入力してください。', 'warning');
    return;
  }

  if (missingIndexes.length !== 1) {
    updateStatus('空欄の変数は1つだけにしてください。', 'warning');
    return;
  }

  const missingIndex = missingIndexes[0];
  const low = -1000000;
  const high = 1000000;
  let left = low;
  let right = high;
  let leftValue = evaluateWithMissingValue(expression, names, values, missingIndex, left);
  let rightValue = evaluateWithMissingValue(expression, names, values, missingIndex, right);

  if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
    updateStatus('この式では逆算できません。値の組み合わせを見直してください。', 'warning');
    return;
  }

  let solved = Number.NaN;
  for (let i = 0; i < 200; i += 1) {
    const mid = (left + right) / 2;
    const midValue = evaluateWithMissingValue(expression, names, values, missingIndex, mid);

    if (!Number.isFinite(midValue)) {
      right = mid;
      continue;
    }

    if (Math.abs(midValue - target) < 1e-6) {
      solved = mid;
      break;
    }

    if ((leftValue - target) * (midValue - target) <= 0) {
      right = mid;
      rightValue = midValue;
    } else {
      left = mid;
      leftValue = midValue;
    }
  }

  if (!Number.isFinite(solved)) {
    updateStatus('逆算の結果が収束しませんでした。式や値を確認してください。', 'warning');
    return;
  }

  const row = document.querySelectorAll('.variable-item')[missingIndex];
  const input = row.querySelector('.variable-value');
  input.value = String(solved);
  variableValues[missingIndex] = String(solved);
  answer.textContent = formatNumber(solved);
  updateStatus(`${names[missingIndex]} = ${formatNumber(solved)} で逆算しました。`, 'success');
}

function resetCalculator() {
  variableNames = Array(defaultVariableCount).fill('');
  variableValues = Array(defaultVariableCount).fill('');
  variableCountSelect.value = String(defaultVariableCount);
  formulaInput.value = '';
  targetValueInput.value = '';
  renderVariables();
  answer.textContent = '—';
  updateStatus('すべての条件と式をリセットしました。', 'default');
}

variableCountSelect.addEventListener('change', () => {
  const count = Number(variableCountSelect.value);
  ensureVariableState(count);
  renderVariables();
  updateStatus('変数数を変更しました。式を必要に応じて調整してください。', 'default');
});

variableList.addEventListener('input', () => {
  variableNames = getCurrentNames();
  variableValues = getCurrentValues();
  refreshVariableChips();
});

variableChips.addEventListener('click', (event) => {
  const chip = event.target.closest('.variable-chip');
  if (!chip) {
    return;
  }

  insertTextAtCursor(chip.dataset.name);
});

document.querySelectorAll('[data-insert]').forEach((button) => {
  button.addEventListener('click', () => {
    const token = button.dataset.insert;
    insertTextAtCursor(token);
  });
});

calculateButton.addEventListener('click', calculate);
solveMissingButton.addEventListener('click', solveMissingVariable);
resetAllButton.addEventListener('click', resetCalculator);
clearFormulaButton.addEventListener('click', () => {
  formulaInput.value = '';
  formulaInput.focus();
  updateStatus('式をクリアしました。', 'default');
});

formulaInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    calculate();
  }
});

renderVariables();
answer.textContent = '—';
updateStatus('数値と式を入力して計算します。', 'default');
