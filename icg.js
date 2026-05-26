// ═══════════════════════════════════════════════════════════════
//  W++ INTERMEDIATE CODE GENERATOR  —  CS-310 Compiler Construction
// ═══════════════════════════════════════════════════════════════

/**
 * W++ Intermediate Code Generator (ICG) - Generates Three-Address Code (TAC).
 */
class WPlusICG {
  /**
   * Creates an instance of WPlusICG.
   * @param {Object} ast - The Abstract Syntax Tree (AST) node.
   */
  constructor(ast) {
    this.ast = ast;
    this.instructions = [];
    this.tempCount = 0;
    this.labelCount = 0;
  }

  /**
   * Generates a new unique temporary variable name.
   * @returns {string} The temporary variable name (e.g. t0, t1).
   */
  newTemp() {
    const t = `t${this.tempCount}`;
    this.tempCount++;
    return t;
  }

  /**
   * Generates a new unique conditional branch label.
   * @returns {string} The branch label (e.g. L0, L1).
   */
  newLabel() {
    const l = `L${this.labelCount}`;
    this.labelCount++;
    return l;
  }

  /**
   * Emits a Three-Address Code instruction to the buffer.
   * @param {string} inst - The instruction string to record.
   */
  emit(inst) {
    this.instructions.push(inst);
  }

  /**
   * Translates the loaded AST into the final list of Three-Address Code instructions.
   * @returns {Array<string>} An array of TAC instruction strings.
   */
  generate() {
    if (!this.ast || typeof this.ast !== 'object' || !this.ast.type) {
      return [];
    }
    this.visit(this.ast);
    return this.instructions;
  }

  visit(node) {
    if (!node) return '';

    switch (node.type) {
      case 'Program':
        for (const stmt of node.body) {
          this.visit(stmt);
        }
        break;

      case 'MainFunction':
        this.emit(`proc main`);
        this.visit(node.body);
        this.emit(`endproc`);
        break;

      case 'Block':
        for (const stmt of node.statements) {
          this.visit(stmt);
        }
        break;

      case 'VariableDeclaration':
        for (const decl of node.declarations) {
          if (decl.init) {
            const rhs = this.visit(decl.init);
            this.emit(`${decl.id} = ${rhs}`);
          } else {
            // Implicit default initialization for display
            this.emit(`decl ${decl.id}`);
          }
        }
        break;

      case 'AssignmentExpression': {
        const rhs = this.visit(node.right);
        const lhs = this.visit(node.left);
        this.emit(`${lhs} = ${rhs}`);
        return lhs;
      }

      case 'ExpressionStatement':
        this.visit(node.expression);
        break;

      case 'IfStatement': {
        const cond = this.visit(node.condition);
        const labelElse = this.newLabel();
        const labelEnd = this.newLabel();

        if (node.alternate) {
          this.emit(`ifFalse ${cond} goto ${labelElse}`);
          this.visit(node.consequent);
          this.emit(`goto ${labelEnd}`);
          this.emit(`${labelElse}:`);
          this.visit(node.alternate);
          this.emit(`${labelEnd}:`);
        } else {
          this.emit(`ifFalse ${cond} goto ${labelElse}`);
          this.visit(node.consequent);
          this.emit(`${labelElse}:`);
        }
        break;
      }

      case 'WhileStatement': {
        const labelStart = this.newLabel();
        const labelEnd = this.newLabel();

        this.emit(`${labelStart}:`);
        const cond = this.visit(node.condition);
        this.emit(`ifFalse ${cond} goto ${labelEnd}`);
        this.visit(node.body);
        this.emit(`goto ${labelStart}`);
        this.emit(`${labelEnd}:`);
        break;
      }

      case 'ForStatement': {
        this.enterForLoopContext(node);
        break;
      }

      case 'DoWhileStatement': {
        const labelStart = this.newLabel();
        this.emit(`${labelStart}:`);
        this.visit(node.body);
        const cond = this.visit(node.condition);
        this.emit(`if ${cond} goto ${labelStart}`);
        break;
      }

      case 'ReturnStatement':
        if (node.argument) {
          const arg = this.visit(node.argument);
          this.emit(`return ${arg}`);
        } else {
          this.emit(`return`);
        }
        break;

      case 'PrintStatement': {
        const arg = this.visit(node.argument);
        this.emit(`print ${arg}`);
        break;
      }

      case 'ReadStatement':
        this.emit(`read ${node.identifier}`);
        break;

      case 'ParenthesizedExpression':
        return this.visit(node.expression);

      case 'BinaryExpression':
      case 'LogicalExpression': {
        const left = this.visit(node.left);
        const right = this.visit(node.right);
        const temp = this.newTemp();
        this.emit(`${temp} = ${left} ${node.operator} ${right}`);
        return temp;
      }

      case 'UnaryExpression': {
        const arg = this.visit(node.argument);
        const temp = this.newTemp();
        if (node.prefix) {
          this.emit(`${temp} = ${node.operator}${arg}`);
          // If prefix increment/decrement, apply side effect
          if (node.operator === '++' || node.operator === '--') {
            const valName = node.argument.value;
            const step = node.operator === '++' ? '+' : '-';
            this.emit(`${valName} = ${valName} ${step} 1`);
          }
        } else {
          // Postfix: temp gets the original value, then side effect happens
          this.emit(`${temp} = ${arg}`);
          const valName = node.argument.value;
          const step = node.operator === '++' ? '+' : '-';
          this.emit(`${valName} = ${valName} ${step} 1`);
        }
        return temp;
      }

      case 'Identifier':
        return node.value;

      case 'Literal':
        return node.raw;

      default:
        return '';
    }
  }

  enterForLoopContext(node) {
    this.visit(node.init);
    const labelStart = this.newLabel();
    const labelEnd = this.newLabel();

    this.emit(`${labelStart}:`);
    if (node.condition) {
      const cond = this.visit(node.condition);
      this.emit(`ifFalse ${cond} goto ${labelEnd}`);
    }
    
    this.visit(node.body);
    
    if (node.update) {
      this.visit(node.update);
    }
    
    this.emit(`goto ${labelStart}`);
    this.emit(`${labelEnd}:`);
  }
}

if (typeof window !== 'undefined') {
  window.WPlusICG = WPlusICG;
}
