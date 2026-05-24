// ═══════════════════════════════════════════════════════════════
//  W++ SEMANTIC ANALYZER  —  CS-310 Compiler Construction
// ═══════════════════════════════════════════════════════════════

class Scope {
  constructor(parent = null, name = 'block') {
    this.variables = {}; // name -> { type, line, initialized, value }
    this.parent = parent;
    this.name = name;
  }

  declare(name, type, line, col) {
    if (this.variables[name]) {
      return false; // Already declared in this scope
    }
    this.variables[name] = { type: type.toUpperCase(), line, col, initialized: false, value: undefined };
    return true;
  }

  lookup(name) {
    let scope = this;
    while (scope !== null) {
      if (scope.variables[name]) {
        return { variable: scope.variables[name], scopeName: scope.name };
      }
      scope = scope.parent;
    }
    return null;
  }
}

class WPlusSemantic {
  constructor(ast, sourceCode) {
    this.ast = ast;
    this.sourceCode = sourceCode;
    this.errors = []; // Semantic errors
    this.symbols = []; // Symbol table records for UI
    this.currentScope = new Scope(null, 'global');
    this.lines = sourceCode.split('\n');
    this.scopeCount = 0;
  }

  addError(line, col, msg, type = 'Semantic Error') {
    let snippet = '';
    const lineIndex = line - 1;
    if (lineIndex >= 0 && lineIndex < this.lines.length) {
      const origLine = this.lines[lineIndex].replace(/\r/g, '');
      const pad = ' '.repeat(Math.max(0, col - 1));
      snippet = `Line ${line}:\n  ${origLine}\n  ${pad}^`;
    }
    this.errors.push({ line, col, msg, type, snippet });
  }

  analyze() {
    if (!this.ast) return { errors: this.errors, symbols: this.symbols };
    this.visit(this.ast);
    return { errors: this.errors, symbols: this.symbols };
  }

  enterScope(name) {
    this.scopeCount++;
    this.currentScope = new Scope(this.currentScope, `${name}_lvl${this.scopeCount}`);
  }

  exitScope() {
    if (this.currentScope.parent) {
      this.currentScope = this.currentScope.parent;
    }
  }

  visit(node) {
    if (!node) return null;

    switch (node.type) {
      case 'Program':
        for (const stmt of node.body) {
          this.visit(stmt);
        }
        break;

      case 'MainFunction':
        // Declare main return type in global scope
        this.currentScope.declare('main', node.returnType, node.line, 1);
        this.symbols.push({
          name: 'main',
          type: node.returnType.toUpperCase(),
          scope: 'global',
          line: node.line,
          value: 'FUNCTION'
        });

        // Enter main scope
        this.enterScope('main');
        this.visit(node.body);
        this.exitScope();
        break;

      case 'Block':
        this.enterScope('block');
        for (const stmt of node.statements) {
          this.visit(stmt);
        }
        this.exitScope();
        break;

      case 'VariableDeclaration':
        for (const decl of node.declarations) {
          const ok = this.currentScope.declare(decl.id, node.varType, decl.line, decl.col);
          if (!ok) {
            this.addError(decl.line, decl.col, `Variable '${decl.id}' is already declared in this scope`, 'Semantic Error');
          } else {
            let evalVal = undefined;
            if (decl.init) {
              const initType = this.visit(decl.init);
              const varTypeUpper = node.varType.toUpperCase();
              
              if (initType) {
                this.checkTypeCompatibility(varTypeUpper, initType, decl.line, decl.col);
                // Attempt to record initial value if constant literal
                evalVal = this.getConstantValue(decl.init);
                this.currentScope.variables[decl.id].initialized = true;
                this.currentScope.variables[decl.id].value = evalVal;
              }
            }

            // Record to symbol table output
            this.symbols.push({
              name: decl.id,
              type: node.varType.toUpperCase(),
              scope: this.currentScope.name,
              line: decl.line,
              value: evalVal !== undefined ? evalVal : 'undefined'
            });
          }
        }
        break;

      case 'AssignmentExpression': {
        const varName = node.left.value;
        const lookup = this.currentScope.lookup(varName);
        const rhsType = this.visit(node.right);
        
        if (!lookup) {
          this.addError(node.left.line, node.left.col, `Undeclared variable '${varName}'`, 'Semantic Error');
          return null;
        }

        const lhsType = lookup.variable.type;
        if (rhsType) {
          this.checkTypeCompatibility(lhsType, rhsType, node.line, node.left.col);
          const val = this.getConstantValue(node.right);
          lookup.variable.initialized = true;
          lookup.variable.value = val;
          
          // Update values in symbol table output
          const sym = this.symbols.find(s => s.name === varName && s.scope === lookup.scopeName);
          if (sym) {
            sym.value = val !== undefined ? val : 'undefined';
          }
        }
        return lhsType;
      }

      case 'ExpressionStatement':
        return this.visit(node.expression);

      case 'IfStatement': {
        const condType = this.visit(node.condition);
        if (condType && condType !== 'BOOL') {
          this.addError(node.condition.line, 1, `If condition must be a BOOLEAN expression, found '${condType}'`, 'Semantic Warning');
        }
        this.visit(node.consequent);
        if (node.alternate) {
          this.visit(node.alternate);
        }
        break;
      }

      case 'WhileStatement': {
        const condType = this.visit(node.condition);
        if (condType && condType !== 'BOOL') {
          this.addError(node.condition.line, 1, `While condition must be a BOOLEAN expression, found '${condType}'`, 'Semantic Warning');
        }
        this.visit(node.body);
        break;
      }

      case 'ForStatement':
        this.enterScope('for');
        this.visit(node.init);
        if (node.condition) {
          const condType = this.visit(node.condition);
          if (condType && condType !== 'BOOL') {
            this.addError(node.condition.line, 1, `For loop condition must be a BOOLEAN expression, found '${condType}'`, 'Semantic Warning');
          }
        }
        this.visit(node.update);
        this.visit(node.body);
        this.exitScope();
        break;

      case 'DoWhileStatement': {
        this.visit(node.body);
        const condType = this.visit(node.condition);
        if (condType && condType !== 'BOOL') {
          this.addError(node.condition.line, 1, `Do-While condition must be a BOOLEAN expression, found '${condType}'`, 'Semantic Warning');
        }
        break;
      }

      case 'ReturnStatement': {
        const argType = this.visit(node.argument);
        // Assuming main function requires INT
        if (argType && argType !== 'INT') {
          this.addError(node.line, 1, `Main function return type mismatch: expected 'INT' return value, found '${argType}'`, 'Semantic Error');
        }
        return argType;
      }

      case 'PrintStatement':
        this.visit(node.argument);
        break;

      case 'ReadStatement': {
        const lookup = this.currentScope.lookup(node.identifier);
        if (!lookup) {
          this.addError(node.line, 1, `Undeclared variable '${node.identifier}' in read statement`, 'Semantic Error');
        }
        break;
      }

      case 'ParenthesizedExpression':
        return this.visit(node.expression);

      case 'BinaryExpression': {
        const leftType = this.visit(node.left);
        const rightType = this.visit(node.right);
        const op = node.operator;

        if (!leftType || !rightType) return null;

        // Operator check
        if (['+', '-', '*', '/', '%'].includes(op)) {
          if (leftType === 'STRING' || rightType === 'STRING') {
            if (op === '+' && (leftType === 'STRING' || rightType === 'STRING')) {
              // String concatenation is supported
              return 'STRING';
            }
            this.addError(node.line, 1, `Arithmetic operator '${op}' cannot be applied to types '${leftType}' and '${rightType}'`, 'Semantic Error');
            return 'INT';
          }

          if (leftType === 'FLOAT' || rightType === 'FLOAT' || leftType === 'DOUBLE' || rightType === 'DOUBLE') {
            return 'FLOAT'; // float coercion
          }
          return 'INT';
        }

        // Relational operations
        if (['<', '>', '<=', '>=', '==', '!='].includes(op)) {
          if (leftType === 'STRING' && rightType !== 'STRING') {
            this.addError(node.line, 1, `Cannot compare types '${leftType}' and '${rightType}'`, 'Semantic Error');
          }
          return 'BOOL';
        }

        return 'INT';
      }

      case 'LogicalExpression': {
        const leftType = this.visit(node.left);
        const rightType = this.visit(node.right);
        if (leftType !== 'BOOL' || rightType !== 'BOOL') {
          this.addError(node.line, 1, `Logical operator '${node.operator}' requires boolean operands, found '${leftType}' and '${rightType}'`, 'Semantic Warning');
        }
        return 'BOOL';
      }

      case 'UnaryExpression': {
        const argType = this.visit(node.argument);
        const op = node.operator;
        
        if (!argType) return null;

        if (['++', '--'].includes(op)) {
          if (node.argument.type !== 'Identifier') {
            this.addError(node.line, 1, `Operator '${op}' requires a variable l-value`, 'Semantic Error');
          }
          if (argType !== 'INT' && argType !== 'FLOAT' && argType !== 'DOUBLE') {
            this.addError(node.line, 1, `Operator '${op}' cannot be applied to non-numeric type '${argType}'`, 'Semantic Error');
          }
          return argType;
        }

        if (op === '!') {
          if (argType !== 'BOOL') {
            this.addError(node.line, 1, `Logical negation '!' requires boolean operand, found '${argType}'`, 'Semantic Warning');
          }
          return 'BOOL';
        }

        if (op === '-' || op === '+') {
          if (argType !== 'INT' && argType !== 'FLOAT' && argType !== 'DOUBLE') {
            this.addError(node.line, 1, `Unary '${op}' cannot be applied to non-numeric type '${argType}'`, 'Semantic Error');
          }
          return argType;
        }

        return 'INT';
      }

      case 'Identifier': {
        const lookup = this.currentScope.lookup(node.value);
        if (!lookup) {
          this.addError(node.line, node.col, `Undeclared variable '${node.value}'`, 'Semantic Error');
          return 'INT'; // default recovery
        }
        return lookup.variable.type;
      }

      case 'Literal':
        return node.valueType;

      case 'ErrorNode':
        return null;
    }
    return null;
  }

  // Check type compatibility and record warnings/errors
  checkTypeCompatibility(lhs, rhs, line, col) {
    if (lhs === rhs) return;

    // Coercion from integer to float/double is allowed
    if ((lhs === 'FLOAT' || lhs === 'DOUBLE') && rhs === 'INT') {
      return;
    }

    // Coercion from float/double to integer yields a precision warning
    if (lhs === 'INT' && (rhs === 'FLOAT' || rhs === 'DOUBLE')) {
      this.addError(line, col, `Implicit conversion from '${rhs}' to '${lhs}' (possible loss of precision)`, 'Semantic Warning');
      return;
    }

    // Incompatible types
    this.addError(line, col, `Type mismatch: cannot assign type '${rhs}' to target of type '${lhs}'`, 'Semantic Error');
  }

  getConstantValue(node) {
    if (!node) return undefined;
    
    // Constant folding helper
    if (node.type === 'Literal') {
      return node.value;
    }

    if (node.type === 'ParenthesizedExpression') {
      return this.getConstantValue(node.expression);
    }

    if (node.type === 'BinaryExpression') {
      const left = this.getConstantValue(node.left);
      const right = this.getConstantValue(node.right);
      
      if (left === undefined || right === undefined) return undefined;
      
      switch (node.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return right !== 0 ? left / right : 0;
        case '%': return right !== 0 ? left % right : 0;
        case '==': return left === right;
        case '!=': return left !== right;
        case '<': return left < right;
        case '>': return left > right;
        case '<=': return left <= right;
        case '>=': return left >= right;
      }
    }
    return undefined;
  }
}

if (typeof window !== 'undefined') {
  window.WPlusSemantic = WPlusSemantic;
}
