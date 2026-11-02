/**
 * @author Aidan Boissonneault
 * @file model-navigation-target.ts
 * @purpose Provides model navigation target behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import {
  sameInteractionSpan,
  type InteractionEntity,
  type InteractionEntityKind,
  type InteractionSnapshot,
  type SourceSpan,
} from '@bushscad/ir';
import type { ModelHit } from './model-hit-testing.js';

/**
 * Editor document and cursor coordinates for the source attached to a model item.
 */
export type EditorSourceContext = {
  readonly file: string | null;
  readonly line: number;
  readonly col: number;
};

/**
 * Source-span and entity identifiers used to navigate from a model pick back to its code.
 */
export type ModelNavigationTarget = {
  readonly entityId: string | null;
  readonly topologyId: string;
  readonly name: string;
  readonly kind: InteractionEntityKind | 'generated';
  readonly sourceSpan: SourceSpan | null;
  readonly navigable: boolean;
  readonly generatedIndex?: number;
  readonly instanceCount?: number;
  readonly status?: string;
};

const OBJECT_KINDS: readonly InteractionEntityKind[] = [
  'object',
  'generated-instance',
  'surface',
  'imported',
  'sketch',
];

/** Chooses a part or its most specific object using the current editor context. */
export function resolveModelNavigationTarget(
  snapshot: InteractionSnapshot,
  hit: ModelHit,
  editor: EditorSourceContext,
): ModelNavigationTarget {
  const sketchTarget = sketchInstanceTarget(snapshot, hit);
  if (sketchTarget) return sketchTarget;
  const entities = new Map(
    snapshot.entities.map((entity) => [entity.id, entity]),
  );
  const part = entities.get(hit.partEntityId);
  const insidePart = Boolean(
    part && sourcePositionInSpan(editor, part.declarationSpan),
  );
  const object = firstObjectEntity(
    [hit.objectEntityId, hit.ownerEntityId, ...hit.semanticTargetIds],
    entities,
  );
  const chosen = insidePart ? (object ?? part) : (part ?? object);
  return chosen
    ? entityTarget(snapshot, hit.topologyId, chosen)
    : generatedTarget(hit);
}

/** Formats the concise entity label shown by viewport hover UI. */
export function modelTargetLabel(target: ModelNavigationTarget): string {
  if (
    target.instanceCount !== undefined &&
    target.generatedIndex !== undefined
  ) {
    return `${target.name} [${target.generatedIndex} of ${target.instanceCount}]`;
  }
  if (target.generatedIndex === undefined) return target.name;
  return `${target.name} [${target.generatedIndex}]`;
}

/**
 * Handles sketch instance target in the scene flow.
 */
function sketchInstanceTarget(
  snapshot: InteractionSnapshot,
  hit: ModelHit,
): ModelNavigationTarget | null {
  if (!hit.sketchInstanceId) return null;
  const instances = snapshot.sketchInstances ?? [];
  const instance = instances.find(
    (candidate) => candidate.id === hit.sketchInstanceId,
  );
  const definition = (snapshot.sketchDefinitions ?? []).find(
    (candidate) => candidate.id === instance?.definitionId,
  );
  if (!instance || !definition) return null;
  const siblings = instances.filter(
    (candidate) => candidate.definitionId === definition.id,
  );
  const sourceSpan = navigableSpan(instance.sourceSpan);
  return {
    entityId: definition.entityIds[0] ?? definition.id,
    topologyId: instance.id,
    name: definition.name,
    kind: 'sketch',
    sourceSpan,
    navigable: sourceSpan !== null,
    generatedIndex:
      siblings.findIndex((candidate) => candidate.id === instance.id) + 1,
    instanceCount: siblings.length,
    ...(hit.unsupportedReason ? { status: hit.unsupportedReason } : {}),
  };
}

/**
 * Returns the first object entity that matches the requested condition.
 */
function firstObjectEntity(
  ids: readonly (string | undefined)[],
  entities: ReadonlyMap<string, InteractionEntity>,
): InteractionEntity | undefined {
  for (const id of ids) {
    const entity = id ? entities.get(id) : undefined;
    if (entity && OBJECT_KINDS.includes(entity.kind)) return entity;
  }
  return undefined;
}

/**
 * Handles entity target in the scene flow.
 */
function entityTarget(
  snapshot: InteractionSnapshot,
  topologyId: string,
  entity: InteractionEntity,
): ModelNavigationTarget {
  const sourceSpan = navigableSpan(entity.declarationSpan);
  const generatedIndex =
    entity.kind === 'generated-instance'
      ? generatedEntityIndex(snapshot, entity)
      : undefined;
  return {
    entityId: entity.id,
    topologyId,
    name: entity.name,
    kind: entity.kind,
    sourceSpan,
    navigable: sourceSpan !== null,
    ...(generatedIndex !== undefined ? { generatedIndex } : {}),
  };
}

/**
 * Handles generated target in the scene flow.
 */
function generatedTarget(hit: ModelHit): ModelNavigationTarget {
  return {
    entityId: null,
    topologyId: hit.topologyId,
    name: 'Generated geometry',
    kind: 'generated',
    sourceSpan: null,
    navigable: false,
  };
}

/**
 * Handles navigable span in the scene flow.
 */
function navigableSpan(span: SourceSpan): SourceSpan | null {
  return span.file && !span.file.startsWith('(') ? span : null;
}

/**
 * Returns the source data required by the current operation.
 */
function sourcePositionInSpan(
  position: EditorSourceContext,
  span: SourceSpan,
): boolean {
  if (!position.file || !sameSourceFile(position.file, span.file)) return false;
  const endLine = span.endLine ?? span.line;
  const endCol = span.endCol ?? span.col;
  return (
    comparePosition(position.line, position.col, span.line, span.col) >= 0 &&
    comparePosition(position.line, position.col, endLine, endCol) <= 0
  );
}

/**
 * Checks whether the supplied source file values are equivalent.
 */
function sameSourceFile(left: string, right: string): boolean {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.endsWith(`/${normalizedRight}`) ||
    normalizedRight.endsWith(`/${normalizedLeft}`)
  );
}

/**
 * Normalizes path into the canonical form.
 */
function normalizePath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return /^[A-Za-z]:/.test(normalized)
    ? normalized.toLocaleLowerCase()
    : normalized;
}

/**
 * Compares position using the requested criteria.
 */
function comparePosition(
  leftLine: number,
  leftCol: number,
  rightLine: number,
  rightCol: number,
): number {
  return leftLine === rightLine ? leftCol - rightCol : leftLine - rightLine;
}

/**
 * Handles generated entity index in the scene flow.
 */
function generatedEntityIndex(
  snapshot: InteractionSnapshot,
  entity: InteractionEntity,
): number {
  const siblings = snapshot.entities.filter(
    (candidate) =>
      candidate.kind === 'generated-instance' &&
      sameInteractionSpan(candidate.declarationSpan, entity.declarationSpan),
  );
  return Math.max(
    1,
    siblings.findIndex((candidate) => candidate.id === entity.id) + 1,
  );
}
