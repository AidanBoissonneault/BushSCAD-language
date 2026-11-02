/**
 * @author Aidan Boissonneault
 * @file sketch-instances.ts
 * @purpose Provides sketch instances behavior for the metadata in IR package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive } from '../sketch/sketchIr.js';
import type { IRPlacement, SourceSpan, Workplane } from '../shared/ir-core.js';

/**
 * sketch instance transform represented by readonly [ number, number, number, number, number,
 * number, number, number, numbe.
 */
export type SketchInstanceTransform = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** Reusable local geometry shared by every equal evaluated sketch instance. */
export type InteractionSketchDefinition = {
  readonly id: string;
  readonly entityIds: readonly string[];
  readonly name: string;
  readonly sourceSpan: SourceSpan;
  readonly revision: number;
  readonly primitive: IRPrimitive;
};

/** One evaluated use of a logical sketch before and after placement realization. */
export type InteractionSketchInstance = {
  readonly id: string;
  readonly definitionId: string;
  readonly entityIds: readonly string[];
  readonly partEntityId: string;
  readonly partName: string;
  readonly sourceSpan: SourceSpan;
  readonly placement: IRPlacement | null;
  readonly workplane: Workplane;
  readonly localOffsetZ?: number;
  readonly transform?: SketchInstanceTransform;
  readonly unsupportedReason?: string;
};
