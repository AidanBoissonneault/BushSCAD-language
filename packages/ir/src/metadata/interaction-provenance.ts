/**
 * @author Aidan Boissonneault
 * @file interaction-provenance.ts
 * @purpose Provides interaction provenance behavior for the metadata in IR package.
 * @last-edited October 6, 2026
 */

import type { IRPlacement, SourceSpan } from '../shared/ir-core.js';
import type { ResolvedSelectorKind } from '../references/resolved-selection.js';
import type {
  InteractionSketchDefinition,
  InteractionSketchInstance,
} from './sketch-instances.js';

/**
 * Accepted values for interaction entity kind are 'part', 'object', 'generated-instance',
 * 'sketch', 'surface', 'imported', 'face', 'edge', 'corner', and 'point'.
 */
export type InteractionEntityKind =
  | 'part'
  | 'object'
  | 'generated-instance'
  | 'sketch'
  | 'surface'
  | 'imported'
  | 'face'
  | 'edge'
  | 'corner'
  | 'point';

/**
 * Interaction entity, including identifier, operation kind, name, owner id, and declaration
 * span.
 */
export type InteractionEntity = {
  readonly id: string;
  readonly kind: InteractionEntityKind;
  readonly name: string;
  readonly ownerId?: string;
  readonly declarationSpan: SourceSpan;
  readonly linkSpan?: SourceSpan;
  readonly effectIds: readonly string[];
  readonly instancePath?: string;
  readonly selectorKind?: Exclude<ResolvedSelectorKind, 'expanded-selection'>;
  readonly selectionId?: string;
  readonly collectionValueCount?: number;
  readonly collectionValues?: readonly string[];
  readonly placement?: IRPlacement;
  readonly rendered: boolean;
};

/**
 * Interaction effect, including identifier, operation kind, span, input entity ids, and output
 * entity ids.
 */
export type InteractionEffect = {
  readonly id: string;
  readonly kind: string;
  readonly span: SourceSpan;
  readonly inputEntityIds: readonly string[];
  readonly outputEntityIds: readonly string[];
};

/**
 * Interaction invocation, including identifier, name, span, link span, and entity ids.
 */
export type InteractionInvocation = {
  readonly id: string;
  readonly name: string;
  readonly span: SourceSpan;
  readonly linkSpan: SourceSpan;
  readonly entityIds: readonly string[];
};

/**
 * Interaction reference segment, including span and target ids.
 */
export type InteractionReferenceSegment = {
  readonly span: SourceSpan;
  readonly targetIds: readonly string[];
};

/**
 * Interaction reference, including identifier, span, group span, segments, and target ids.
 */
export type InteractionReference = {
  readonly id: string;
  readonly span: SourceSpan;
  readonly groupSpan: SourceSpan;
  readonly segments: readonly InteractionReferenceSegment[];
  readonly targetIds: readonly string[];
};

/**
 * Interaction face range, including identifier, owner entity id, semantic target identifiers,
 * triangle start, and triangle count.
 */
export type InteractionFaceRange = {
  readonly id: string;
  readonly ownerEntityId: string;
  readonly semanticTargetIds: readonly string[];
  readonly triangleStart: number;
  readonly triangleCount: number;
};

/**
 * Interaction polyline, including identifier, owner entity id, semantic target identifiers, and
 * point geometry.
 */
export type InteractionPolyline = {
  readonly id: string;
  readonly ownerEntityId: string;
  readonly semanticTargetIds: readonly string[];
  readonly points: readonly number[];
};

/**
 * Interaction point, including identifier, owner entity id, semantic target identifiers, point,
 * and role.
 */
export type InteractionPoint = {
  readonly id: string;
  readonly ownerEntityId: string;
  readonly semanticTargetIds: readonly string[];
  readonly point: readonly [number, number, number];
  readonly role?: 'reference-point';
};

/**
 * Interaction mesh topology, including mesh index, part entity id, object entity id, faces, and
 * edges.
 */
export type InteractionMeshTopology = {
  readonly meshIndex: number;
  readonly partEntityId: string;
  readonly objectEntityId?: string;
  readonly faces: readonly InteractionFaceRange[];
  readonly edges: readonly InteractionPolyline[];
  readonly corners: readonly InteractionPoint[];
};

/**
 * Immutable compiler-to-viewport relationship table for one successful build.
 * Source and geometry interactions need stable plain-data identity without
 * leaking parser, VS Code, Three.js, or OpenCascade runtime objects across APIs.
 */
export type InteractionSnapshot = {
  readonly version: 1;
  readonly entrypoint: string;
  readonly entities: readonly InteractionEntity[];
  readonly effects: readonly InteractionEffect[];
  readonly invocations?: readonly InteractionInvocation[];
  readonly references: readonly InteractionReference[];
  readonly topology: readonly InteractionMeshTopology[];
  readonly sketchDefinitions?: readonly InteractionSketchDefinition[];
  readonly sketchInstances?: readonly InteractionSketchInstance[];
};
