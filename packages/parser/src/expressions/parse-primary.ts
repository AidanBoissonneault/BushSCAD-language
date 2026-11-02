/**
 * @author Aidan Boissonneault
 * @file parse-primary.ts
 * @purpose Parses primary for the expressions in parser package.
 * @last-edited October 6, 2026
 */

import type {
  Expr,
  NumberLiteral,
  StringLiteral,
  TemplateStringExpr,
  ThisExpr,
  UnitExpr,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import type { TokenKind } from '../core/token-types.js';

const UNIT_BY_TOKEN: Partial<Record<TokenKind, UnitExpr['unit']>> = {
  UNIT_MM: 'mm',
  UNIT_CM: 'cm',
  UNIT_M: 'm',
  UNIT_IN: 'in',
  UNIT_FT: 'ft',
  UNIT_DEG: 'deg',
};

const IDENT_KEYWORD_TOKENS = new Set<TokenKind>([
  'RECT',
  'CIRCLE',
  'ROUNDRECT',
  'TRIANGLE',
  'POLYGON',
  'WORD',
  'RANGE',
  'GRID',
  'RADIAL',
  'ENUMERATE',
  'OPEN',
  'FROM',
  'AT',
]);

/**
 * Parses primary from the supplied source into the expressions representation.
 */
export function parsePrimary(p: Parser): Expr {
  const t = p.peek();
  if (t.kind === 'NUMBER') return parseNumberPrimary(p);
  if (t.kind === 'STRING') {
    p.advance();
    return { kind: 'string', value: t.value, span: t.span } as StringLiteral;
  }
  if (t.kind === 'TEMPLATE_START') return parseTemplateString(p);
  if (t.kind === 'BOOL') {
    p.advance();
    return { kind: 'bool', value: t.value === 'true', span: t.span };
  }
  if (t.kind === 'LBRACKET') return p.parseListLiteral();
  if (t.kind === 'LPAREN') return parseParenthesizedPrimary(p);
  if (t.kind === 'THIS') return parseThisPrimary(p);
  if (t.kind === 'AT_SIGN') return p.parseSpatialRef();
  if (t.kind === 'POS') {
    p.fail(`@ has been removed; use @target(...) spatial references`, t.span);
  }
  if (t.kind === 'AUTO') {
    p.advance();
    return { kind: 'auto', span: t.span };
  }
  if (t.kind === 'IDENT') return parseIdentPrimary(p);
  if (IDENT_KEYWORD_TOKENS.has(t.kind)) return parseKeywordIdentifier(p);
  p.fail(`Unexpected token in expression: ${t.kind}('${t.value}')`, t.span);
}

/** Parses text and substitutions without changing the ordinary expression grammar. */
function parseTemplateString(p: Parser): TemplateStringExpr {
  const start = p.advance().span;
  const parts: TemplateStringExpr['parts'] = [];
  while (!p.check('TEMPLATE_END', 'EOF')) {
    const invalidEscape = p.eat('TEMPLATE_INVALID_ESCAPE');
    if (invalidEscape) {
      p.addError(
        'Invalid escape sequence in template string',
        invalidEscape.span,
      );
      continue;
    }
    const text = p.eat('TEMPLATE_TEXT');
    if (text) {
      parts.push({ kind: 'text', value: text.value, span: text.span });
      continue;
    }
    const interpolation = p.expect(
      'TEMPLATE_EXPR_START',
      'Expected template string text or substitution',
    );
    const expression = p.parseExpr();
    p.expect('TEMPLATE_EXPR_END', "Expected '}' to end template substitution");
    parts.push({
      kind: 'expression',
      expression,
      span: p.spanFrom(interpolation.span),
    });
  }
  p.expect('TEMPLATE_END', 'Unterminated template string');
  return { kind: 'template', parts, span: p.spanFrom(start) };
}

/**
 * Parses number primary from the supplied source into the expressions representation.
 */
function parseNumberPrimary(p: Parser): Expr {
  const t = p.advance();
  const value = parseFloat(t.value);
  const unit = UNIT_BY_TOKEN[p.peek().kind];
  if (!unit) return { kind: 'number', value, span: t.span } as NumberLiteral;
  p.advance();
  const num: NumberLiteral = { kind: 'number', value, span: t.span };
  return {
    kind: 'unit',
    value: num,
    unit,
    span: p.spanFrom(t.span),
  } as UnitExpr;
}

/**
 * Parses parenthesized primary from the supplied source into the expressions representation.
 */
function parseParenthesizedPrimary(p: Parser): Expr {
  const start = p.peek().span;
  p.advance();
  const first = p.parseExpr();
  if (p.eat('COMMA')) {
    const second = p.parseExpr();
    p.expect('RPAREN');
    return { kind: 'tuple', x: first, y: second, span: p.spanFrom(start) };
  }
  p.expect('RPAREN');
  return { ...first, span: p.spanFrom(start) };
}

/**
 * Parses this primary from the supplied source into the expressions representation.
 */
function parseThisPrimary(p: Parser): ThisExpr {
  const start = p.peek().span;
  p.advance();
  p.expect('DOT');
  const prop = p.advance();
  const valid = ['width', 'height', 'center', 'area', 'normal'];
  if (!valid.includes(prop.value))
    p.addError(`Unknown this.${prop.value}`, prop.span);
  return {
    kind: 'this',
    property: prop.value as ThisExpr['property'],
    span: p.spanFrom(start),
  } as ThisExpr;
}

/**
 * Parses ident primary from the supplied source into the expressions representation.
 */
function parseIdentPrimary(p: Parser): Expr {
  const t = p.advance();
  if (p.check('LPAREN')) return p.parseFnCallFromIdent(t);
  if (p.check('DOT')) return p.parseFaceRefFromIdent(t);
  return { kind: 'identifier', name: t.value, span: t.span };
}

/**
 * Parses keyword identifier from the supplied source into the expressions representation.
 */
function parseKeywordIdentifier(p: Parser): Expr {
  const t = p.advance();
  return { kind: 'identifier', name: t.value, span: t.span };
}
