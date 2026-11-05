import type { OcctTraceEvent, SourceSpan } from '@bushscad/ir';

type SourceOperation = {
  kind: string;
  span?: SourceSpan;
};

/** Anchors a whole-part cache marker after the part's complete source extent. */
export function completedPartCacheBreakpoint(
  operations: readonly SourceOperation[],
  partName: string,
  sourceIndex: number,
  timestampMs: number,
): OcctTraceEvent | undefined {
  const span = completedPartSourceSpan(operations);
  if (!span) return undefined;
  return {
    kind: 'cache-breakpoint',
    timestampMs,
    partName,
    opName: partName,
    span,
    sourceIndex,
    cacheBreakpoint: 'automatic',
    message: 'Automatically assigned completed-part cache breakpoint.',
  };
}

/** Uses the complete part statement's end line, which includes imported placements. */
function completedPartSourceSpan(
  operations: readonly SourceOperation[],
): SourceSpan | undefined {
  const boundary = operations.find(
    (operation) => operation.kind === 'part',
  )?.span;
  if (boundary) {
    const line = boundary.endLine ?? boundary.line;
    return {
      ...boundary,
      line,
      col: boundary.endCol ?? boundary.col,
    };
  }
  for (let index = operations.length - 1; index >= 0; index--) {
    const operation = operations[index];
    if (operation && operation.kind !== 'part' && operation.span) {
      return operation.span;
    }
  }
  return undefined;
}
