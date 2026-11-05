/**
 * @author Aidan Boissonneault
 * @file parse-joint.ts
 * @purpose Parses joint for the objects in parser package.
 * @last-edited October 6, 2026
 */

import type { JointDecl, JointType } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

const JOINT_TYPES = new Set<string>([
  'fixed',
  'revolute',
  'slider',
  'planar',
  'ball',
]);

/** Identifies a type-led joint declaration without reserving joint type words. */
export function isJointDeclStart(p: Parser): boolean {
  return (
    p.check('IDENT') &&
    JOINT_TYPES.has(p.peek().value) &&
    p.peek(1).kind === 'IDENT' &&
    p.peek(2).kind === 'LPAREN'
  );
}

/**
 * Parses a joint endpoint in the same `@object.surface` form used elsewhere.
 *
 * Why:
 * Joint endpoints become resolved IR labels rather than placement expressions,
 * so retaining the qualified name is sufficient while the leading `@` keeps
 * authored spatial references consistent across the language.
 */
function parseJointRefString(p: Parser): string {
  p.expect('AT_SIGN', 'Joint references must use @object.surface syntax');
  const first = p.expect('IDENT').value;
  const segments = [first];
  while (p.eat('DOT')) segments.push(p.expect('IDENT').value);
  return segments.join('.');
}

/**
 * slider <name>(@<movingRef>, @<supportRef>) {
 *   range = 0mm..80mm;
 *   default = 0mm;
 * }
 */
export function parseJointDecl(p: Parser): JointDecl {
  const start = p.peek().span;
  const typeTok = p.expect('IDENT');
  const jointType = typeTok.value as JointType;
  const name = p.expect('IDENT').value;
  p.expect('LPAREN');
  const sideA = parseJointRefString(p);
  p.expect('COMMA');
  const sideB = parseJointRefString(p);
  p.expect('RPAREN');
  p.expect('LBRACE');

  let limitMin: JointDecl['limitMin'];
  let limitMax: JointDecl['limitMax'];
  let defaultValue: JointDecl['defaultValue'];

  while (!p.check('RBRACE', 'EOF')) {
    const key = p.advance();
    p.expect('ASSIGN');

    switch (key.value) {
      case 'range': {
        limitMin = p.parseExpr();
        // The range separator is lexed as two DOT tokens.
        p.expect('DOT');
        p.expect('DOT');
        limitMax = p.parseExpr();
        p.requireSemi();
        break;
      }
      case 'default': {
        defaultValue = p.parseExpr();
        p.requireSemi();
        break;
      }
      default:
        p.addError(`Unknown ${jointType} property '${key.value}'`, key.span);
        // skip to semicolon or closing brace
        while (!p.check('SEMICOLON', 'RBRACE', 'EOF')) p.advance();
        p.requireSemi();
    }
  }

  p.expect('RBRACE');

  return {
    kind: 'joint',
    name,
    sideA,
    sideB,
    jointType,
    limitMin,
    limitMax,
    defaultValue,
    span: p.spanFrom(start),
  };
}
