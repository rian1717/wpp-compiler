// ═══════════════════════════════════════════════════════════════
//  W++ TOKENIZER ENGINE  —  CS-310 Compiler Construction
//  Shared across all pages via <script src="tokenizer.js">
// ═══════════════════════════════════════════════════════════════

const KEYWORDS = new Set([
  'int','float','double','char','string','if','else','while',
  'for','return','print','read','true','false','bool','void','main',
  'long','do'
]);

const KEYWORD_MAP = {
  'int':'KEYWORD_INT','float':'KEYWORD_FLOAT','double':'KEYWORD_DOUBLE',
  'char':'KEYWORD_CHAR','string':'KEYWORD_STRING','if':'KEYWORD_IF',
  'else':'KEYWORD_ELSE','while':'KEYWORD_WHILE','for':'KEYWORD_FOR',
  'return':'KEYWORD_RETURN','print':'KEYWORD_PRINT','read':'KEYWORD_READ',
  'true':'KEYWORD_TRUE','false':'KEYWORD_FALSE','bool':'KEYWORD_BOOL',
  'void':'KEYWORD_VOID','main':'KEYWORD_MAIN','long':'KEYWORD_LONG','do':'KEYWORD_DO'
};

function getColumn(sourceCode, index) {
  let col = 1;
  for (let j = index - 1; j >= 0; j--) {
    if (sourceCode[j] === '\n') {
      break;
    }
    col++;
  }
  return col;
}

function tokenize(sourceCode) {
  const tokens = [];
  let i = 0;
  let line = 1;
  const len = sourceCode.length;

  while (i < len) {
    const ch = sourceCode[i];

    // Skip carriage return
    if (ch === '\r') { i++; continue; }

    // Track newlines
    if (ch === '\n') { line++; i++; continue; }

    // Skip spaces and tabs (whitespace)
    if (ch === ' ' || ch === '\t') { i++; continue; }

    // SINGLE-LINE COMMENT: //
    if (ch === '/' && sourceCode[i+1] === '/') {
      const startLine = line;
      const startCol = getColumn(sourceCode, i);
      const start = i;
      while (i < len && sourceCode[i] !== '\n') i++;
      tokens.push({
        type: 'COMMENT', category: 'COMMENT',
        value: sourceCode.slice(start, i), line: startLine, col: startCol
      });
      continue;
    }

    // MULTI-LINE COMMENT: /* */
    if (ch === '/' && sourceCode[i+1] === '*') {
      const startLine = line;
      const startCol = getColumn(sourceCode, i);
      const start = i;
      i += 2;
      while (i < len && !(sourceCode[i] === '*' && sourceCode[i+1] === '/')) {
        if (sourceCode[i] === '\n') line++;
        i++;
      }
      i += 2;
      tokens.push({
        type: 'COMMENT', category: 'COMMENT',
        value: sourceCode.slice(start, i), line: startLine, col: startCol
      });
      continue;
    }

    // STRING LITERAL: "..."
    if (ch === '"') {
      const startLine = line;
      const startCol = getColumn(sourceCode, i);
      const start = i;
      i++;
      while (i < len && sourceCode[i] !== '"') {
        if (sourceCode[i] === '\\') i++;
        if (sourceCode[i] === '\n') line++;
        i++;
      }
      i++;
      tokens.push({
        type: 'LITERAL_STRING', category: 'LITERAL',
        value: sourceCode.slice(start, i), line: startLine, col: startCol
      });
      continue;
    }

    // CHARACTER LITERAL: '.'
    if (ch === "'") {
      const startLine = line;
      const startCol = getColumn(sourceCode, i);
      const start = i;
      i++;
      if (i < len && sourceCode[i] === '\\') i++;
      i++;
      if (i < len && sourceCode[i] === "'") i++;
      tokens.push({
        type: 'LITERAL_CHAR', category: 'LITERAL',
        value: sourceCode.slice(start, i), line: startLine, col: startCol
      });
      continue;
    }

    // TWO-CHARACTER OPERATORS
    const two = sourceCode.slice(i, i + 2);
    const twoOpMap = {
      '<=': 'OPERATOR_LTE', '>=': 'OPERATOR_GTE',
      '==': 'OPERATOR_EQ',  '!=': 'OPERATOR_NEQ',
      '&&': 'OPERATOR_AND', '||': 'OPERATOR_OR',
      '++': 'OPERATOR_INC', '--': 'OPERATOR_DEC'
    };
    if (twoOpMap[two]) {
      tokens.push({ type: twoOpMap[two], category: 'OPERATOR', value: two, line, col: getColumn(sourceCode, i) });
      i += 2;
      continue;
    }

    // SINGLE-CHARACTER OPERATORS
    const oneOpMap = {
      '=': 'OPERATOR_ASSIGN', '+': 'OPERATOR_PLUS', '-': 'OPERATOR_MINUS',
      '*': 'OPERATOR_MULT',   '/': 'OPERATOR_DIV',  '%': 'OPERATOR_MOD',
      '<': 'OPERATOR_LT',     '>': 'OPERATOR_GT',   '!': 'OPERATOR_NOT'
    };
    if (oneOpMap[ch]) {
      tokens.push({ type: oneOpMap[ch], category: 'OPERATOR', value: ch, line, col: getColumn(sourceCode, i) });
      i++;
      continue;
    }

    // SEPARATORS
    const sepMap = {
      ';': 'SEPARATOR_SEMICOLON', ',': 'SEPARATOR_COMMA',
      '(': 'SEPARATOR_LPAREN',    ')': 'SEPARATOR_RPAREN',
      '{': 'SEPARATOR_LBRACE',    '}': 'SEPARATOR_RBRACE'
    };
    if (sepMap[ch]) {
      tokens.push({ type: sepMap[ch], category: 'SEPARATOR', value: ch, line, col: getColumn(sourceCode, i) });
      i++;
      continue;
    }

    // NUMBER LITERALS (integer and float)
    if (/[0-9]/.test(ch)) {
      const startLine = line;
      const startCol = getColumn(sourceCode, i);
      let val = '';
      while (i < len && /[0-9]/.test(sourceCode[i])) { val += sourceCode[i]; i++; }
      if (i < len && sourceCode[i] === '.') {
        val += '.'; i++;
        let decimalPart = '';
        while (i < len && /[0-9]/.test(sourceCode[i])) { decimalPart += sourceCode[i]; i++; }
        val += decimalPart;
        
        // Check for multiple decimals (malformed float error)
        if (i < len && sourceCode[i] === '.') {
          val += '.'; i++;
          while (i < len && /[0-9\.]/.test(sourceCode[i])) { val += sourceCode[i]; i++; }
          tokens.push({
            type: 'LEXICAL_ERROR', category: 'ERROR', value: val, line: startLine, col: startCol,
            errorMsg: `Malformed float literal '${val}' (multiple decimal points)`
          });
        } else {
          tokens.push({ type: 'LITERAL_FLOAT', category: 'LITERAL', value: val, line: startLine, col: startCol });
        }
      } else {
        tokens.push({ type: 'LITERAL_INTEGER', category: 'LITERAL', value: val, line: startLine, col: startCol });
      }
      continue;
    }

    // IDENTIFIERS AND KEYWORDS
    if (/[a-zA-Z_]/.test(ch)) {
      const startLine = line;
      const startCol = getColumn(sourceCode, i);
      let val = '';
      while (i < len && /[a-zA-Z0-9_]/.test(sourceCode[i])) { val += sourceCode[i]; i++; }
      if (KEYWORDS.has(val)) {
        tokens.push({ type: KEYWORD_MAP[val], category: 'KEYWORD', value: val, line: startLine, col: startCol });
      } else {
        tokens.push({ type: 'IDENTIFIER', category: 'IDENTIFIER', value: val, line: startLine, col: startCol });
      }
      continue;
    }

    // Unknown character — record lexical error
    const badChar = ch;
    const errLine = line;
    const errCol = getColumn(sourceCode, i);
    tokens.push({
      type: 'LEXICAL_ERROR',
      category: 'ERROR',
      value: badChar,
      line: errLine,
      col: errCol,
      errorMsg: `Unexpected character '${badChar}'`
    });
    i++;
  }

  return tokens;
}

// ═══════════════════════════════════════════════════════════════
//  STATISTICS GENERATOR
// ═══════════════════════════════════════════════════════════════

function generateAllStats(tokens, sourceCode, filename) {
  const totalLines = sourceCode.split('\n').length;

  const mainTokens = tokens.filter(t => t.category !== 'COMMENT' && t.category !== 'ERROR');
  const totalTokens = mainTokens.length;

  const codeLineSet = new Set(mainTokens.map(t => t.line));
  const linesWithCode = codeLineSet.size;
  const emptyIgnored = totalLines - linesWithCode;

  // ── TOKEN TYPE MAP
  const typeMap = {};
  for (const tok of mainTokens) {
    if (!typeMap[tok.type]) {
      typeMap[tok.type] = { type: tok.type, category: tok.category, count: 0, lines: new Set() };
    }
    typeMap[tok.type].count++;
    typeMap[tok.type].lines.add(tok.line);
  }
  for (const key of Object.keys(typeMap)) {
    typeMap[key].lines = [...typeMap[key].lines].sort((a, b) => a - b);
  }
  const typeArr = Object.values(typeMap).sort((a, b) => b.count - a.count);

  // ── LINE MAP
  const lineMap = {};
  for (const tok of mainTokens) {
    lineMap[tok.line] = (lineMap[tok.line] || 0) + 1;
  }

  // ── IDENTIFIER MAP
  const identMap = {};
  for (const tok of mainTokens.filter(t => t.category === 'IDENTIFIER')) {
    if (!identMap[tok.value]) {
      identMap[tok.value] = { name: tok.value, count: 0, lines: new Set() };
    }
    identMap[tok.value].count++;
    identMap[tok.value].lines.add(tok.line);
  }
  for (const key of Object.keys(identMap)) {
    identMap[key].lines = [...identMap[key].lines].sort((a, b) => a - b);
  }

  // ── LITERAL MAP
  const litMap = {};
  for (const tok of mainTokens.filter(t => t.category === 'LITERAL')) {
    const key = tok.value + '||' + tok.type;
    if (!litMap[key]) {
      litMap[key] = {
        value: tok.value,
        type: tok.type.replace('LITERAL_', ''),
        count: 0,
        lines: new Set()
      };
    }
    litMap[key].count++;
    litMap[key].lines.add(tok.line);
  }
  for (const key of Object.keys(litMap)) {
    litMap[key].lines = [...litMap[key].lines].sort((a, b) => a - b);
  }

  // ── CATEGORY MAP
  const catMap = { KEYWORD:0, IDENTIFIER:0, LITERAL:0, OPERATOR:0, SEPARATOR:0, COMMENT:0 };
  for (const tok of mainTokens) {
    if (catMap[tok.category] !== undefined) catMap[tok.category]++;
  }

  // ── MOST / LEAST FREQUENT
  const mostFreq  = typeArr[0]  || { type: 'N/A', count: 0 };
  const leastFreq = typeArr[typeArr.length - 1] || { type: 'N/A', count: 0 };

  // ── LINE STATS
  const lineArr = Object.entries(lineMap).map(([l, c]) => ({ line: +l, count: c }));
  const maxLine = lineArr.length ? lineArr.reduce((a, b) => b.count > a.count ? b : a) : { line: 0, count: 0 };
  const minLine = lineArr.length ? lineArr.reduce((a, b) => b.count < a.count ? b : a) : { line: 0, count: 0 };
  const avgPerLine = linesWithCode ? (totalTokens / linesWithCode).toFixed(2) : '0.00';

  return {
    filename, totalLines, totalTokens, linesWithCode, emptyIgnored,
    typeMap, typeArr, lineMap, lineArr,
    identMap: Object.values(identMap).sort((a, b) => b.count - a.count),
    litMap: Object.values(litMap).sort((a, b) => b.count - a.count),
    catMap,
    mostFreq, leastFreq,
    uniqueTypes: typeArr.length,
    maxLine, minLine, avgPerLine,
    analyzedAt: new Date().toLocaleTimeString()
  };
}

// ═══════════════════════════════════════════════════════════════
//  PLAIN TEXT REPORT GENERATOR (for download)
// ═══════════════════════════════════════════════════════════════

function padR(s, n) { return String(s).slice(0, n).padEnd(n); }
function padL(s, n) { return String(s).slice(0, n).padStart(n); }
function centerText(text, width) {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}

function buildRawReport(stats) {
  const { filename, totalLines, totalTokens, linesWithCode, emptyIgnored,
          typeArr, lineMap, identMap, litMap, catMap,
          mostFreq, leastFreq, uniqueTypes, maxLine, minLine, avgPerLine } = stats;

  const SEP  = '='.repeat(78);
  const SEP2 = '-'.repeat(78);
  let r = '';

  r += SEP + '\n';
  r += centerText('W++ TOKEN ANALYZER - STATISTICAL REPORT', 78) + '\n';
  r += SEP + '\n\n';

  r += `INPUT FILE: ${filename}\n`;
  r += `TOTAL LINES: ${totalLines}\n`;
  r += `LINES WITH CODE: ${linesWithCode}\n`;
  r += `TOTAL TOKENS: ${totalTokens}\n\n`;

  // ── Section 1
  r += SEP + '\n';
  r += '1. TOKEN TYPE SUMMARY\n';
  r += SEP + '\n\n';

  const c1 = 16, c2 = 28, c3 = 7, c4 = 9;
  r += padR('Category', c1) + '| ' + padR('Token Type', c2) + '| ' + padR('Qty', c3) + '| ' + padR('%', c4) + '| Lines\n';
  r += SEP2.slice(0, c1) + '|' + SEP2.slice(0, c2+1) + '|' + SEP2.slice(0, c3+1) + '|' + SEP2.slice(0, c4+1) + '|' + SEP2.slice(0, 24) + '\n';

  const catOrder = ['KEYWORD','IDENTIFIER','LITERAL','OPERATOR','SEPARATOR'];
  const grouped = {};
  for (const cat of catOrder) grouped[cat] = [];
  for (const t of typeArr) { if (grouped[t.category]) grouped[t.category].push(t); }

  for (const cat of catOrder) {
    for (const t of grouped[cat]) {
      const pct = ((t.count / totalTokens) * 100).toFixed(2) + '%';
      const lines = t.lines.join(',');
      r += padR(cat, c1) + '| ' + padR(t.type, c2) + '| ' + padL(String(t.count), c3-1) + ' | ' + padR(pct, c4-1) + '| ' + lines + '\n';
    }
  }
  r += padR('COMMENT', c1) + '| ' + padR('COMMENT', c2) + '| ' + padL('0', c3-1) + ' | ' + padR('0.00%', c4-1) + '| (ignored)\n';
  r += padR('WHITESPACE', c1) + '| ' + padR('WHITESPACE', c2) + '| ' + padL('0', c3-1) + ' | ' + padR('0.00%', c4-1) + '| (ignored)\n';
  r += '\n' + SEP2 + '\n\n';

  // ── Section 2
  r += SEP + '\n';
  r += '2. LINE-WISE TOKEN DISTRIBUTION\n';
  r += SEP + '\n\n';

  r += padR('Line Number', 14) + '| Total Tokens\n';
  r += SEP2.slice(0, 14) + '|' + SEP2.slice(0, 14) + '\n';
  for (const [ln, cnt] of Object.entries(lineMap).sort((a, b) => +a[0] - +b[0])) {
    r += padR(`Line ${ln}`, 14) + '| ' + cnt + '\n';
  }
  r += '\n' + SEP2 + '\n\n';

  // ── Section 3
  r += SEP + '\n';
  r += '3. IDENTIFIER STATISTICS\n';
  r += SEP + '\n\n';

  r += padR('Identifier', 20) + '| ' + padR('Frequency', 12) + '| Lines\n';
  r += SEP2.slice(0, 20) + '|' + SEP2.slice(0, 13) + '|' + SEP2.slice(0, 24) + '\n';
  for (const id of identMap) {
    const lines = id.lines.join(',');
    r += padR(id.name, 20) + '| ' + padL(String(id.count), 11) + ' | ' + lines + '\n';
  }
  r += '\n' + SEP2 + '\n\n';

  // ── Section 4
  r += SEP + '\n';
  r += '4. LITERAL STATISTICS\n';
  r += SEP + '\n\n';

  r += padR('Literal', 20) + '| ' + padR('Type', 10) + '| ' + padR('Frequency', 12) + '| Lines\n';
  r += SEP2.slice(0, 20) + '|' + SEP2.slice(0, 11) + '|' + SEP2.slice(0, 13) + '|' + SEP2.slice(0, 24) + '\n';
  for (const lit of litMap) {
    const lines = lit.lines.join(',');
    r += padR(lit.value, 20) + '| ' + padR(lit.type, 10) + '| ' + padL(String(lit.count), 11) + ' | ' + lines + '\n';
  }
  r += '\n' + SEP2 + '\n\n';

  // ── Section 5
  r += SEP + '\n' + SEP + '\n';
  r += '5. TOKEN SUMMARY STATISTICS\n';
  r += SEP + '\n\n';

  r += `Total Tokens: ${totalTokens}\n`;
  r += `Unique Token Types: ${uniqueTypes}\n`;
  r += `Total Lines with Code: ${linesWithCode}\n`;
  r += `Empty/Ignored Lines: ${emptyIgnored}\n\n`;
  r += `Most Frequent Token: ${mostFreq.type} (${mostFreq.count} occurrences, ${((mostFreq.count / totalTokens) * 100).toFixed(2)}%)\n`;
  r += `Least Frequent Token: ${leastFreq.type} (${leastFreq.count} occurrence${leastFreq.count !== 1 ? 's' : ''}, ${((leastFreq.count / totalTokens) * 100).toFixed(2)}%)\n\n`;
  r += `Average Tokens per Line: ${avgPerLine}\n`;
  r += `Maximum Tokens in a Single Line: ${maxLine.count} (Line ${maxLine.line})\n`;
  r += `Minimum Tokens in a Single Line: ${minLine.count} (Line ${minLine.line})\n`;
  r += '\n' + SEP + '\n' + SEP + '\n';

  // ── Section 6
  r += '6. TOKEN CATEGORY BREAKDOWN\n';
  r += SEP + '\n\n';

  r += padR('Category', 18) + '| ' + padR('Total', 8) + '| Percentage\n';
  r += SEP2.slice(0, 18) + '|' + SEP2.slice(0, 9) + '|' + SEP2.slice(0, 14) + '\n';
  const allCats = ['KEYWORD','IDENTIFIER','LITERAL','OPERATOR','SEPARATOR','COMMENT'];
  for (const cat of allCats) {
    const cnt = catMap[cat] || 0;
    const pct = totalTokens ? ((cnt / totalTokens) * 100).toFixed(2) + '%' : '0.00%';
    r += padR(cat, 18) + '| ' + padL(String(cnt), 7) + ' | ' + pct + '\n';
  }

  r += '\n' + SEP + '\n';
  r += 'END OF REPORT\n';
  r += SEP + '\n';

  return r;
}

// ═══════════════════════════════════════════════════════════════
//  SAMPLE PROGRAM
// ═══════════════════════════════════════════════════════════════

const SAMPLE_PROGRAM = `// W++ Token Analyzer Test Program
// This program demonstrates all token types
int main() {
    int age = 25;
    float temperature = 36.6;
    double pi = 3.14159265359;
    char grade = 'A';
    string name = "John Doe";
    int x = 10, y = 20, z = 30;
    float a = 1.5, b = 2.5, c = 3.5;
    int sum = x + y + z;
    float product = a * b * c;
    double division = pi / 2.0;
    int remainder = 100 % 7;
    if (age >= 18 && age <= 60) {
        print "Adult age range";
        string status = "Working";
    } else if (age > 60) {
        print "Senior citizen";
        string status = "Retired";
    } else {
        print "Minor";
        string status = "Student";
    }
    int counter = 0;
    while (counter < 10) {
        counter = counter + 1;
        print "Counter value: ";
        print counter;
    }
    for (int i = 0; i < 5; i = i + 1) {
        print "Iteration: ";
        print i;
    }
    bool flag = true;
    bool result = (x > y) && (a < b) || !flag;
    char newline = '\\n';
    char tab = '\\t';
    string greeting = "Hello, " + name + "!";
    string path = "C:\\\\Program Files\\\\W++";
    return 0;
}`;

// ═══════════════════════════════════════════════════════════════
//  HELPER: escape HTML
// ═══════════════════════════════════════════════════════════════

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════════════
//  HISTORY MANAGER
// ═══════════════════════════════════════════════════════════════
function saveToHistory(filename, code, stats) {
  let history = JSON.parse(localStorage.getItem('wpp_history') || '[]');
  const entry = {
    id: Date.now(),
    filename: filename,
    code: code,
    date: new Date().toLocaleString(),
    totalTokens: stats.totalTokens,
    totalLines: stats.totalLines
  };
  history.unshift(entry);
  if (history.length > 50) history.pop();
  localStorage.setItem('wpp_history', JSON.stringify(history));
}
