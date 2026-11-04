/**
 * @author Aidan Boissonneault
 * @file parse-revolve-loft-sweep.ts
 * @purpose Parses revolve loft sweep for the geometry in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  Expr,
  LoftOp,
  RevolveOp,
  SweepCutOp,
  SweepOp,
  SweepOrientation,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parseAxisRef } from '../references/parse-axis-ref.js';
import { parseThroughDepthFrom } from './parse-cut.js';
import { parsePathInput, parseSketchInput } from '../objects/parse-inputs.js';

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

/** Parses the `<sketch> along <path>` header shared by sweep operations. */
function parseSweepHeader(p: Parser): Pick<SweepOp, 'sketch' | 'path'> {
  const sketch = parseSketchInput(p);
  p.expect('ALONG');
  const path = parsePathInput(p);
  return { sketch, path };
}

/**
 * Parses a revolve object operation.
 * Revolve has its own axis grammar and optional named arguments, but it is
 * still a standard solid-producing object operation.
 */
export function parseRevolveOp(p: Parser): RevolveOp {
  const start = p.peek().span;
  p.advance(); // REVOLVE
  p.expect('LPAREN');
  const sketch = parseSketchInput(p);
  p.expect('COMMA');
  const angle = p.parseExpr();
  p.expect('AROUND');
  const around = parseAxisRef(p);
  let radius: Expr | undefined;
  while (p.eat('COMMA')) {
    if (p.check('RPAREN', 'EOF')) break;
    const named = p.parseNamedExprArg();
    const value = named?.[1] ?? p.parseExpr();
    const argName = named?.[0] ?? 'radius';
    if (argName === 'radius') {
      if (radius)
        p.addError("revolve() got duplicate argument 'radius'", value.span);
      else radius = value;
    } else {
      p.addError(`Unknown revolve argument '${argName}'`, value.span);
    }
  }
  p.expect('RPAREN');
  return {
    kind: 'revolve',
    sketch,
    angle,
    around,
    radius,
    span: p.spanFrom(start),
  };
}

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

/**
 * Parses sweep orientation from the supplied source into the geometry representation.
 */
function parseSweepOrientation(p: Parser): SweepOrientation {
  const tok = p.advance();
  if (
    tok.value === 'fixed' ||
    tok.value === 'binormal' ||
    tok.value === 'default'
  ) {
    return tok.value;
  }
  p.addError(
    `Unknown sweep orientation '${tok.value}' - expected default, fixed, or binormal`,
    tok.span,
  );
  return 'default';
}

/** Parses one `orientation: ...` named argument, returning the resolved value. */
function parseSweepOrientationArg(
  p: Parser,
  current: SweepOrientation,
  alreadyProvided: boolean,
): { orientation: SweepOrientation; provided: boolean } {
  const argToken = p.advance();
  const argName = argToken.value;
  p.advance(); // COLON
  if (argName === 'orientation') {
    const orientation = parseSweepOrientation(p);
    if (alreadyProvided) {
      p.addError("sweep() got duplicate argument 'orientation'", argToken.span);
      return { orientation: current, provided: true };
    }
    return { orientation, provided: true };
  }
  p.addError(`Unknown sweep argument '${argName}'`, argToken.span);
  p.parseExpr();
  return { orientation: current, provided: alreadyProvided };
}

/** Parses the optional orientation slot shared by sweep and sweep-cut calls. */
function parseSweepOrientations(
  p: Parser,
  stopBeforeCutExtent = false,
): SweepOrientation {
  let orientation: SweepOrientation = 'default';
  let orientationProvided = false;
  while (p.check('COMMA') && !isSweepCutExtentStart(p, stopBeforeCutExtent)) {
    p.advance();
    if (p.check('RPAREN', 'EOF')) break;
    if (
      (p.peek().kind === 'IDENT' || p.peek().kind === 'AROUND') &&
      p.peek(1).kind === 'COLON'
    ) {
      const parsed = parseSweepOrientationArg(
        p,
        orientation,
        orientationProvided,
      );
      orientation = parsed.orientation;
      orientationProvided = parsed.provided;
      continue;
    }
    const orientationSpan = p.peek().span;
    const parsed = parseSweepOrientation(p);
    if (orientationProvided) {
      p.addError(
        "sweep() got duplicate argument 'orientation'",
        orientationSpan,
      );
    } else {
      orientation = parsed;
    }
    orientationProvided = true;
  }
  return orientation;
}

/** Leaves the outer cut extent comma for its owning parser. */
function isSweepCutExtentStart(p: Parser, enabled: boolean): boolean {
  if (!enabled) return false;
  return (
    p.peek(1).kind === 'THROUGH' ||
    (p.peek(1).kind === 'IDENT' && p.peek(1).value === 'depth')
  );
}

/**
 * Parses a sweep object operation.
 * Sweep uses the custom `<sketch> along <path>` header and optional
 * orientation argument shared with historical sweep cuts.
 */
export function parseSweepOp(p: Parser): SweepOp {
  const start = p.peek().span;
  p.advance(); // SWEEP
  p.expect('LPAREN');
  const { sketch, path } = parseSweepHeader(p);
  const orientation = parseSweepOrientations(p);
  p.expect('RPAREN');
  return { kind: 'sweep', sketch, path, orientation, span: p.spanFrom(start) };
}

/**
 * Parses the legacy `cut(sweep(...), through/from ...)` operation.
 * Historical sweep-cut syntax still needs to lower to its own AST node while
 * sharing the sweep header and depth parsing behavior.
 */
export function parseSweepCutOp(p: Parser): SweepCutOp {
  const start = p.peek().span;
  p.advance(); // CUT
  p.expect('LPAREN');
  p.advance(); // SWEEP
  p.expect('LPAREN');
  const { sketch, path } = parseSweepHeader(p);
  const orientation = parseSweepOrientations(p, true);
  p.expect('RPAREN'); // close sweep(...)

  p.expect('COMMA');

  const { through, depth, from } = parseThroughDepthFrom(p, true);

  p.expect('RPAREN'); // close cut(...)
  return {
    kind: 'sweep_cut',
    sketch,
    path,
    through,
    depth,
    from,
    orientation,
    span: p.spanFrom(start),
  };
}

export type { ASTSourceSpan };
