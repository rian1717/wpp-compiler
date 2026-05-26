// ═══════════════════════════════════════════════════════════════
//  W++ COMPILER OPTIMIZER  —  CS-310 Compiler Construction
// ═══════════════════════════════════════════════════════════════

class WPlusOptimizer {
  constructor(ast) {
    // Clone AST to avoid altering original structure
    this.ast = this.deepClone(ast);
    this.logs = []; // List of optimizations performed
  }

  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }
    const cloned = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }

  optimize() {
    if (!this.ast) return { ast: null, logs: [], code: '' };
    this.ast = this.visit(this.ast);
    const optimizedCode = this.generateCode(this.ast);
    return { ast: this.ast, logs: this.logs, code: optimizedCode };
  }

  log(line, msg) {
    this.logs.push({ line, msg });
  }

  visit(node) {
    if (!node) return null;

    switch (node.type) {
      case 'Program':
        node.body = node.body
          .map(stmt => this.visit(stmt))
          .filter(stmt => stmt !== null);
        return node;

      case 'MainFunction':
        node.body = this.visit(node.body);
        return node;

      case 'Block':
        node.statements = node.statements
          .map(stmt => this.visit(stmt))
          .filter(stmt => stmt !== null);
        
        // Remove dead statements after a return statement
        let returnIdx = -1;
        for (let i = 0; i < node.statements.length; i++) {
          if (node.statements[i].type === 'ReturnStatement') {
            returnIdx = i;
            break;
          }
        }
        if (returnIdx !== -1 && returnIdx < node.statements.length - 1) {
          const eliminated = node.statements.length - 1 - returnIdx;
          this.log(node.statements[returnIdx + 1].line, `Dead Code Elimination: Removed ${eliminated} statement(s) after return statement`);
          node.statements = node.statements.slice(0, returnIdx + 1);
        }
        return node;

      case 'VariableDeclaration':
        for (let decl of node.declarations) {
          if (decl.init) {
            decl.init = this.visit(decl.init);
          }
        }
        return node;

      case 'VariableDeclarator':
        if (node.init) {
          node.init = this.visit(node.init);
        }
        return node;

      case 'AssignmentExpression':
        node.right = this.visit(node.right);
        return node;

      case 'ExpressionStatement':
        node.expression = this.visit(node.expression);
        if (node.expression.type === 'Literal') {
          // Stanalone literal has no effect, remove it
          this.log(node.line, "Dead Code Elimination: Removed standalone literal expression");
          return null;
        }
        return node;

      case 'IfStatement':
        node.condition = this.visit(node.condition);
        node.consequent = this.visit(node.consequent);
        if (node.alternate) {
          node.alternate = this.visit(node.alternate);
        }

        // Branch folding optimization if condition is a constant literal
        if (node.condition.type === 'Literal' && node.condition.valueType === 'BOOL') {
          const val = node.condition.value;
          if (val === true) {
            this.log(node.line, `Constant Folding & Branch Elimination: Folded 'if(true)' into statement body`);
            return node.consequent;
          } else {
            this.log(node.line, `Constant Folding & Branch Elimination: Eliminated 'if(false)' branch`);
            return node.alternate || null;
          }
        }
        return node;

      case 'WhileStatement':
        node.condition = this.visit(node.condition);
        node.body = this.visit(node.body);

        // Eliminate constant false while loop
        if (node.condition.type === 'Literal' && node.condition.valueType === 'BOOL' && node.condition.value === false) {
          this.log(node.line, `Dead Code Elimination: Eliminated 'while(false)' loop block`);
          return null;
        }
        return node;

      case 'ForStatement':
        if (node.init) node.init = this.visit(node.init);
        if (node.condition) node.condition = this.visit(node.condition);
        if (node.update) node.update = this.visit(node.update);
        node.body = this.visit(node.body);

        // Eliminate constant false for loop
        if (node.condition && node.condition.type === 'Literal' && node.condition.valueType === 'BOOL' && node.condition.value === false) {
          this.log(node.line, `Dead Code Elimination: Eliminated 'for' loop with constant false condition`);
          return null;
        }
        return node;

      case 'DoWhileStatement':
        node.body = this.visit(node.body);
        node.condition = this.visit(node.condition);
        return node;

      case 'ReturnStatement':
        if (node.argument) {
          node.argument = this.visit(node.argument);
        }
        return node;

      case 'PrintStatement':
        node.argument = this.visit(node.argument);
        return node;

      case 'ReadStatement':
        return node;

      case 'ParenthesizedExpression':
        const inside = this.visit(node.expression);
        if (inside.type === 'Literal') {
          // Collapse parentheses around simple literals
          return inside;
        }
        node.expression = inside;
        return node;

      case 'BinaryExpression': {
        node.left = this.visit(node.left);
        node.right = this.visit(node.right);

        // Algebraic Simplification: x % 1 -> 0
        if (node.operator === '%') {
          if (node.right.type === 'Literal' && node.right.value === 1) {
            this.log(node.line, `Algebraic Simplification: Simplified expression to '0' (modulo by 1)`);
            return {
              type: 'Literal',
              valueType: 'INTEGER',
              value: 0,
              raw: '0',
              line: node.line
            };
          }
          // Algebraic Simplification: 0 % x -> 0 (where x != 0)
          if (node.left.type === 'Literal' && node.left.value === 0) {
            if (node.right.type !== 'Literal' || node.right.value !== 0) {
              this.log(node.line, `Algebraic Simplification: Simplified expression to '0' (0 modulo anything)`);
              return {
                type: 'Literal',
                valueType: 'INTEGER',
                value: 0,
                raw: '0',
                line: node.line
              };
            }
          }
        }

        // Constant folding for numeric and boolean operations
        if (node.left.type === 'Literal' && node.right.type === 'Literal') {
          const lVal = node.left.value;
          const rVal = node.right.value;
          const op = node.operator;
          let res = null;
          let resType = null;

          if (typeof lVal === 'number' && typeof rVal === 'number') {
            switch (op) {
              case '+': res = lVal + rVal; resType = Number.isInteger(res) ? 'INTEGER' : 'FLOAT'; break;
              case '-': res = lVal - rVal; resType = Number.isInteger(res) ? 'INTEGER' : 'FLOAT'; break;
              case '*': res = lVal * rVal; resType = Number.isInteger(res) ? 'INTEGER' : 'FLOAT'; break;
              case '/': 
                if (rVal === 0) return node; // Do not fold division by zero
                res = lVal / rVal; 
                resType = 'FLOAT'; 
                break;
              case '%': 
                if (rVal === 0) return node; // Do not fold modulo by zero
                res = lVal % rVal; 
                resType = 'INTEGER'; 
                break;
              case '==': res = lVal === rVal; resType = 'BOOL'; break;
              case '!=': res = lVal !== rVal; resType = 'BOOL'; break;
              case '<': res = lVal < rVal; resType = 'BOOL'; break;
              case '>': res = lVal > rVal; resType = 'BOOL'; break;
              case '<=': res = lVal <= rVal; resType = 'BOOL'; break;
              case '>=': res = lVal >= rVal; resType = 'BOOL'; break;
            }
          } else if (typeof lVal === 'string' && typeof rVal === 'string') {
            if (op === '+') {
              res = lVal + rVal;
              resType = 'STRING';
            } else if (op === '==') {
              res = lVal === rVal;
              resType = 'BOOL';
            } else if (op === '!=') {
              res = lVal !== rVal;
              resType = 'BOOL';
            }
          }

          if (res !== null && resType !== null) {
            const rawVal = resType === 'STRING' ? `"${res}"` : resType === 'CHAR' ? `'${res}'` : String(res);
            this.log(node.line, `Constant Folding: Reduced expression '${lVal} ${op} ${rVal}' to '${res}'`);
            return {
              type: 'Literal',
              valueType: resType,
              value: res,
              raw: rawVal,
              line: node.line
            };
          }
        }
        return node;
      }

      case 'LogicalExpression': {
        node.left = this.visit(node.left);
        node.right = this.visit(node.right);

        if (node.left.type === 'Literal' && node.right.type === 'Literal') {
          const lVal = node.left.value;
          const rVal = node.right.value;
          const op = node.operator;
          let res = null;

          if (op === '&&') res = lVal && rVal;
          else if (op === '||') res = lVal || rVal;

          if (res !== null) {
            this.log(node.line, `Constant Folding: Folded logical expression '${lVal} ${op} ${rVal}' to '${res}'`);
            return {
              type: 'Literal',
              valueType: 'BOOL',
              value: res,
              raw: String(res),
              line: node.line
            };
          }
        }
        return node;
      }

      case 'UnaryExpression': {
        node.argument = this.visit(node.argument);

        if (node.argument.type === 'Literal') {
          const val = node.argument.value;
          const op = node.operator;
          let res = null;
          let resType = null;

          if (op === '!' && typeof val === 'boolean') {
            res = !val;
            resType = 'BOOL';
          } else if (op === '-' && typeof val === 'number') {
            res = -val;
            resType = Number.isInteger(res) ? 'INTEGER' : 'FLOAT';
          } else if (op === '+' && typeof val === 'number') {
            res = val;
            resType = Number.isInteger(res) ? 'INTEGER' : 'FLOAT';
          }

          if (res !== null && resType !== null) {
            this.log(node.line, `Constant Folding: Collapsed unary operation '${op}${val}' to '${res}'`);
            return {
              type: 'Literal',
              valueType: resType,
              value: res,
              raw: String(res),
              line: node.line
            };
          }
        }
        return node;
      }

      default:
        return node;
    }
  }

  // ─── SOURCE CODE GENERATOR (AST -> W++) ───
  generateCode(node, indent = 0) {
    if (!node) return '';
    const pad = '    '.repeat(indent);

    switch (node.type) {
      case 'Program':
        return node.body.map(stmt => this.generateCode(stmt, indent)).join('\n');

      case 'MainFunction':
        return `${pad}${node.returnType} main() {\n` +
          this.generateCode(node.body, indent + 1) +
          `\n${pad}}`;

      case 'Block':
        return node.statements.map(stmt => this.generateCode(stmt, indent)).join('\n');

      case 'VariableDeclaration': {
        const list = node.declarations.map(d => {
          let code = d.id;
          if (d.init) {
            code += ` = ${this.generateCode(d.init)}`;
          }
          return code;
        }).join(', ');
        return `${pad}${node.varType.toLowerCase()} ${list};`;
      }

      case 'AssignmentExpression':
        return `${this.generateCode(node.left)} = ${this.generateCode(node.right)}`;

      case 'ExpressionStatement':
        return `${pad}${this.generateCode(node.expression)};`;

      case 'IfStatement': {
        let code = `${pad}if (${this.generateCode(node.condition)}) {\n` +
          this.generateCode(node.consequent, indent + 1) +
          `\n${pad}}`;
        if (node.alternate) {
          if (node.alternate.type === 'IfStatement') {
            // else if
            const altCode = this.generateCode(node.alternate, indent).trim();
            code += ` else ${altCode}`;
          } else {
            code += ` else {\n` +
              this.generateCode(node.alternate, indent + 1) +
              `\n${pad}}`;
          }
        }
        return code;
      }

      case 'WhileStatement':
        return `${pad}while (${this.generateCode(node.condition)}) {\n` +
          this.generateCode(node.body, indent + 1) +
          `\n${pad}}`;

      case 'ForStatement': {
        const init = node.init ? this.generateCode(node.init).trim().replace(/;$/, '') : '';
        const cond = node.condition ? this.generateCode(node.condition) : '';
        const upd = node.update ? this.generateCode(node.update) : '';
        return `${pad}for (${init}; ${cond}; ${upd}) {\n` +
          this.generateCode(node.body, indent + 1) +
          `\n${pad}}`;
      }

      case 'DoWhileStatement':
        return `${pad}do {\n` +
          this.generateCode(node.body, indent + 1) +
          `\n${pad}} while (${this.generateCode(node.condition)});`;

      case 'ReturnStatement':
        return `${pad}return${node.argument ? ' ' + this.generateCode(node.argument) : ''};`;

      case 'PrintStatement':
        return `${pad}print ${this.generateCode(node.argument)};`;

      case 'ReadStatement':
        return `${pad}read ${node.identifier};`;

      case 'ParenthesizedExpression':
        return `(${this.generateCode(node.expression)})`;

      case 'BinaryExpression':
      case 'LogicalExpression':
        return `${this.generateCode(node.left)} ${node.operator} ${this.generateCode(node.right)}`;

      case 'UnaryExpression':
        if (node.prefix) {
          return `${node.operator}${this.generateCode(node.argument)}`;
        } else {
          return `${this.generateCode(node.argument)}${node.operator}`;
        }

      case 'Identifier':
        return node.value;

      case 'Literal':
        return node.raw;

      default:
        return '';
    }
  }
}

if (typeof window !== 'undefined') {
  window.WPlusOptimizer = WPlusOptimizer;
}
