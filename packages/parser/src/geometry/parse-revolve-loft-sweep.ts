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
    const isNamedArg =
      (p.peek().kind === 'IDENT' || p.peek().kind === 'RADIUS') &&
      p.peek(1).kind === 'COLON';
    if (isNamedArg) {
      const argName = p.advance().value;
      p.advance(); // COLON
      if (argName === 'radius') {
        radius = p.parseExpr();
      } else {
        p.addError(`Unknown revolve argument '${argName}'`, p.peek().span);
        p.parseExpr();
      }
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
    state.height = p.parseExpr();
    return;
  }
  if (argName === 'guide') {
    state.guide = parseSketchInput(p);
    if (p.eat('IN')) {
      const wpTok = p.advance();
      const v = wpTok.value;
      if (v === 'XY' || v === 'XZ' || v === 'YZ') {
        state.guideWorkplane = v;
      } else {
        p.addError(
          `Unknown workplane '${v}' - expected XY, XZ, or YZ`,
          wpTok.span,
        );
      }
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
  } = {
    height: null,
    guide: null,
    guideWorkplane: undefined,
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
    } else if (
      p.check('IDENT') ||
      p.check('RECT', 'CIRCLE', 'ROUNDRECT', 'TRIANGLE', 'POLYGON', 'WORD') ||
      p.check('LBRACE', 'LPAREN', 'LBRACKET')
    ) {
      sketches.push(parseSketchInput(p));
    } else {
      p.addError(
        `Expected loft profile or named argument, got ${p.peek().kind}`,
        p.peek().span,
      );
      p.advance();
    }
    p.eat('COMMA');
  }

  if (!stoppedAtBoundary) p.expect('RPAREN');
  if (!state.height) {
    p.addError('loft requires height: argument', p.spanFrom(start));
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
): SweepOrientation {
  const argName = p.advance().value;
  p.advance(); // COLON
  if (argName === 'orientation') {
    return parseSweepOrientation(p);
  }
  p.addError(`Unknown sweep argument '${argName}'`, p.peek().span);
  p.parseExpr();
  return current;
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
  let orientation: SweepOrientation = 'default';
  while (p.eat('COMMA')) {
    if (
      (p.peek().kind === 'IDENT' || p.peek().kind === 'AROUND') &&
      p.peek(1).kind === 'COLON'
    ) {
      orientation = parseSweepOrientationArg(p, orientation);
    }
  }
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
  let orientation: SweepOrientation = 'default';
  while (
    p.check('COMMA') &&
    p.peek(1).kind !== 'THROUGH' &&
    !(p.peek(1).kind === 'IDENT' && p.peek(1).value === 'depth')
  ) {
    p.eat('COMMA');
    if (p.peek().kind === 'IDENT' && p.peek(1).kind === 'COLON') {
      orientation = parseSweepOrientationArg(p, orientation);
    }
  }
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
