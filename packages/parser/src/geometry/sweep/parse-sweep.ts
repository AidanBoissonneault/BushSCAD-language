/** Parses the sweep geometry operation forms. */

import type { SweepCutOp, SweepOp, SweepOrientation } from '@bushscad/ir';
import type { Parser } from '../../core/parser.js';
import { parseThroughDepthFrom } from '../parse-cut.js';
import {
  parsePathInput,
  parseSketchInput,
} from '../../objects/parse-inputs.js';

/** Parses the `<sketch> along <path>` header shared by sweep operations. */
function parseSweepHeader(p: Parser): Pick<SweepOp, 'sketch' | 'path'> {
  const sketch = parseSketchInput(p);
  p.expect('ALONG');
  const path = parsePathInput(p);
  return { sketch, path };
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
