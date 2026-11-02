/**
 * @author Aidan Boissonneault
 * @file prepared-component.ts
 * @purpose Provides prepared component behavior for the pipeline in IR package.
 * @last-edited October 6, 2026
 */

import type { IROp, SourceSpan } from '../shared/ir.js';

/**
 * Selected members of IROp['kind'] used for prepared component operation kind.
 */
export type PreparedComponentOperationKind = Extract<
  IROp['kind'],
  'solidPrimitive' | 'extrude' | 'revolve' | 'radial_extrude' | 'loft' | 'sweep'
>;

/** Lossless worker-owned geometry plus its immutable semantic sidecar. */
export type PreparedComponentArtifact = Readonly<{
  format: 'occt-brep-v1';
  partName: string;
  name: string;
  operationKind: PreparedComponentOperationKind;
  span: SourceSpan;
  semanticConsumerIds: readonly string[];
  brep: Uint8Array;
}>;
