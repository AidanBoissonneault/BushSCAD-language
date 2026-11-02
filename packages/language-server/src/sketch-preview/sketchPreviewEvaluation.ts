/**
 * @author Aidan Boissonneault
 * @file sketchPreviewEvaluation.ts
 * @purpose Provides sketch preview evaluation behavior for the sketch preview in language server package.
 * @last-edited October 6, 2026
 */

import type { IRSketch, SketchDecl, SketchPreviewModel } from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import { evaluate } from '@bushscad/evaluator';
import { normalizePath } from '../language/uri.js';
import { buildSketchPreviewModel } from './sketchPreviewDetails.js';
import {
  collectSketchPreviewTargets,
  findSketchPreviewTarget,
} from './sketchPreviewTarget.js';

/**
 * Checks whether the supplied sketch span values are equivalent.
 */
function sameSketchSpan(op: IRSketch, stmt: SketchDecl): boolean {
  return (
    op.span.file === stmt.span.file &&
    op.span.line === stmt.span.line &&
    op.span.col === stmt.span.col &&
    op.span.endLine === stmt.span.endLine &&
    op.span.endCol === stmt.span.endCol
  );
}

/**
 * Finds and evaluates the sketch under the cursor.
 * The preview must match real compiler behavior for path sketches, text
 * sketches, loop-renamed sketches, and parent-context inset dimensions.
 */
export function findEvaluatedSketchPreview(
  source: string,
  filePath: string,
  line: number,
  col: number,
  fileMap: Readonly<Record<string, string>> = {},
): SketchPreviewModel | null {
  const parsed = parse(source, filePath);
  if (parsed.errors.length > 0) return null;

  const target = findSketchPreviewTarget(parsed.ast, line, col);
  if (!target) return null;

  const resolved = resolve(
    parsed.ast,
    filePath,
    (path) => fileMap[normalizePath(path)] ?? null,
    () => null,
  );
  if (resolved.errors.length > 0) return null;

  const evaluated = evaluate(resolved.ast);
  if (evaluated.errors.length > 0) return null;

  const matches = evaluated.program.ops.filter(
    (op): op is IRSketch => op.kind === 'sketch' && sameSketchSpan(op, target),
  );
  const first = matches[0];
  return first
    ? buildSketchPreviewModel(
        target,
        first.primitive,
        matches.length,
        [],
        source,
      )
    : null;
}

/**
 * Evaluates all previewable sketches in a document for the sketch tab strip.
 */
export function findEvaluatedSketchPreviews(
  source: string,
  filePath: string,
  fileMap: Readonly<Record<string, string>> = {},
): SketchPreviewModel[] {
  const parsed = parse(source, filePath);
  if (parsed.errors.length > 0) return [];

  const targets = collectSketchPreviewTargets(parsed.ast);
  if (targets.length === 0) return [];

  const resolved = resolve(
    parsed.ast,
    filePath,
    (path) => fileMap[normalizePath(path)] ?? null,
    () => null,
  );
  if (resolved.errors.length > 0) return [];

  const evaluated = evaluate(resolved.ast);
  if (evaluated.errors.length > 0) return [];

  const sketches = evaluated.program.ops.filter(
    (op): op is IRSketch => op.kind === 'sketch',
  );

  return targets.flatMap((target) => {
    const matches = sketches.filter((op) => sameSketchSpan(op, target.sketch));
    const first = matches[0];
    return first
      ? [
          buildSketchPreviewModel(
            target.sketch,
            first.primitive,
            matches.length,
            target.componentPath,
            source,
          ),
        ]
      : [];
  });
}
