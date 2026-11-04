/** Parses the loft geometry operation forms. */

import type { Expr, LoftOp } from '@bushscad/ir';
import type { Parser } from '../../core/parser.js';
import { parseSketchInput } from '../../objects/parse-inputs.js';

const LOFT_RECOVERY_BOUNDARIES = new Set<string>([
  'VAR',
  'ENV',
  'SKETCH',
  'SURFACE',
  'OBJ',
  'REF',
  'PART',
  'FN',
  'FOR',
  'IF',
  'IMPORT',
  'EXPORT',
  'RETURN',
  'FILLET',
  'CHAMFER',
  'SHELL',
  'DRAFT',
  'THREAD',
  'ANCHOR',
  'PLANE',
  'ROTATE',
  'COLOR',
  'MATERIAL',
  'PLACE',
  'DRAWING',
  'ASSERT',
  'FIT',
  'PATH',
  'SWEEP',
  'PATTERN',
  'MIRROR',
  'TRANSFORM',
  'RBRACE',
  'SEMICOLON',
]);

/**
 * Returns whether the input meets the `loft named arg start` condition.
 */
function isLoftNamedArgStart(p: Parser): boolean {
  return (
    (p.peek().kind === 'IDENT' || p.peek().kind === 'GUIDE') &&
    p.peek(1).kind === 'COLON'
  );
}

/**
 * Returns whether the input meets the `loft recovery boundary` condition.
 */
function isLoftRecoveryBoundary(p: Parser): boolean {
  if (LOFT_RECOVERY_BOUNDARIES.has(p.peek().kind)) return true;
  return p.peek().kind === 'IDENT' && p.peek(1).kind === 'ASSIGN';
}

/**
 * Parses loft named arg from the supplied source into the geometry representation.
 */
function parseLoftNamedArg(
  p: Parser,
  state: {
    height: Expr | null;
    guide: LoftOp['guide'];
    guideWorkplane: LoftOp['guideWorkplane'];
  },
): void {
  const argName = p.advance().value;
  p.advance(); // COLON
  if (argName === 'height') {
    const value = p.parseExpr();
    if (state.height !== null) {
      p.addError("loft() got duplicate argument 'height'", value.span);
    } else {
      state.height = value;
    }
    return;
  }
  if (argName === 'guide') {
    const guide = parseSketchInput(p);
    if (state.guide !== null) {
      p.addError("loft() got duplicate argument 'guide'", guide.span);
      if (p.eat('IN'))
        parseLoftGuideWorkplane(p, { guideWorkplane: undefined });
    } else {
      state.guide = guide;
      if (p.eat('IN')) parseLoftGuideWorkplane(p, state);
    }
    return;
  }
  p.addError(`Unknown loft argument '${argName}'`, p.peek().span);
  p.parseExpr();
}

/**
 * Parses a loft operation with recovery for incomplete editor input.
 * While typing `loft(`, the next token may be the following statement rather
 * than EOF. Boundary-aware recovery prevents the parser from repeatedly seeing
 * the same keyword token and freezing the editor.
 */
export function parseLoftOp(p: Parser): LoftOp {
  const start = p.peek().span;
  p.advance(); // LOFT
  p.expect('LPAREN');
  const sketches: LoftOp['sketches'] = [];
  const state: {
    height: Expr | null;
    guide: LoftOp['guide'];
    guideWorkplane: LoftOp['guideWorkplane'];
    profileCount: number;
    positionalProfileCount: number;
    profileListProvided: boolean;
  } = {
    height: null,
    guide: null,
    guideWorkplane: undefined,
    profileCount: 0,
    positionalProfileCount: 0,
    profileListProvided: false,
  };
  let stoppedAtBoundary = false;

  while (!p.check('RPAREN', 'EOF')) {
    if (isLoftRecoveryBoundary(p)) {
      p.addError('Unclosed loft(...) before next statement', p.spanFrom(start));
      stoppedAtBoundary = true;
      break;
    }
    if (isLoftNamedArgStart(p)) {
      parseLoftNamedArg(p, state);
    } else if (canParseLoftProfile(p, state)) {
      const input = parseSketchInput(p);
      sketches.push(input);
      state.profileCount += sketchInputCount(input);
      state.positionalProfileCount += 1;
      state.profileListProvided ||=
        input.kind === 'sketchList' || input.kind === 'sketchBodyList';
    } else if (state.height === null) {
      state.height = p.parseExpr();
    } else if (state.guide === null) {
      parseLoftGuide(p, state);
    } else {
      p.addError(
        `Unexpected extra loft argument '${p.peek().value}'`,
        p.peek().span,
      );
      p.parseExpr();
    }
    p.eat('COMMA');
  }

  if (!stoppedAtBoundary) p.expect('RPAREN');
  if (state.profileCount < 2) {
    p.addError('loft requires at least two profiles', p.spanFrom(start));
  }
  if (!state.height) {
    p.addError('loft requires a height value', p.spanFrom(start));
    state.height = { kind: 'number', value: 0, span: start };
  }
  return {
    kind: 'loft',
    sketches,
    height: state.height,
    guide: state.guide,
    guideWorkplane: state.guideWorkplane,
    span: p.spanFrom(start),
  };
}

/** Accepts one positional profile until the height slot follows two profiles. */
function canParseLoftProfile(
  p: Parser,
  state: {
    height: Expr | null;
    profileCount: number;
    positionalProfileCount: number;
    profileListProvided: boolean;
  },
): boolean {
  if (state.height !== null) return false;
  if (state.profileListProvided) return loftHasNamedHeightAhead(p);
  if (state.profileCount === 0 || state.positionalProfileCount < 2) {
    return (
      p.check('IDENT') ||
      p.check('RECT', 'CIRCLE', 'ROUNDRECT', 'TRIANGLE', 'POLYGON', 'WORD') ||
      p.check('LBRACE', 'LPAREN', 'LBRACKET')
    );
  }
  return loftHasNamedHeightAhead(p);
}

/** Preserves extra positional profiles when a later labeled height disambiguates them. */
function loftHasNamedHeightAhead(p: Parser): boolean {
  let depth = 0;
  for (let offset = 0; ; offset++) {
    const token = p.peek(offset);
    if (isEndOfLoftArguments(token, depth)) return false;
    if (depth === 0 && isNamedLoftHeight(p, offset)) return true;
    depth = nextLoftScanDepth(depth, token);
  }
}

/** Detects the optional height label while scanning at loft call depth. */
function isNamedLoftHeight(p: Parser, offset: number): boolean {
  return (
    p.peek(offset).value === 'height' && p.peek(offset + 1).kind === 'COLON'
  );
}

/** Returns whether the ahead scan has reached the end of the loft call. */
function isEndOfLoftArguments(
  token: ReturnType<Parser['peek']>,
  depth: number,
): boolean {
  return token.kind === 'EOF' || (token.kind === 'RPAREN' && depth === 0);
}

/** Updates nested expression depth while looking for a later named height. */
function nextLoftScanDepth(
  depth: number,
  token: ReturnType<Parser['peek']>,
): number {
  if (token.kind === 'LPAREN' || token.kind === 'LBRACKET') return depth + 1;
  if (token.kind === 'RPAREN' || token.kind === 'RBRACKET') return depth - 1;
  return depth;
}

/** Counts the profiles represented by a named list input. */
function sketchInputCount(input: LoftOp['sketches'][number]): number {
  if (input.kind === 'sketchList') return input.items.length;
  if (input.kind === 'sketchBodyList') return input.bodyNames.length;
  return 1;
}

/** Parses a positional guide input and its optional workplane. */
function parseLoftGuide(
  p: Parser,
  state: {
    guide: LoftOp['guide'];
    guideWorkplane: LoftOp['guideWorkplane'];
  },
): void {
  state.guide = parseSketchInput(p);
  if (p.eat('IN')) parseLoftGuideWorkplane(p, state);
}

/** Parses the workplane suffix shared by named and positional loft guides. */
function parseLoftGuideWorkplane(
  p: Parser,
  state: { guideWorkplane: LoftOp['guideWorkplane'] },
): void {
  const wpTok = p.advance();
  const workplane = wpTok.value;
  if (workplane === 'XY' || workplane === 'XZ' || workplane === 'YZ') {
    state.guideWorkplane = workplane;
  } else {
    p.addError(
      `Unknown workplane '${workplane}' - expected XY, XZ, or YZ`,
      wpTok.span,
    );
  }
}
