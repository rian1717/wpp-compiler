# W++ Compiler Construction Project

Welcome to the **W++ Compiler Construction** project, built for the CS-310 Course. This project features a complete browser-based compiler pipeline for a C/C++-inspired educational language called W++.

## Features

- **Lexical Analysis (Scanner)**: Tokenizes source code, identifies operators, identifiers, literal values, keywords, and logs lexical errors.
- **Syntax Analysis (Parser)**: Builds an Abstract Syntax Tree (AST) using a recursive descent parser. Implements synchronization-based error recovery to report multiple syntax issues at once.
- **Semantic Analysis**: Builds scope hierarchies (global, function, block, and loop levels), performs type checking, detects double declarations, undeclared variables, type coercion warnings, and tracks variable usage.
- **AST Optimization**: Traverses the AST recursively to perform constant folding and dead code elimination (e.g., pruning code after `return` statements and folding constant loops like `while (false)`).
- **Three-Address Code (TAC/ICG)**: Translates the optimized AST into an intermediate representation (Three-Address Code) with temporary variables and conditional branch labels.

## Project Structure

- `index.html`: The compiler landing page featuring team details and links to scanner/parser modes.
- `workspace.html` & `workspace.css`: The interactive compiler suite, containing a syntax-highlighted editor, preset templates, and diagnostics tabs for each compiler phase.
- `tokenizer.js`: Contains lexical analysis routines and statistical report generators.
- `parser.js`: Contains the AST definition and recursive descent parser rules.
- `semantic.js`: Implements scope checking and type analysis rules.
- `optimizer.js`: Implements AST-to-AST optimization rules (Constant folding, dead code removal).
- `icg.js`: Contains intermediate code generation code.
- `style.css`: Global styles for general layouts, theme toggles, and data tables.

## Authors
- Rai Rian Hassan Khan (23-CS-128)
- Sameer Abrar (23-CS-117)
- Zakwan Ureed Mustafa (23-CS-100)
