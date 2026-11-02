/**
 * @author Aidan Boissonneault
 * @file sketchSourceRange.ts
 * @purpose Provides sketch source range behavior for the sketch preview in language server package.
 * @last-edited October 6, 2026
 */

import { parse } from '@bushscad/parser';
import { collectSketchDeclarations } from '@bushscad/ir';
import type { ASTSourceSpan, SketchDecl } from '@bushscad/ir';

/**
 * Editable sketch source range, including name, start line, start col, end line, and end col.
 */
export type EditableSketchSourceRange = {
  name: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
};

/**
 * Finds the source range for a sketch that can be replaced by generated code.
 *
 * The visual sketch editor should update the active sketch declaration when the
 * cursor is inside one, while still allowing insertion for new sketches.
 */
export function findEditableSketchSourceRange(
  source: string,
  filePath: string,
  line: number,
  col: number,
  sketchName?: string,
): EditableSketchSourceRange | null {
  const parsed = parse(source, filePath);
  if (parsed.errors.length > 0) return null;
  const sketches = collectSketchDeclarations(parsed.ast).map(
    ({ sketch }) => sketch,
  );
  const sketch = editableSketch(sketches, line, col, sketchName);
  return sketch ? sourceRangeForSketch(sketch) : null;
}

/**
 * Handles editable sketch in the sketch preview flow.
 */
function editableSketch(
  sketches: SketchDecl[],
  line: number,
  col: number,
  sketchName?: string,
): SketchDecl | null {
  return (
    sketches.find((candidate) => spanContains(candidate.span, line, col)) ??
    namedSketch(sketches, sketchName) ??
    null
  );
}

/**
 * Handles named sketch in the sketch preview flow.
 */
function namedSketch(
  sketches: SketchDecl[],
  sketchName?: string,
): SketchDecl | null {
  return sketchName
    ? (sketches.find((sketch) => sketch.name === sketchName) ?? null)
    : null;
}

/**
 * Returns the source data required by the current operation.
 */
function sourceRangeForSketch(
  sketch: SketchDecl,
): EditableSketchSourceRange | null {
  if (!sketch.span.endLine || !sketch.span.endCol) return null;
  return {
    name: sketch.name,
    startLine: sketch.span.line,
    startCol: sketch.span.col,
    endLine: sketch.span.endLine,
    endCol: sketch.span.endCol,
  };
}

/**
 * Derives `CompleteSpan` from `ASTSourceSpan & { endLine: number; endCol: number }` to preserve its
 * type relationship in the sketch preview layer.
 */
type CompleteSpan = ASTSourceSpan & { endLine: number; endCol: number };

/**
 * Handles span contains in the sketch preview flow.
 */
function spanContains(span: ASTSourceSpan, line: number, col: number): boolean {
  const complete = completeSpan(span);
  return (
    complete !== null &&
    isAfterSpanStart(complete, line, col) &&
    isBeforeSpanEnd(complete, line, col)
  );
}

/**
 * Handles complete span in the sketch preview flow.
 */
function completeSpan(span: ASTSourceSpan): CompleteSpan | null {
  return span.endLine && span.endCol ? (span as CompleteSpan) : null;
}

/**
 * Returns whether the input meets the `after span start` condition.
 */
function isAfterSpanStart(
  span: CompleteSpan,
  line: number,
  col: number,
): boolean {
  return line > span.line || (line === span.line && col >= span.col);
}

/**
 * Returns whether the input meets the `before span end` condition.
 */
function isBeforeSpanEnd(
  span: CompleteSpan,
  line: number,
  col: number,
): boolean {
  return line < span.endLine || (line === span.endLine && col <= span.endCol);
}
