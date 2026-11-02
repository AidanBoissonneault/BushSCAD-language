/**
 * @author Aidan Boissonneault
 * @file sketchSourceText.ts
 * @purpose Provides sketch source text behavior for the sketch preview in language server package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  Expr,
  SketchPreviewSourcePoint,
  SketchPreviewSourceRange,
  SketchPreviewSourceText,
} from '@bushscad/ir';

/** Converts a compiler span to the editor-facing replacement range shape. */
export function previewRangeForSpan(
  span: ASTSourceSpan,
): SketchPreviewSourceRange {
  return {
    startLine: span.line,
    startCol: span.col,
    endLine: span.endLine,
    endCol: span.endCol,
  };
}

/** Extracts verbatim text for a one-based, end-exclusive parser span. */
export function sourceForSpan(source: string, span: ASTSourceSpan): string {
  const starts = lineStartOffsets(source);
  const start = (starts[span.line - 1] ?? source.length) + span.col - 1;
  const end = (starts[span.endLine - 1] ?? source.length) + span.endCol - 1;
  return source.slice(start, end);
}

/** Retains raw source and its precise range for a parsed expression or node. */
export function sourceTextForSpan(
  source: string,
  span: ASTSourceSpan,
): SketchPreviewSourceText {
  return {
    text: sourceForSpan(source, span),
    range: previewRangeForSpan(span),
  };
}

/** Extracts an expression exactly as authored, including grouping and line endings. */
export function sourceTextForExpression(
  source: string,
  expression: Expr,
): SketchPreviewSourceText {
  return sourceTextForSpan(source, expression.span);
}

/** Builds the raw x/y expression pair shared by endpoints and labels. */
export function sourcePoint(
  source: string,
  point: [Expr, Expr],
): SketchPreviewSourcePoint {
  return {
    x: sourceTextForExpression(source, point[0]),
    y: sourceTextForExpression(source, point[1]),
  };
}

/**
 * Creates line geometry from the supplied endpoints.
 */
function lineStartOffsets(source: string): number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') starts.push(index + 1);
  }
  return starts;
}
