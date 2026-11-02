/**
 * @author Aidan Boissonneault
 * @file sketchBodyCompletions.ts
 * @purpose Provides sketch body completions behavior for the providers in language server package.
 * @last-edited October 6, 2026
 */

import {
  collectSketchDeclarations,
  type ASTSourceSpan,
  type PathSketchPrimitive,
  type SketchDecl,
  type SketchDeclarationLocation,
  unwrapTransparentSketchPrimitive,
} from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import type { LanguageCompletionItem } from '../protocol/ILanguageServer.js';

/**
 * Returns named body members for the sketch immediately before a member dot.
 * The completion provider must treat `plate.shell` as a
 * sketch body while `@plate.top` remains an object surface reference.
 */
export function sketchBodyCompletionItems(
  source: string,
  textBeforeCursor: string,
): LanguageCompletionItem[] | null {
  const owner = sketchMemberOwner(textBeforeCursor);
  if (!owner) return null;

  const cursor = sourcePosition(textBeforeCursor);
  const declarations = collectSketchDeclarations(
    parse(source, '<completion>').ast,
  );
  const sketch = findPriorSketch(declarations, owner, cursor, cursor);
  if (!sketch) return null;
  const primitive = referencedPathPrimitive(
    declarations,
    sketch,
    cursor,
    new Set(),
  );
  if (!primitive) return [];

  const names = [
    ...primitive.closedBodies.map(({ name }) => name),
    ...primitive.bodyExpressions.map(({ name }) => name),
  ];
  if (names.length === 0) return [];

  return [...new Set(names)].map((label) => ({
    label,
    kind: 'field',
    detail: `Named body of sketch ${owner}`,
  }));
}

/** Identifies a plain sketch member access while excluding spatial `@` refs. */
function sketchMemberOwner(textBeforeCursor: string): string | null {
  const match = /([A-Za-z_][A-Za-z0-9_]*)\.\s*[A-Za-z_]*$/.exec(
    textBeforeCursor,
  );
  if (!match || textBeforeCursor[match.index - 1] === '@') return null;
  return match[1];
}

/** Selects the latest accessible same-named sketch before a source position. */
function findPriorSketch(
  declarations: SketchDeclarationLocation[],
  owner: string,
  cursor: { line: number; col: number },
  before: { line: number; col: number },
): SketchDecl | null {
  const candidates = declarations
    .filter(
      ({ sketch, scopeSpan }) =>
        sketch.name === owner &&
        isBefore(sketch.span, before) &&
        (scopeSpan === null || spanContains(scopeSpan, cursor)),
    )
    .map(({ sketch }) => sketch);
  return candidates.at(-1) ?? null;
}

/** Follows transparent placement/modifier and sketch-reference chains to a path. */
function referencedPathPrimitive(
  declarations: SketchDeclarationLocation[],
  sketch: SketchDecl,
  cursor: { line: number; col: number },
  visited: Set<string>,
): PathSketchPrimitive | null {
  const key = `${sketch.span.file}:${sketch.span.line}:${sketch.span.col}`;
  if (visited.has(key)) return null;
  visited.add(key);

  const primitive = unwrapTransparentSketchPrimitive(sketch.primitive);
  if (primitive.kind === 'pathSketch') return primitive;
  if (primitive.kind !== 'sketchRef') return null;

  const referenced = findPriorSketch(
    declarations,
    primitive.name,
    cursor,
    sketch.span,
  );
  return referenced
    ? referencedPathPrimitive(declarations, referenced, cursor, visited)
    : null;
}

/** Tests declaration ordering using parser one-based source positions. */
function isBefore(
  span: ASTSourceSpan,
  position: { line: number; col: number },
): boolean {
  return (
    span.line < position.line ||
    (span.line === position.line && span.col < position.col)
  );
}

/** Tests whether the completion cursor remains inside a declaration's scope. */
function spanContains(
  span: ASTSourceSpan,
  position: { line: number; col: number },
): boolean {
  const afterStart =
    position.line > span.line ||
    (position.line === span.line && position.col >= span.col);
  const beforeEnd =
    position.line < span.endLine ||
    (position.line === span.endLine && position.col <= span.endCol);
  return afterStart && beforeEnd;
}

/** Converts the completion prefix end into the parser's one-based position. */
function sourcePosition(sourcePrefix: string): { line: number; col: number } {
  const lines = sourcePrefix.split('\n');
  return { line: lines.length, col: (lines.at(-1)?.length ?? 0) + 1 };
}
