/**
 * @author Aidan Boissonneault
 * @file interaction-declarations.ts
 * @purpose Provides interaction declarations behavior for the metadata in evaluator package.
 * @last-edited October 6, 2026
 */

import type { Program, SourceSpan } from '@bushscad/ir';

const DECLARATION_KINDS = new Set([
  'part',
  'sketch',
  'surface',
  'obj',
  'objCall',
  'refObj',
  'refPart',
  'shapeImport',
  'place',
  'sheet',
]);

/**
 * Interaction declaration source, including span, link span, and name.
 */
export type InteractionDeclarationSource = {
  readonly span: SourceSpan;
  readonly linkSpan?: SourceSpan;
  readonly name?: string;
};

/** Collects authored declaration/instance ranges from the resolved AST. */
export function collectInteractionDeclarationSpans(
  program: Program,
): InteractionDeclarationSource[] {
  const declarations: InteractionDeclarationSource[] = [];
  const seen = new Set<object>();
  /**
   * Handles visit in the metadata flow.
   */
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    const node = value as Record<string, unknown>;
    if (
      typeof node.kind === 'string' &&
      DECLARATION_KINDS.has(node.kind) &&
      isSpan(node.span)
    ) {
      declarations.push({
        span: node.span,
        ...(isSpan(node.nameSpan) ? { linkSpan: node.nameSpan } : {}),
        ...(typeof node.name === 'string' ? { name: node.name } : {}),
      });
    }
    for (const child of Object.values(node)) visit(child);
  };
  visit(program);
  return declarations;
}

/** Returns the narrowest authored declaration and causal name for an IR op. */
export function interactionDeclarationSource(
  opSpan: SourceSpan,
  declarations: readonly InteractionDeclarationSource[],
): InteractionDeclarationSource {
  return (
    declarations
      .filter((candidate) => contains(candidate.span, opSpan))
      .sort((left, right) => spanSize(left.span) - spanSize(right.span))[0] ?? {
      span: opSpan,
    }
  );
}

/**
 * Returns whether the input meets the `span` condition.
 */
function isSpan(value: unknown): value is SourceSpan {
  if (!value || typeof value !== 'object') return false;
  const span = value as Partial<SourceSpan>;
  return (
    typeof span.file === 'string' &&
    typeof span.line === 'number' &&
    typeof span.col === 'number'
  );
}

/**
 * Handles contains in the metadata flow.
 */
function contains(outer: SourceSpan, inner: SourceSpan): boolean {
  if (outer.file !== inner.file) return false;
  const outerEnd = [outer.endLine ?? outer.line, outer.endCol ?? outer.col];
  const innerEnd = [inner.endLine ?? inner.line, inner.endCol ?? inner.col];
  return (
    compare([outer.line, outer.col], [inner.line, inner.col]) <= 0 &&
    compare(outerEnd, innerEnd) >= 0
  );
}

/**
 * Compares using the requested criteria.
 */
function compare(left: number[], right: number[]): number {
  return left[0] === right[0]
    ? (left[1] ?? 0) - (right[1] ?? 0)
    : (left[0] ?? 0) - (right[0] ?? 0);
}

/**
 * Handles span size in the metadata flow.
 */
function spanSize(span: SourceSpan): number {
  return (
    ((span.endLine ?? span.line) - span.line) * 100_000 +
    (span.endCol ?? span.col) -
    span.col
  );
}
