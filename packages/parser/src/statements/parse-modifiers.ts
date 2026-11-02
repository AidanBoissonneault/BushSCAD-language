/**
 * @author Aidan Boissonneault
 * @file parse-modifiers.ts
 * @purpose Parses modifiers for the statements in parser package.
 * @last-edited October 6, 2026
 */

import type {
  FilletDetail,
  ChamferDetail,
  ShellDetail,
  DraftDetail,
  PlaneDecl,
  AnchorDecl,
  RepeatableFaceRef,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parseObjectTargetName } from '../expressions/parse-names.js';

/**
 * Parses fillet from the supplied source into the statements representation.
 */
export function parseFillet(p: Parser): FilletDetail {
  const start = p.peek().span;
  p.advance(); // FILLET
  p.expect(
    'LPAREN',
    `fillet: target radius has been removed; use fillet(@target, radius)`,
  );
  const target = parseModifierTarget(p, 'fillet');
  p.expect('COMMA');
  const radius = p.parseExpr();
  p.expect('RPAREN');
  p.eatSemi();
  return { kind: 'fillet', target, radius, span: p.spanFrom(start) };
}

/**
 * Parses chamfer from the supplied source into the statements representation.
 */
export function parseChamfer(p: Parser): ChamferDetail {
  const start = p.peek().span;
  p.advance(); // CHAMFER
  p.expect(
    'LPAREN',
    `chamfer: target offset has been removed; use chamfer(@target, offset)`,
  );
  const target = parseModifierTarget(p, 'chamfer');
  p.expect('COMMA');
  const offset = p.parseExpr();
  p.expect('RPAREN');
  p.eatSemi();
  return { kind: 'chamfer', target, offset, span: p.spanFrom(start) };
}

/**
 * Parses a function-style modifier target.
 *
 * Modifiers now consume the same selectable `@` references as placement and
 * anchors, but their target must stay a feature reference rather than an
 * offset placement.
 */
function parseModifierTarget(
  p: Parser,
  modifierName: 'fillet' | 'chamfer',
): RepeatableFaceRef {
  if (!p.check('AT_SIGN') && !p.check('LBRACKET')) {
    p.fail(`${modifierName}(...) expects an @ reference target`, p.peek().span);
  }
  const target = p.parsePlacement();
  if (target.kind === 'faceRef' || target.kind === 'faceRefList') return target;
  p.addError(
    `${modifierName}(...) target cannot include placement offsets`,
    target.span,
  );
  return Array.isArray(target.anchor)
    ? { kind: 'faceRef', chain: [], span: target.span }
    : target.anchor;
}

/**
 * Parses shell from the supplied source into the statements representation.
 */
export function parseShell(p: Parser): ShellDetail {
  const start = p.peek().span;
  p.advance(); // SHELL
  p.expect('COLON');
  const target = parseObjectTargetName(p);
  const thickness = p.parseExpr();
  const openFaces: string[] = [];
  if (p.eat('OPEN')) {
    p.expect('COLON');
    if (p.eat('LBRACKET')) {
      while (!p.check('RBRACKET', 'EOF')) {
        openFaces.push(p.advance().value);
        p.eat('COMMA');
      }
      p.expect('RBRACKET');
    } else {
      openFaces.push(p.advance().value);
    }
  }
  p.eatSemi();
  return {
    kind: 'shell',
    target,
    thickness,
    openFaces,
    span: p.spanFrom(start),
  };
}

/**
 * Parses draft from the supplied source into the statements representation.
 */
export function parseDraft(p: Parser): DraftDetail {
  const start = p.peek().span;
  p.advance(); // DRAFT
  p.expect('COLON');
  const target = p.parseFaceRefFromIdent(p.expect('IDENT'));
  const angle = p.parseExpr();
  p.eatSemi();
  return { kind: 'draft', target, angle, span: p.spanFrom(start) };
}

/**
 * Parses plane from the supplied source into the statements representation.
 */
export function parsePlane(p: Parser): PlaneDecl {
  const start = p.peek().span;
  p.advance(); // PLANE
  const name = p.expect('IDENT').value;
  p.expect('ASSIGN');
  p.expect('OFFSET');
  p.expect('LPAREN');
  const offset = p.parseExpr();
  p.expect('COMMA');
  const from = p.parseSpatialRef();
  p.expect('RPAREN');
  p.eatSemi();
  return { kind: 'plane', name, offset, from, span: p.spanFrom(start) };
}

/**
 * Parses anchor from the supplied source into the statements representation.
 */
export function parseAnchor(p: Parser): AnchorDecl {
  p.fail(
    `anchor declarations have been removed; use @name = @target`,
    p.peek().span,
  );
}

/**
 * Parses an `@name = @target` spatial alias or component anchor declaration.
 *
 * The `@` declaration syntax replaces both named anchors and exact spatial
 * alias overrides while keeping their evaluator representation compact.
 */
export function parseSpatialAnchor(p: Parser): AnchorDecl {
  const start = p.peek().span;
  p.expect('AT_SIGN');
  let name = p.expect('IDENT').value;
  while (p.eat('DOT')) {
    name += `.${p.expect('IDENT').value}`;
  }
  p.expect('ASSIGN');
  const point = p.parseSpatialRef();
  p.eatSemi();
  return { kind: 'anchor', name, point, span: p.spanFrom(start) };
}
