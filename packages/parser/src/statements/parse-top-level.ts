/**
 * @author Aidan Boissonneault
 * @file parse-top-level.ts
 * @purpose Parses top level for the statements in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ImportDecl,
  ExportDecl,
  RefPartDecl,
  RefObjDecl,
  RotateStatement,
  PartDecl,
  TopLevelStatement,
  Program,
  ASTSourceSpan,
  UseDecl,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import {
  parseVar,
  parseEnv,
  parseFontImport,
  isFontImportStart,
} from './parse-declarations.js';
import { parseSketch } from '../sketch/parse-sketch.js';
import { parseSurfaceDecl } from '../geometry/parse-surface.js';
import { parseObj } from '../objects/parse-object-ops.js';
import { parseAxisRef } from '../references/parse-axis-ref.js';
import {
  parseObjectOperation,
  parseWrapSuffix,
} from '../objects/parse-object-ops.js';
import { parseFn } from './fn/parse-fn.js';
import { parseObjectTargetName } from '../expressions/parse-names.js';

/**
 * Parses base unit from the supplied source into the statements representation.
 */
export function parseBaseUnit(p: Parser): Program['baseUnit'] {
  p.advance(); // BASE_UNIT
  p.expect('ASSIGN');
  const t = p.advance();
  p.requireSemi();
  const v = t.value;
  if (v === 'mm' || v === 'cm' || v === 'm' || v === 'in' || v === 'ft')
    return v;
  p.addError(`Unknown base_unit '${v}'`, t.span);
  return 'mm';
}

/**
 * Parses workplane from the supplied source into the statements representation.
 */
export function parseWorkplane(p: Parser): Program['workplane'] {
  p.advance(); // WORKPLANE
  p.expect('ASSIGN');
  const t = p.advance();
  p.requireSemi();
  const v = t.value;
  if (v === 'XY' || v === 'XZ' || v === 'YZ') return v;
  p.addError(`Unknown workplane '${v}'`, t.span);
  return 'XY';
}

/**
 * Parses import from the supplied source into the statements representation.
 */
export function parseImport(p: Parser): ImportDecl {
  const start = p.peek().span;
  p.advance(); // IMPORT

  if (p.eat('STAR')) {
    p.expect('AS');
    const ns = p.expect('IDENT').value;
    p.expect('FROM');
    const path = p.expect('STRING').value;
    p.requireSemi();
    return {
      kind: 'import',
      path,
      names: null,
      namespace: ns,
      span: p.spanFrom(start),
    };
  }

  if (p.check('LBRACE')) {
    p.advance();
    const names: ImportDecl['names'] = [];
    while (!p.check('RBRACE', 'EOF')) {
      const name = p.expect('IDENT').value;
      const alias = p.eat('AS') ? p.expect('IDENT').value : null;
      names!.push({ name, alias });
      p.eat('COMMA');
    }
    p.expect('RBRACE');
    p.expect('FROM');
    const path = p.expect('STRING').value;
    p.requireSemi();
    return {
      kind: 'import',
      path,
      names,
      namespace: null,
      span: p.spanFrom(start),
    };
  }

  const path = p.expect('STRING').value;
  p.requireSemi();
  return {
    kind: 'import',
    path,
    names: null,
    namespace: null,
    span: p.spanFrom(start),
  };
}

/**
 * Parses export from the supplied source into the statements representation.
 */
export function parseExport(p: Parser): ExportDecl {
  const start = p.peek().span;
  p.advance(); // EXPORT

  let statement: TopLevelStatement;
  if (p.check('VAR')) statement = parseVar(p);
  else if (p.check('ENV')) statement = parseEnv(p);
  else if (isFontImportStart(p)) statement = parseFontImport(p);
  else if (p.check('SKETCH')) statement = parseSketch(p);
  else if (p.check('SURFACE')) statement = parseSurfaceDecl(p);
  else if (p.check('OBJ')) statement = parseObj(p);
  else if (p.check('PART')) statement = parsePart(p);
  else if (p.check('FN')) statement = parseFn(p, true);
  else if (p.check('REF')) statement = parseRef(p);
  else p.fail(`Unexpected export target: ${p.peek().kind}`, p.peek().span);

  return { kind: 'export', statement, span: p.spanFrom(start) };
}

/**
 * Parses rotate from the supplied source into the statements representation.
 */
export function parseRotate(p: Parser): RotateStatement {
  const start = p.peek().span;
  p.advance(); // ROTATE
  const target = parseObjectTargetName(p);
  const angle = p.parseExpr();
  p.expect('AROUND');
  const around = parseAxisRef(p);
  p.requireSemi();
  return { kind: 'rotate', target, angle, around, span: p.spanFrom(start) };
}

/**
 * Parses part from the supplied source into the statements representation.
 */
export function parsePart(p: Parser): PartDecl {
  const start = p.peek().span;
  p.advance(); // PART
  const nameToken = p.expect('IDENT');
  const name = nameToken.value;
  if (p.eat('ASSIGN')) {
    p.addError(
      `Part declarations no longer use '='; write 'part ${name} { ... }'`,
      p.peek().span,
    );
  }
  const body = p.parseComponentBody();
  p.eatSemi();
  return {
    kind: 'part',
    name,
    nameSpan: nameToken.span,
    body,
    span: p.spanFrom(start),
  };
}

/**
 * Parses a block-bodied ref declaration after the opening position is known.
 * New syntax accepts `ref name { ... }` while the removed `ref name = { ... }`
 * form is still recovered for diagnostics. Both paths must build identical AST.
 */
function parseRefPartBlock(
  p: Parser,
  start: ASTSourceSpan,
  name: string,
  nameSpan: ASTSourceSpan,
  extendsBase: string | undefined,
): RefPartDecl {
  const body = p.parseComponentBody();
  p.eatSemi();
  const result: RefPartDecl = {
    kind: 'refPart',
    name,
    nameSpan,
    body,
    span: p.spanFrom(start),
  };
  if (extendsBase !== undefined) result.extends = extendsBase;
  return result;
}

/**
 * Parses ref from the supplied source into the statements representation.
 */
export function parseRef(p: Parser): RefPartDecl | RefObjDecl {
  const start = p.peek().span;
  p.advance(); // REF
  const nameToken = p.expect('IDENT');
  const name = nameToken.value;
  let extendsBase: string | undefined;
  if (p.peek().kind === 'IDENT' && p.peek().value === 'extends') {
    p.advance(); // extends
    extendsBase = p.expect('IDENT').value;
  }
  if (p.check('LBRACE')) {
    return parseRefPartBlock(p, start, name, nameToken.span, extendsBase);
  }

  p.expect('ASSIGN');
  if (p.check('LBRACE')) {
    p.addError(
      `Ref block declarations no longer use '='; write 'ref ${name}${extendsBase ? ` extends ${extendsBase}` : ''} { ... }'`,
      p.peek().span,
    );
    return parseRefPartBlock(p, start, name, nameToken.span, extendsBase);
  }

  {
    if (extendsBase !== undefined) {
      p.fail(`ref extends declarations require a block body`, p.peek().span);
    }
    const operation = parseObjectOperation(p);
    if (operation.kind === 'extrude' || operation.kind === 'cut') {
      const suffixWrap = parseWrapSuffix(p);
      operation.wrap = operation.wrap || suffixWrap;
    }
    p.requireSemi();
    return {
      kind: 'refObj',
      name,
      nameSpan: nameToken.span,
      operation,
      span: p.spanFrom(start),
    };
  }
}

/**
 * Parses use declaration from the supplied source into the statements representation.
 */
export function parseUseDecl(p: Parser): UseDecl {
  const start = p.peek().span;
  p.advance(); // USE
  // Collect dotted path: std.hardware.metric
  let library = p.expect('IDENT').value;
  while (p.peek().kind === 'DOT' && p.peek(1).kind === 'IDENT') {
    p.advance(); // DOT
    library += '.' + p.advance().value;
  }
  p.requireSemi();
  return { kind: 'use', library, span: p.spanFrom(start) };
}
