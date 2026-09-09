const inputs = { a: document.querySelector('#valueA'), b: document.querySelector('#valueB'), c: document.querySelector('#valueC'), result: document.querySelector('#result') };
const operators = { first: document.querySelector('#operatorOne'), second: document.querySelector('#operatorTwo') };
const statusMessage = document.querySelector('#statusMessage'); const statusDot = document.querySelector('#statusDot'); const answer = document.querySelector('#answer'); const answerNote = document.querySelector('#answerNote');
function hasValue(input) { return input.value.trim() !== '' && Number.isFinite(Number(input.value)); }
function applyOperator(left, operator, right) { if (operator === '+') return left + right; if (operator === '-') return left - right; if (operator === '*') return left * right; if (right === 0) return null; return left / right; }
function formatNumber(value) { return Number.isFinite(value) ? Number(value.toFixed(10)).toLocaleString('ja-JP') : '計算できません'; }
function calculate(a, b, c) { const intermediate = applyOperator(a, operators.first.value, b); return intermediate === null ? null : applyOperator(intermediate, operators.second.value, c); }
function setFeedback(message, type = '') { statusMessage.textContent = message; statusDot.className = `status-dot ${type}`; }
function showAnswer(value, note) { answer.textContent = value === null ? '—' : formatNumber(value); answerNote.textContent = note; }
function calculateEquation() { if (![inputs.a, inputs.b, inputs.c].every(hasValue)) { setFeedback('3つの値を入力してから計算してください。', 'warning'); return; } const value = calculate(Number(inputs.a.value), Number(inputs.b.value), Number(inputs.c.value)); if (value === null) { setFeedback('0で割ることはできません。', 'warning'); showAnswer(null, '演算を見直してください。'); return; } inputs.result.value = value; setFeedback('計算が完了しました。', 'success'); showAnswer(value, `${inputs.a.value} ${operators.first.value} ${inputs.b.value} ${operators.second.value} ${inputs.c.value}`); }
function reverseOperator(target, operator, known) {
    if (operator === '+') return target - known;
    if (operator === '-') return target + known;
    if (operator === '*') return known === 0 ? null : target / known;
    return target * known;
}

function solveUnknown() {
    const values = [inputs.a, inputs.b, inputs.c]; const blanks = values.filter((input) => !hasValue(input));
    if (blanks.length !== 1 || !hasValue(inputs.result)) { setFeedback('空欄を1つだけ残し、結果を入力してください。', 'warning'); return; }
    const missing = blanks[0]; const target = Number(inputs.result.value); const a = hasValue(inputs.a) ? Number(inputs.a.value) : null; const b = hasValue(inputs.b) ? Number(inputs.b.value) : null; const c = hasValue(inputs.c) ? Number(inputs.c.value) : null; let solved = null;
    if (missing === inputs.a) {
        const intermediate = reverseOperator(target, operators.second.value, c);
        if (intermediate !== null) solved = reverseOperator(intermediate, operators.first.value, b);
    } else if (missing === inputs.b) {
        const intermediate = reverseOperator(target, operators.second.value, c);
        if (intermediate !== null) solved = operators.first.value === '+' ? intermediate - a : operators.first.value === '-' ? a - intermediate : operators.first.value === '*' ? (a === 0 ? null : intermediate / a) : (intermediate === 0 ? null : a / intermediate);
    } else {
        const left = applyOperator(a, operators.first.value, b);
        if (left !== null) solved = reverseOperator(target, operators.second.value, left);
    }
    if (solved === null || !Number.isFinite(solved)) { setFeedback('この組み合わせでは空欄を一意に求められません。', 'warning'); return; }
    missing.value = solved; setFeedback('空欄を逆算しました。', 'success'); showAnswer(solved, `${missing.id.replace('value', '値 ')} = ${formatNumber(solved)}`);
}
document.querySelector('#calculateButton').addEventListener('click', calculateEquation); document.querySelector('#solveButton').addEventListener('click', solveUnknown); document.querySelector('#clearButton').addEventListener('click', () => { Object.values(inputs).forEach((input) => { input.value = ''; }); setFeedback('すべての値を入力すると計算できます。'); showAnswer(null, '式を入力して答えを表示しましょう。'); inputs.a.focus(); }); Object.values(inputs).forEach((input) => input.addEventListener('keydown', (event) => { if (event.key === 'Enter') calculateEquation(); }));
