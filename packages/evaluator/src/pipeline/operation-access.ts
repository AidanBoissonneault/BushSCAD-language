/**
 * @author Aidan Boissonneault
 * @file operation-access.ts
 * @purpose Provides operation access behavior for the pipeline in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IROp, IRPlacement, ResolvedSelectionTarget } from '@bushscad/ir';
import {
  staticOperationAccess,
  type OperationStaticAccess,
} from './operation-access-metadata.js';

/**
 * Type used for operation selection usage.
 */
export type OperationSelectionUsage = Readonly<{
  target: ResolvedSelectionTarget;
  placement?: IRPlacement;
}>;

/**
 * Derives `OperationAccess` from `OperationStaticAccess & Readonly<{ semanticInputs: readonly
 * string[]; semanticOutputs: readonly string[]; schedulingInputs: readonly string[];
 * schedulingOutputs: readonly string[]; selections: readonly OperationSelectionUsage[]; }>` to
 * preserve its type relationship in the pipeline layer.
 */
export type OperationAccess = OperationStaticAccess &
  Readonly<{
    semanticInputs: readonly string[];
    semanticOutputs: readonly string[];
    schedulingInputs: readonly string[];
    schedulingOutputs: readonly string[];
    selections: readonly OperationSelectionUsage[];
  }>;

const SEMANTIC_OBJECT_OUTPUTS = new Set<IROp['kind']>([
  'extrude',
  'cut',
  'solid_cut',
  'revolve',
  'radial_extrude',
  'radial_cut',
  'loft',
  'shell',
  'sweep',
  'sweep_cut',
  'surfaceThicken',
  'solidPrimitive',
]);
const SEMANTIC_NAME_OUTPUTS = new Set<IROp['kind']>([
  'sketch',
  'surface',
  'surfaceOffset',
  'importShape',
  'ref',
  'declareShape',
]);
const SEMANTIC_TARGET_OUTPUTS = new Set<IROp['kind']>([
  'fillet',
  'chamfer',
  'draft',
  'thread',
  'rotate',
  'heal',
  'defeature',
]);

/** Classifies one evaluated IR operation for provenance and graph planning. */
export function operationAccess(op: IROp): OperationAccess {
  const selections = selectionUsages(op);
  const semanticInputs = semanticInputNames(op);
  const semanticOutputs = semanticOutputNames(op);
  return {
    ...staticOperationAccess(op.kind),
    semanticInputs,
    semanticOutputs,
    schedulingInputs: unique([
      ...semanticInputs,
      ...additionalInputNames(op),
      ...selections.map(({ target }) => rootName(target.ownerEntity)),
      ...placementOwnerNames(op),
    ]),
    schedulingOutputs: unique([
      ...semanticOutputs,
      ...additionalOutputNames(op),
    ]),
    selections,
  };
}

/**
 * Handles semantic output names in the pipeline flow.
 */
function semanticOutputNames(op: IROp): string[] {
  return (
    objectOutputNames(op) ??
    namedOutputNames(op) ??
    targetOutputNames(op) ??
    directOutputNames(op) ??
    []
  );
}

/** Resolves outputs stored in an operation's `objName` field. */
function objectOutputNames(op: IROp): string[] | null {
  const record = op as unknown as Record<string, unknown>;
  if (
    SEMANTIC_OBJECT_OUTPUTS.has(op.kind) &&
    typeof record.objName === 'string'
  )
    return [record.objName];
  return null;
}

/** Resolves outputs stored in an operation's ordinary `name` field. */
function namedOutputNames(op: IROp): string[] | null {
  const record = op as unknown as Record<string, unknown>;
  if (SEMANTIC_NAME_OUTPUTS.has(op.kind) && typeof record.name === 'string')
    return [record.name];
  return null;
}

/** Resolves outputs represented by a selected target reference. */
function targetOutputNames(op: IROp): string[] | null {
  const record = op as unknown as Record<string, unknown>;
  if (SEMANTIC_TARGET_OUTPUTS.has(op.kind) && typeof record.target === 'string')
    return [rootName(record.target)];
  return null;
}

/** Resolves outputs whose operation forms use a distinct field shape. */
function directOutputNames(op: IROp): string[] | null {
  if (op.kind === 'alignShape') return [op.instanceName];
  if (op.kind === 'fuse') return [...op.targets];
  if (
    op.kind === 'patternLinear' ||
    op.kind === 'patternRadial' ||
    op.kind === 'mirror' ||
    op.kind === 'transform'
  )
    return [op.objName];
  return null;
}

/**
 * Handles semantic input names in the pipeline flow.
 */
function semanticInputNames(op: IROp): string[] {
  const record = op as unknown as Record<string, unknown>;
  const names: string[] = [];
  for (const key of [
    'target',
    'objName',
    'sketchName',
    'pathName',
    'surfaceName',
    'source',
    'baseName',
    'sourceRef',
  ]) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0)
      names.push(rootName(value));
  }
  for (const key of ['targets', 'sketchNames']) {
    const value = record[key];
    if (Array.isArray(value))
      names.push(
        ...value.filter((name): name is string => typeof name === 'string'),
      );
  }
  if (op.kind === 'solid_cut' && op.tool.kind === 'object')
    names.push(op.tool.objName);
  return unique(names);
}

/**
 * Handles additional input names in the pipeline flow.
 */
function additionalInputNames(op: IROp): string[] {
  return unique([
    ...directAdditionalInputNames(op),
    ...assertionAdditionalInputNames(op),
    ...mirrorPlaneInputNames(op),
    ...inlineToolInputNames(op),
  ]);
}

/** Resolves operation-specific named inputs outside assertion expressions. */
function directAdditionalInputNames(op: IROp): string[] {
  switch (op.kind) {
    case 'joint':
      return [rootName(op.sideA), rootName(op.sideB)];
    case 'patternRadial':
      return [rootName(op.aroundRef)];
    case 'cut':
    case 'sweep_cut':
      return op.throughTarget ? [rootName(op.throughTarget)] : [];
    case 'fit':
      return [rootName(op.targetName)];
    case 'alignShape':
      return [rootName(op.name)];
    case 'surface':
      return [rootName(op.boundary)];
    default:
      return [];
  }
}

/** Resolves geometry-query names embedded in an assertion operation. */
function assertionAdditionalInputNames(op: IROp): string[] {
  return op.kind === 'assert' ? assertInputNames(op.left, op.right) : [];
}

/** Resolves named references used to define a mirror plane. */
function mirrorPlaneInputNames(op: IROp): string[] {
  if (op.kind !== 'mirror') return [];
  if (op.across.kind === 'named') return [rootName(op.across.name)];
  if (op.across.kind === 'faceRef') return [rootName(op.across.ref)];
  return [];
}

/** Resolves dependencies of an inline operation used as a solid-cut tool. */
function inlineToolInputNames(op: IROp): string[] {
  if (op.kind !== 'solid_cut' || op.tool.kind !== 'operation') return [];
  return [...operationAccess(op.tool.operation).schedulingInputs];
}

/**
 * Handles assert input names in the pipeline flow.
 */
function assertInputNames(
  ...expressions: readonly (
    Extract<IROp, { kind: 'assert' }>['left'] | undefined
  )[]
): string[] {
  const names: string[] = [];
  /**
   * Handles visit in the pipeline flow.
   */
  const visit = (expression: (typeof expressions)[number]): void => {
    if (!expression) return;
    if (expression.kind === 'query') {
      names.push(...expression.args.map(rootName));
    } else if (expression.kind === 'binary') {
      visit(expression.left);
      visit(expression.right);
    }
  };
  expressions.forEach(visit);
  return names;
}

/**
 * Handles additional output names in the pipeline flow.
 */
function additionalOutputNames(op: IROp): string[] {
  if (op.kind === 'path' || op.kind === 'hardware_visual')
    return [op.kind === 'path' ? op.name : op.objName];
  if (op.kind === 'joint') return [op.name];
  if (op.kind === 'fit') return [op.fitName];
  return [];
}

/**
 * Handles placement owner names in the pipeline flow.
 */
function placementOwnerNames(op: IROp): string[] {
  const names: string[] = [];
  const seen = new Set<unknown>();
  const pending: unknown[] = [op];
  while (pending.length > 0) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    const record = value as Record<string, unknown>;
    if (typeof record.faceRef === 'string')
      names.push(rootName(record.faceRef));
    pending.push(...Object.values(record));
  }
  return unique(names);
}

/**
 * Handles selection usages in the pipeline flow.
 */
function selectionUsages(op: IROp): OperationSelectionUsage[] {
  const usages: OperationSelectionUsage[] = [];
  const seen = new Set<unknown>();
  /**
   * Handles visit in the pipeline flow.
   */
  const visit = (value: unknown, placement?: IRPlacement): void => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (isSelectionTarget(value)) {
      usages.push({ target: value, ...(placement ? { placement } : {}) });
      return;
    }
    const currentPlacement = isPlacement(value) ? value : placement;
    for (const nested of Object.values(value)) visit(nested, currentPlacement);
  };
  visit(op);
  return usages;
}

/**
 * Returns whether the input meets the `placement` condition.
 */
function isPlacement(value: object): value is IRPlacement {
  const placement = value as Partial<IRPlacement>;
  return (
    typeof placement.faceRef === 'string' &&
    typeof placement.selection === 'object'
  );
}

/**
 * Returns whether the input meets the `selection target` condition.
 */
function isSelectionTarget(value: object): value is ResolvedSelectionTarget {
  const target = value as Partial<ResolvedSelectionTarget>;
  return (
    typeof target.id === 'string' &&
    typeof target.label === 'string' &&
    typeof target.ownerEntity === 'string' &&
    typeof target.selectorKind === 'string' &&
    typeof target.topologyKind === 'string' &&
    typeof target.source === 'object'
  );
}

/**
 * Handles root name in the pipeline flow.
 */
function rootName(value: string): string {
  return value.split('.')[0] ?? value;
}

/**
 * Removes duplicate values while preserving their first occurrence.
 */
function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}
