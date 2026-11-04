/**
 * Parses function declarations in the BushSCAD statement grammar.
 */
import type { FnDecl, FnParam } from '@bushscad/ir';
import type { Parser } from '../../core/parser.js';
/**
 * Parses a geometry function declaration and rejects ambiguous parameter names.
 *
 * Why:
 * Function arguments bind by parameter name, so duplicate declarations cannot
 * be assigned distinct values reliably by the evaluator.
 */
export function parseFn(p: Parser, exported: boolean): FnDecl {
  const start = p.peek().span;
  p.advance(); // FN
  const name = p.expect('IDENT').value;
  const params = parseFunctionParameters(p);
  const body = p.parseComponentBody();
  return { kind: 'fn', name, params, body, exported, span: p.spanFrom(start) };
}

/**
 * Parses optional function parameters and reports duplicate names.
 *
 * Why: keeping parameter-list recovery together lets `parseFn` focus on the
 * declaration lifecycle while preserving parser diagnostics and token flow.
 */
function parseFunctionParameters(p: Parser): FnParam[] {
  if (!p.eat('LPAREN')) {
    p.addError(`Expected '(' after function name`, p.peek().span);
    return [];
  }
  return parseFunctionParameterList(p);
}

/**
 * Parses parameters until the closing parenthesis or a recoverable syntax error.
 */
function parseFunctionParameterList(p: Parser): FnParam[] {
  const params: FnParam[] = [];
  const names = new Set<string>();
  while (!p.check('RPAREN', 'EOF')) {
    const parameter = parseFunctionParameter(p, names);
    if (!parameter) break;
    params.push(parameter);
    if (!p.eat('COMMA')) break;
  }
  p.expect('RPAREN');
  return params;
}

/**
 * Parses one parameter and reports duplicate names at their source token.
 */
function parseFunctionParameter(p: Parser, names: Set<string>): FnParam | null {
  if (!p.check('IDENT')) {
    p.addError(
      `Expected parameter name, got '${p.peek().value || p.peek().kind}'`,
      p.peek().span,
    );
    return null;
  }
  const parameter = p.expect('IDENT');
  const name = parameter.value;
  if (names.has(name)) {
    p.addError(`Duplicate function parameter '${name}'`, parameter.span);
  } else {
    names.add(name);
  }
  return {
    name,
    default: p.eat('COLON') ? p.parseExpr() : null,
  };
}
