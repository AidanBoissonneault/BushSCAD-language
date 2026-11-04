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
  visitInteractionValue(program, declarations, seen);
  return declarations;
}

/**
 * Recursively collects authored declarations while avoiding AST cycles.
 *
 * Why:
 * Resolved programs may share objects, so a visited set keeps provenance
 * collection stable and prevents repeated traversal.
 */
function visitInteractionValue(
  value: unknown,
  declarations: InteractionDeclarationSource[],
  seen: Set<object>,
): void {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  const node = value as Record<string, unknown>;
  appendInteractionDeclaration(node, declarations);
  for (const child of Object.values(node)) {
    visitInteractionValue(child, declarations, seen);
  }
}

/** Adds declaration metadata when the current AST object is an authored node. */
function appendInteractionDeclaration(
  node: Record<string, unknown>,
  declarations: InteractionDeclarationSource[],
): void {
  if (typeof node.kind !== 'string' || !DECLARATION_KINDS.has(node.kind))
    return;
  if (!isSpan(node.span)) return;
  declarations.push({
    span: node.span,
    ...(isSpan(node.nameSpan) ? { linkSpan: node.nameSpan } : {}),
    ...(typeof node.name === 'string' ? { name: node.name } : {}),
  });
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
