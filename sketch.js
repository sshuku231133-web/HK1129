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

function parseInverseExpression(expression) {
  const tokenPattern = /\s*((?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|(v\d+)|([()+\-*\/]))/y;
  const tokens = [];
  let position = 0;

  while (position < expression.length) {
    if (expression.slice(position).trim() === '') {
      break;
    }

    tokenPattern.lastIndex = position;
    const match = tokenPattern.exec(expression);
    if (!match) {
      throw new Error('逆算では四則演算と括弧のみ使用できます。');
    }

    tokens.push(match[1] ?? match[2] ?? match[3]);
    position = tokenPattern.lastIndex;
  }

  let cursor = 0;
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };

  function parsePrimary() {
    const token = tokens[cursor];
    if (token === '+' || token === '-') {
      cursor += 1;
      return { type: 'unary', operator: token, argument: parsePrimary() };
    }

    if (token === '(') {
      cursor += 1;
      const expressionNode = parseBinaryExpression(0);
      if (tokens[cursor] !== ')') {
        throw new Error('式の括弧を確認してください。');
      }
      cursor += 1;
      return expressionNode;
    }

    if (token && /^v\d+$/.test(token)) {
      cursor += 1;
      return { type: 'variable', index: Number(token.slice(1)) };
    }

    if (token && Number.isFinite(Number(token))) {
      cursor += 1;
      return { type: 'number', value: Number(token) };
    }

    throw new Error('式の書き方を確認してください。');
  }

  function parseBinaryExpression(minimumPrecedence) {
    let left = parsePrimary();

    while (cursor < tokens.length) {
      const operator = tokens[cursor];
      const operatorPrecedence = precedence[operator];
      if (operatorPrecedence === undefined || operatorPrecedence < minimumPrecedence) {
        break;
      }

      cursor += 1;
      const right = parseBinaryExpression(operatorPrecedence + 1);
      left = { type: 'binary', operator, left, right };
    }

    return left;
  }

  const expressionNode = parseBinaryExpression(0);
  if (cursor !== tokens.length) {
    throw new Error('式の書き方を確認してください。');
  }
  return expressionNode;
}

function evaluateInverseExpression(node, values) {
  if (node.type === 'number') {
    return node.value;
  }
  if (node.type === 'variable') {
    return values[node.index];
  }
  if (node.type === 'unary') {
    const value = evaluateInverseExpression(node.argument, values);
    return node.operator === '-' ? -value : value;
  }

  const left = evaluateInverseExpression(node.left, values);
  const right = evaluateInverseExpression(node.right, values);
  switch (node.operator) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return left / right;
    default: return Number.NaN;
  }
}

function countVariableOccurrences(node, variableIndex) {
  if (node.type === 'variable') {
    return node.index === variableIndex ? 1 : 0;
  }
  if (node.type === 'number') {
    return 0;
  }
  if (node.type === 'unary') {
    return countVariableOccurrences(node.argument, variableIndex);
  }
  return countVariableOccurrences(node.left, variableIndex)
    + countVariableOccurrences(node.right, variableIndex);
}

function solveInverseExpression(node, target, variableIndex, values) {
  if (node.type === 'variable') {
    if (node.index !== variableIndex) {
      throw new Error('式に空欄の変数が含まれていません。');
    }
    return target;
  }

  if (node.type === 'unary') {
    return solveInverseExpression(
      node.argument,
      node.operator === '-' ? -target : target,
      variableIndex,
      values,
    );
  }

  if (node.type !== 'binary') {
    throw new Error('式に空欄の変数が含まれていません。');
  }

  const leftOccurrences = countVariableOccurrences(node.left, variableIndex);
  const rightOccurrences = countVariableOccurrences(node.right, variableIndex);
  if (leftOccurrences + rightOccurrences !== 1) {
    throw new Error('空欄の変数は式中に1回だけ含めてください。');
  }

  const unknownIsLeft = leftOccurrences === 1;
  const knownNode = unknownIsLeft ? node.right : node.left;
  const knownValue = evaluateInverseExpression(knownNode, values);
  if (!Number.isFinite(knownValue)) {
    throw new Error('既知の値で計算できない箇所があります。式や値を確認してください。');
  }

  let nextTarget;
  if (node.operator === '+') {
    nextTarget = target - knownValue;
  } else if (node.operator === '-') {
    nextTarget = unknownIsLeft ? target + knownValue : knownValue - target;
  } else if (node.operator === '*') {
    if (knownValue === 0) {
      throw new Error(target === 0
        ? '既知の値が0のため、空欄の値を一意に決められません。'
        : '既知の値が0のため、目標値を実現する値がありません。');
    }
    nextTarget = target / knownValue;
  } else if (node.operator === '/') {
    if (unknownIsLeft) {
      if (knownValue === 0) {
        throw new Error('分母が0になるため逆算できません。');
      }
      nextTarget = target * knownValue;
    } else {
      if (target === 0 && knownValue === 0) {
        throw new Error('分子と目標値が0のため、分母を一意に決められません。');
      }
      if (target === 0 || knownValue === 0) {
        throw new Error('この除算では目標値を満たす有限の値がありません。');
      }
      nextTarget = knownValue / target;
    }
  }

  if (!Number.isFinite(nextTarget)) {
    throw new Error('逆算結果が有限値になりません。式や値を確認してください。');
  }
  return solveInverseExpression(unknownIsLeft ? node.left : node.right, nextTarget, variableIndex, values);
}

function solveExpressionForVariable(expression, names, values, missingIndex, target) {
  const prepared = replaceVariableNamesWithTokens(expression, names);
  if (!prepared) {
    throw new Error('計算式を入力してください。');
  }

  const expressionNode = parseInverseExpression(prepared);
  const occurrenceCount = countVariableOccurrences(expressionNode, missingIndex);
  if (occurrenceCount !== 1) {
    throw new Error('空欄の変数は式中に1回だけ含めてください。');
  }

  const solved = solveInverseExpression(expressionNode, target, missingIndex, values);
  const filledValues = values.map((value, index) => (index === missingIndex ? solved : value));
  const result = evaluateInverseExpression(expressionNode, filledValues);
  const tolerance = 1e-9 * Math.max(1, Math.abs(target));
  if (!Number.isFinite(result) || Math.abs(result - target) > tolerance) {
    throw new Error('この式では目標値を満たす逆算結果がありません。');
  }
  return solved;
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
  let solved;
  try {
    solved = solveExpressionForVariable(expression, names, values, missingIndex, target);
  } catch (error) {
    updateStatus(error.message, 'warning');
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
