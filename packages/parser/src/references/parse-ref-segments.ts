/**
 * @author Aidan Boissonneault
 * @file parse-ref-segments.ts
 * @purpose Parses ref segments for the references in parser package.
 * @last-edited October 6, 2026
 */

import {
  isRemovedReferenceSelectorCall,
  type FaceRefSegment,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import type { Token } from '../core/token-types.js';
import {
  referenceGroupSegment,
  referenceNameSegment,
  referenceSpan,
} from './reference-source-ranges.js';
import { parseEdgeIntersectionSegment } from './parse-edge-intersection.js';

/**
 * Parses a legacy call-shaped reference segment.
 * Call selectors are still accepted in a few internal/reference paths, and
 * keeping their parsing beside group/index/wildcard segments prevents the
 * full reference parser from owning every segment-level detail.
 */
export function parseFaceRefCallSeg(p: Parser, name: Token): FaceRefSegment {
  rejectRemovedReferenceCall(p, name.value);
  const arg = parseOptionalCallArg(p);
  const namedArgs = parseCallNamedArgs(p);
  p.expect('RPAREN');
  return namedArgs.length > 0
    ? {
        kind: 'call',
        name: name.value,
        arg,
        namedArgs,
        span: p.spanFrom(name.span),
      }
    : {
        kind: 'call',
        name: name.value,
        arg,
        span: p.spanFrom(name.span),
      };
}

/**
 * Parses optional call arg from the supplied source into the references representation.
 */
function parseOptionalCallArg(p: Parser): string {
  if (p.check('RPAREN', 'EOF')) return '';
  if (p.peek().kind === 'IDENT' && p.peek(1).kind === 'COLON') return '';
  return p.advance().value;
}

/**
 * Parses call named args from the supplied source into the references representation.
 */
function parseCallNamedArgs(p: Parser): { name: string; value: string }[] {
  const namedArgs: { name: string; value: string }[] = [];
  while (p.eat('COMMA')) {
    if (p.check('RPAREN', 'EOF')) break;
    if (p.peek().kind === 'IDENT' && p.peek(1).kind === 'COLON') {
      namedArgs.push(parseCallNamedArg(p));
    } else {
      p.advance();
    }
  }
  return namedArgs;
}

/**
 * Parses call named arg from the supplied source into the references representation.
 */
function parseCallNamedArg(p: Parser): { name: string; value: string } {
  const name = p.advance().value;
  p.advance();
  return { name, value: readSignedTokenValue(p) };
}

/**
 * Reads signed token value from the supplied source.
 */
function readSignedTokenValue(p: Parser): string {
  let sign = '';
  if (p.peek().kind === 'PLUS' || p.peek().kind === 'MINUS') {
    sign = p.advance().value;
  }
  return sign + p.advance().value;
}

/**
 * Parses `[a, b]` inside an anchored reference selector.
 * Array selector recovery is shared by roots and suffixes, including malformed
 * editor input while the user is still typing.
 */
export function parseFaceRefGroupSeg(p: Parser): FaceRefSegment {
  const start = p.expect('LBRACKET');
  const members: Token[] = [];
  while (!p.check('RBRACKET', 'EOF')) {
    if (!p.check('IDENT')) {
      p.addError(
        'Expected identifier in reference selector array',
        p.peek().span,
      );
      if (p.check('COMMA')) {
        p.advance();
        continue;
      }
      break;
    }
    members.push(p.advance());
    if (p.eat('COMMA')) continue;
    if (!p.check('RBRACKET', 'EOF')) {
      p.addError(
        'Expected comma or ] in reference selector array',
        p.peek().span,
      );
      break;
    }
  }
  const end = p.expect('RBRACKET');
  if (members.length === 0) {
    p.addError(
      'Reference selector arrays must contain at least one identifier',
      p.peek().span,
    );
  }
  return referenceGroupSegment(referenceSpan(start.span, end.span), members);
}

/**
 * Parses dotted reference suffix segments.
 * Bare expressions and anchored references share suffix syntax, but only
 * anchored references may use grouped or wildcard selectors.
 */
export function parseFaceRefSuffixSegments(
  p: Parser,
  allowGroups = true,
): FaceRefSegment[] {
  const segments: FaceRefSegment[] = [];
  while (p.eat('DOT')) {
    if (p.check('LPAREN')) {
      segments.push(parseEdgeIntersectionSegment(p));
      continue;
    }
    if (p.check('STAR')) {
      if (!allowGroups) {
        p.fail(
          `Wildcard reference selectors require @ syntax, such as @body.*.edges`,
          p.peek().span,
        );
      }
      segments.push({ kind: 'wildcard', span: p.advance().span });
      continue;
    }
    if (p.check('LBRACKET')) {
      if (!allowGroups) {
        p.fail(
          `Array reference selectors require @ syntax, such as @[body].top or [@body].top`,
          p.peek().span,
        );
      }
      segments.push(parseFaceRefGroupSeg(p));
      continue;
    }
    const name = p.expect('IDENT');
    const beforeName = segments.length;
    segments.push(referenceNameSegment(name));
    appendOptionalIndexSegment(p, segments);
    if (p.eat('LPAREN')) {
      segments.splice(beforeName);
      segments.push(parseFaceRefCallSeg(p, name));
    }
  }
  return segments;
}

/**
 * Appends `[n]` indexing after a reference segment when present.
 * Both explicit selector groups and generated object arrays use the same
 * indexed syntax and should produce identical AST segment shapes.
 */
export function appendOptionalIndexSegment(
  p: Parser,
  segments: FaceRefSegment[],
): void {
  if (!p.check('LBRACKET') || p.peek(1).kind !== 'NUMBER') return;
  const start = p.advance().span;
  const raw = p.expect('NUMBER', 'Expected numeric index in reference').value;
  p.expect('RBRACKET');
  segments.push({
    kind: 'index',
    value: Math.trunc(Number(raw)),
    span: p.spanFrom(start),
  });
}

/**
 * Rejects removed call selectors with their modern dot-reference replacement.
 * This keeps old `side(...)`/`corner(...)` syntax from being reintroduced as
 * selector parsing grows more permissive.
 */
export function rejectRemovedReferenceCall(p: Parser, name: string): void {
  if (!isRemovedReferenceSelectorCall(name)) return;
  const replacements: Record<string, string> = {
    side: '@object.front',
    corner: '@object.top.front_left',
    edge: '@object.top.front_edge',
    face: '@object.named_face',
  };
  p.fail(
    `${name}(...) selectors have been removed; use dot references such as ${replacements[name]}`,
    p.peek().span,
  );
}
