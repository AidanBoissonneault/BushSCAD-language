/**
 * @author Aidan Boissonneault
 * @file eval-interaction-provenance.ts
 * @purpose Evaluates interaction provenance for the metadata in evaluator package.
 * @last-edited October 6, 2026
 */

import {
  interactionId,
  interactionSpanKey,
  type InteractionEffect,
  type InteractionEntityKind,
  type InteractionReference,
  type InteractionSnapshot,
  type IRPlacement,
  type IROp,
  type Program,
  type SourceSpan,
} from '@bushscad/ir';
import {
  interactionInputNames,
  interactionOutputNames,
  interactionSelectionUsages,
  interactionSelections,
} from './interaction-op-semantics.js';
import {
  collectInteractionDeclarationSpans,
  interactionDeclarationSource,
} from './interaction-declarations.js';
import {
  ensureInteractionEntity,
  interactionEntityIds,
  lookupInteractionEntity,
  markGeneratedInteractionInstances,
  uniqueInteractionEntities,
  type MutableInteractionEntity,
} from './interaction-entities.js';
import { buildInteractionSketchInstances } from './interaction-sketch-instances.js';
import { buildInteractionInvocations } from './interaction-invocations.js';
import type { InteractionInvocationTrace } from '../core/eval-types.js';

/** Builds deterministic semantic provenance after evaluator unrolling. */
export function buildInteractionProvenance(
  entrypoint: string,
  ops: readonly IROp[],
  ast?: Program,
  invocationTraces: readonly InteractionInvocationTrace[] = [],
): InteractionSnapshot {
  const entities: MutableInteractionEntity[] = [];
  const entityByName = new Map<string, MutableInteractionEntity>();
  const effects: InteractionEffect[] = [];
  const references: InteractionReference[] = [];
  let currentPart: MutableInteractionEntity | undefined;
  const declarationSpans = ast ? collectInteractionDeclarationSpans(ast) : [];

  for (const op of ops) {
    if (op.kind === 'part') {
      currentPart = ensureInteractionEntity(
        entities,
        entityByName,
        entrypoint,
        op.name,
        'part',
        interactionDeclarationSource(op.span, declarationSpans),
      );
      continue;
    }
    if (!currentPart && interactionOutputNames(op).length > 0) {
      currentPart = ensureInteractionEntity(
        entities,
        entityByName,
        entrypoint,
        '__default__',
        'part',
        interactionDeclarationSource(op.span, declarationSpans),
      );
    }
    // Resolve dependencies before a same-named output (for example
    // `sketch hole` then `obj hole = cut(...)`) replaces the scoped name.
    const namedInputs = interactionInputNames(op)
      .map((name) =>
        lookupInteractionEntity(entityByName, name, currentPart?.id),
      )
      .filter(
        (entity): entity is MutableInteractionEntity => entity !== undefined,
      );
    const outputs = interactionOutputNames(op).map((name) =>
      ensureInteractionEntity(
        entities,
        entityByName,
        entrypoint,
        name,
        entityKind(op),
        interactionDeclarationSource(op.span, declarationSpans),
        currentPart?.id,
      ),
    );
    const selectionInputs = interactionSelections(op)
      .map((selection) =>
        lookupInteractionEntity(
          entityByName,
          selection.ownerEntity,
          currentPart?.id,
        ),
      )
      .filter(
        (entity): entity is MutableInteractionEntity => entity !== undefined,
      );
    const inputs = uniqueInteractionEntities([
      ...namedInputs,
      ...selectionInputs,
    ]);
    const effectPath = [...inputs, ...outputs]
      .map((entity) => entity.name)
      .join(',');
    const effectId = interactionId(
      'effect',
      entrypoint,
      op.span,
      op.kind,
      effectPath,
    );
    const affected = uniqueInteractionEntities([...inputs, ...outputs]);
    for (const entity of affected) entity.effectIds.push(effectId);
    effects.push({
      id: effectId,
      kind: op.kind,
      span: op.span,
      inputEntityIds: interactionEntityIds(inputs),
      outputEntityIds: interactionEntityIds(outputs),
    });
    recordSelections(
      op,
      entrypoint,
      entities,
      entityByName,
      references,
      currentPart?.id,
    );
  }

  markGeneratedInteractionInstances(entities);
  const sketches = buildInteractionSketchInstances(
    entrypoint,
    ops,
    entities,
    declarationSpans,
    ast?.workplane ?? 'XY',
  );
  const invocations = buildInteractionInvocations(
    entrypoint,
    invocationTraces,
    entities,
  );
  return {
    version: 1,
    entrypoint,
    entities,
    effects,
    invocations,
    references,
    topology: [],
    sketchDefinitions: sketches.definitions,
    sketchInstances: sketches.instances,
  };
}

/**
 * Handles record selections in the metadata flow.
 */
function recordSelections(
  op: IROp,
  entrypoint: string,
  entities: MutableInteractionEntity[],
  byName: Map<string, MutableInteractionEntity>,
  references: InteractionReference[],
  ownerId?: string,
): void {
  for (const usage of interactionSelectionUsages(op)) {
    const { target, placement } = usage;
    const owner = lookupInteractionEntity(byName, target.ownerEntity, ownerId);
    const kind = selectionEntityKind(target.topologyKind);
    const resolvedPlacement = placement
      ? interactionPlacement(placement)
      : undefined;
    const targetId = interactionId(
      `selector-${kind}`,
      entrypoint,
      target.source.selectorSpan,
      target.id,
      resolvedPlacement
        ? `${target.label}:${placementIdentity(resolvedPlacement)}`
        : target.label,
    );
    if (!byName.has(targetId)) {
      const entity: MutableInteractionEntity = {
        id: targetId,
        kind,
        name: target.label,
        ...(owner ? { ownerId: owner.id } : {}),
        declarationSpan: target.source.selectorSpan,
        effectIds: [],
        selectorKind: target.selectorKind,
        selectionId: target.id,
        ...(resolvedPlacement ? { placement: resolvedPlacement } : {}),
        rendered: false,
      };
      entities.push(entity);
      byName.set(targetId, entity);
    }
    mergeReference(
      references,
      interactionId(
        'reference',
        entrypoint,
        target.source.selectorSpan,
        'selector',
      ),
      target.source.selectorSpan,
      target.source.segmentSpans.map((segment) => segment.span),
      targetId,
    );
  }
}

/** Removes duplicated selector metadata while retaining exact axis inputs. */
function interactionPlacement(placement: IRPlacement): IRPlacement {
  const { selection: _selection, ...resolved } = placement;
  return resolved;
}

/** Produces stable per-placement identity for loop-expanded selector links. */
function placementIdentity(placement: IRPlacement): string {
  return JSON.stringify(placement);
}

/**
 * Handles merge reference in the metadata flow.
 */
function mergeReference(
  references: InteractionReference[],
  id: string,
  span: SourceSpan,
  segmentSpans: SourceSpan[],
  targetId: string,
): void {
  const existingIndex = references.findIndex(
    (reference) => reference.id === id,
  );
  const existing = references[existingIndex];
  if (!existing) {
    references.push({
      id,
      span,
      groupSpan: span,
      segments: segmentSpans.map((segmentSpan) => ({
        span: segmentSpan,
        targetIds: [targetId],
      })),
      targetIds: [targetId],
    });
    return;
  }
  const segments = [...existing.segments];
  for (const segmentSpan of segmentSpans) {
    const segmentIndex = segments.findIndex(
      (segment) =>
        interactionSpanKey(segment.span) === interactionSpanKey(segmentSpan),
    );
    const segment = segments[segmentIndex];
    if (segment) {
      segments[segmentIndex] = {
        ...segment,
        targetIds: [...new Set([...segment.targetIds, targetId])],
      };
    } else {
      segments.push({ span: segmentSpan, targetIds: [targetId] });
    }
  }
  references[existingIndex] = {
    ...existing,
    segments,
    targetIds: [...new Set([...existing.targetIds, targetId])],
  };
}

/**
 * Handles entity kind in the metadata flow.
 */
function entityKind(op: IROp): InteractionEntityKind {
  if (op.kind === 'sketch') return 'sketch';
  if (op.kind === 'surface' || op.kind === 'surfaceOffset') return 'surface';
  if (op.kind === 'importShape') return 'imported';
  return 'object';
}

/**
 * Handles selection entity kind in the metadata flow.
 */
function selectionEntityKind(kind: string): InteractionEntityKind {
  if (kind === 'point') return 'point';
  if (kind === 'vertex') return 'corner';
  if (kind === 'edge' || kind === 'loop') return 'edge';
  if (kind === 'face') return 'face';
  return 'object';
}
