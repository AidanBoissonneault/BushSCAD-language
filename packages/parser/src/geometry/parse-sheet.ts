/**
 * @author Aidan Boissonneault
 * @file parse-sheet.ts
 * @purpose Parses sheet for the geometry in parser package.
 * @last-edited October 6, 2026
 */

import type {
  Expr,
  SheetDecl,
  SheetStatement,
  SheetObjDecl,
  FlangeStmt,
  FlangeDirection,
  FlatPatternExportStmt,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parseSketch } from '../sketch/parse-sketch.js';
import { parseVar } from '../statements/parse-declarations.js';

/**
 * sheet <name> thickness: <expr> [material: <expr>] [bend_radius: <expr>] [k_factor: <expr>] {
 *   sketch base = rect(80, 40);
 *   obj base = sheet_base(base);
 *   flange base.edge(front) length: 20 angle: 90deg radius: 1 [direction: up];
 *   export flat_pattern dxf './exports/bracket-flat.dxf';
 * }
 */
export function parseSheetDecl(p: Parser): SheetDecl {
  const start = p.peek().span;
  p.advance(); // SHEET
  const nameToken = p.expect('IDENT');
  const name = nameToken.value;

  let thickness: Expr | null = null;
  let material: Expr | null = null;
  let bendRadius: Expr | null = null;
  let kFactor: Expr | null = null;

  while (isNamedKey(p)) {
    const key = p.advance();
    p.expect('COLON');
    const value = p.parseExpr();
    switch (key.value) {
      case 'thickness':
        thickness = value;
        break;
      case 'material':
        material = value;
        break;
      case 'bend_radius':
        bendRadius = value;
        break;
      case 'k_factor':
        kFactor = value;
        break;
      default:
        p.addError(`Unknown sheet setting '${key.value}'`, key.span);
    }
  }

  if (thickness === null) {
    p.addError(`sheet '${name}' requires a 'thickness:' setting`, start);
    thickness = { kind: 'number', value: 1, span: start };
  }

  p.expect('LBRACE');
  const body: SheetStatement[] = [];
  while (!p.check('RBRACE', 'EOF')) {
    const stmt = parseSheetStatement(p);
    if (stmt) body.push(stmt);
  }
  p.expect('RBRACE');

  return {
    kind: 'sheet',
    name,
    nameSpan: nameToken.span,
    thickness,
    material,
    bendRadius,
    kFactor,
    body,
    span: p.spanFrom(start),
  };
}

/**
 * True when the next token starts a `key:` named argument. Some setting names
 * (`radius`, `material`) lex as hard keyword tokens rather than IDENT.
 */
function isNamedKey(p: Parser): boolean {
  const k = p.peek().kind;
  return (
    (k === 'IDENT' || k === 'RADIUS' || k === 'MATERIAL') &&
    p.peek(1).kind === 'COLON'
  );
}

/**
 * Parses sheet statement from the supplied source into the geometry representation.
 */
function parseSheetStatement(p: Parser): SheetStatement | null {
  const t = p.peek();
  switch (t.kind) {
    case 'SKETCH':
      return parseSketch(p);
    case 'VAR':
      return parseVar(p);
    case 'OBJ':
      return parseSheetObj(p);
    case 'EXPORT':
      return parseFlatPatternExport(p);
    case 'IDENT':
      if (t.value === 'flange') return parseFlange(p);
      p.fail(`Unexpected statement in sheet block: '${t.value}'`, t.span);
      return null;
    default:
      p.fail(`Unexpected token in sheet block: '${t.kind}'`, t.span);
      return null;
  }
}

/**
 * Parses sheet obj from the supplied source into the geometry representation.
 */
function parseSheetObj(p: Parser): SheetObjDecl {
  const start = p.peek().span;
  p.advance(); // OBJ
  const nameToken = p.expect('IDENT');
  const name = nameToken.value;
  p.expect('ASSIGN');
  const op = p.expect('IDENT');
  if (op.value !== 'sheet_base') {
    p.addError(
      `sheet objects must use sheet_base(...), got '${op.value}'`,
      op.span,
    );
  }
  p.expect('LPAREN');
  const sketch = p.expect('IDENT').value;
  p.expect('RPAREN');
  p.eatSemi();
  return {
    kind: 'sheetObj',
    name,
    nameSpan: nameToken.span,
    sketch,
    span: p.spanFrom(start),
  };
}

/**
 * Options for flange, including length, angle, radius, and direction.
 */
type FlangeOptions = {
  length: Expr | null;
  angle: Expr | null;
  radius: Expr | null;
  direction: FlangeDirection;
};

/**
 * Parses flange from the supplied source into the geometry representation.
 */
function parseFlange(p: Parser): FlangeStmt {
  const start = p.peek().span;
  p.advance(); // 'flange'
  const edgeObj = p.expect('IDENT').value;
  p.expect('DOT');
  const edgeKw = p.expect('IDENT');
  if (edgeKw.value !== 'edge') {
    p.addError(`flange targets an edge: <obj>.edge(<name>)`, edgeKw.span);
  }
  p.expect('LPAREN');
  const edgeName = p.expect('IDENT').value;
  p.expect('RPAREN');

  const options = parseFlangeOptions(p);
  p.eatSemi();
  const required = applyRequiredFlangeDefaults(p, options, start);

  return {
    kind: 'flange',
    edgeObj,
    edgeName,
    length: required.length,
    angle: required.angle,
    radius: options.radius,
    direction: options.direction,
    span: p.spanFrom(start),
  };
}

/**
 * Parses flange options from the supplied source into the geometry representation.
 */
function parseFlangeOptions(p: Parser): FlangeOptions {
  const options: FlangeOptions = {
    length: null,
    angle: null,
    radius: null,
    direction: 'up',
  };
  while (isNamedKey(p)) {
    parseFlangeOption(p, options);
  }
  return options;
}

/**
 * Parses flange option from the supplied source into the geometry representation.
 */
function parseFlangeOption(p: Parser, options: FlangeOptions): void {
  const key = p.advance();
  p.expect('COLON');
  if (key.value === 'direction') {
    options.direction = parseFlangeDirection(p, options.direction);
    return;
  }
  const value = p.parseExpr();
  switch (key.value) {
    case 'length':
      options.length = value;
      break;
    case 'angle':
      options.angle = value;
      break;
    case 'radius':
      options.radius = value;
      break;
    default:
      p.addError(`Unknown flange setting '${key.value}'`, key.span);
  }
}

/**
 * Parses flange direction from the supplied source into the geometry representation.
 */
function parseFlangeDirection(
  p: Parser,
  fallback: FlangeDirection,
): FlangeDirection {
  const dir = p.expect('IDENT');
  if (dir.value !== 'up' && dir.value !== 'down') {
    p.addError(`flange direction must be 'up' or 'down'`, dir.span);
    return fallback;
  }
  return dir.value;
}

/**
 * Applies required flange defaults to the supplied state or geometry.
 */
function applyRequiredFlangeDefaults(
  p: Parser,
  options: FlangeOptions,
  start: FlangeStmt['span'],
): { length: Expr; angle: Expr } {
  let length = options.length;
  let angle = options.angle;
  if (length === null) {
    p.addError(`flange requires a 'length:' setting`, start);
    length = { kind: 'number', value: 10, span: start };
  }
  if (angle === null) {
    p.addError(`flange requires an 'angle:' setting`, start);
    angle = { kind: 'number', value: 90, span: start };
  }
  return { length, angle };
}

/**
 * Parses flat pattern export from the supplied source into the geometry representation.
 */
function parseFlatPatternExport(p: Parser): FlatPatternExportStmt {
  const start = p.peek().span;
  p.advance(); // EXPORT
  const kw = p.expect('IDENT');
  if (kw.value !== 'flat_pattern') {
    p.addError(
      `only 'export flat_pattern' is supported inside a sheet block`,
      kw.span,
    );
  }
  const fmt = p.expect('IDENT');
  if (fmt.value !== 'dxf') {
    p.addError(`flat_pattern export format must be 'dxf'`, fmt.span);
  }
  const path = p.expect('STRING').value;
  p.eatSemi();
  return {
    kind: 'flatPatternExport',
    format: 'dxf',
    path,
    span: p.spanFrom(start),
  };
}
