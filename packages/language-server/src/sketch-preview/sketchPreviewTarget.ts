/**
 * @author Aidan Boissonneault
 * @file sketchPreviewTarget.ts
 * @purpose Provides sketch preview target behavior for the sketch preview in language server package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan, Program, SketchDecl } from '@bushscad/ir';
import {
  collectSketchDeclarations,
  type SketchDeclarationLocation,
} from '@bushscad/ir';

/**
 * Type used for target for sketch preview.
 */
type SketchPreviewTarget = SketchDeclarationLocation;

/**
 * Handles contains position in the sketch preview flow.
 */
function containsPosition(
  span: ASTSourceSpan,
  line: number,
  col: number,
): boolean {
  if (line < span.line || line > span.endLine) return false;
  if (line === span.line && col < span.col) return false;
  if (line === span.endLine && col > span.endCol) return false;
  return true;
}

/**
 * Finds the sketch declaration under the editor cursor.
 * The preview is keyed by source span, while evaluation may rename sketches in
 * loops and placed components. Cursor discovery must therefore stay AST-based.
 */
export function findSketchPreviewTarget(
  program: Program,
  line: number,
  col: number,
): SketchDecl | null {
  return (
    collectSketchDeclarations(program).find(({ sketch }) =>
      containsPosition(sketch.span, line, col),
    )?.sketch ?? null
  );
}

/**
 * Collects sketch declarations in source order for tab population.
 * The sketch panel opens one tab for each previewable sketch in the current
 * document, while cursor selection still uses findSketchPreviewTarget.
 */
export function collectSketchPreviewTargets(
  program: Program,
): SketchPreviewTarget[] {
  return collectSketchDeclarations(program);
}
