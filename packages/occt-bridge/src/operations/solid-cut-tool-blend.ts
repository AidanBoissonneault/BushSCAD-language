/**
 * @author Aidan Boissonneault
 * @file solid-cut-tool-blend.ts
 * @purpose Provides solid cut tool blend behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { FaceLabelMap } from '../topology/face-labels.js';
import type {
  BlendModifierKind,
  BlendModifierOp,
  EdgeSelection,
  GroupBuildState,
  OC,
} from '../bridge/bridge-types.js';
import { parseFaceRef } from '../core/program-utils.js';
import { sameTopoShape } from '../topology/shape-equality.js';
import {
  boxesNearlyEqual,
  matchSolidCutToolBlendSelections,
  readBox,
} from './solid-cut-tool-edge-matching.js';

/**
 * Options for solid cut tool blend, including oc, operation kind, owner, ops, and label map.
 */
interface SolidCutToolBlendOptions {
  oc: OC;
  kind: BlendModifierKind;
  owner: string;
  ops: BlendModifierOp[];
  labelMap: FaceLabelMap;
  replaceBody: (name: string, shape: OC) => void;
  state: GroupBuildState;
  collectSelections: (
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
  ) => EdgeSelection[];
  applyBlendBatch: (
    kind: BlendModifierKind,
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    span: BlendModifierOp['span'],
  ) => OC;
  applyBoolCut: (target: OC, tool: OC, span: BlendModifierOp['span']) => OC;
}

/**
 * Applies a loft-cut edge blend to the source tool, then repeats the cut.
 *
 * Why: blending the source cutter preserves a concave pocket transition. The
 * post-boolean edge can be a split closed contour and may produce the wrong
 * side of the blend on steep loft walls.
 */
export function tryApplySolidCutToolBlend(
  options: SolidCutToolBlendOptions,
): boolean {
  const { oc, kind, owner, ops, labelMap, state } = options;
  if (ops.length === 0 || ops.some((op) => op.kind !== kind)) return false;

  const parsed = ops.map((op) => parseFaceRef(op.target));
  const objName = parsed[0]?.objName;
  if (!objName || parsed.some((reference) => reference.objName !== objName)) {
    return false;
  }

  const metadata = state.solidCutAliases.get(objName);
  if (!metadata || metadata.toolKind !== 'loft') return false;

  const currentShape = labelMap.getShape(objName);
  if (
    !currentShape ||
    !shapeMatchesCurrentCut(oc, currentShape, metadata.resultShape)
  ) {
    return false;
  }

  const selectedEdges = options.collectSelections(owner, ops, labelMap);
  if (selectedEdges.length === 0) return false;

  const toolSelections = matchSolidCutToolBlendSelections(
    oc,
    selectedEdges,
    metadata.toolShape,
  );
  if (!toolSelections || toolSelections.length === 0) return false;

  let blendedTool: OC | null = null;
  let keepBlendedTool = false;
  try {
    blendedTool = options.applyBlendBatch(
      kind,
      metadata.toolShape,
      toolSelections,
      owner,
      ops[0].span,
    );
    const result = options.applyBoolCut(
      metadata.targetShape,
      blendedTool,
      ops[0].span,
    );

    options.replaceBody(objName, result);
    state.solidCutAliases.set(objName, {
      ...metadata,
      toolShape: blendedTool,
      resultShape: result,
    });
    keepBlendedTool = true;

    return true;
  } finally {
    toolSelections.forEach((selection) => {
      (selection.edge as { delete?: () => void })?.delete?.();
    });
    if (!keepBlendedTool) blendedTool?.delete?.();
  }
}

/**
 * Returns the shape data required by the current operation.
 */
function shapeMatchesCurrentCut(
  oc: OC,
  current: unknown,
  original: unknown,
): boolean {
  if (sameTopoShape(current, original)) return true;
  try {
    return boxesNearlyEqual(readBox(oc, current), readBox(oc, original), 1e-4);
  } catch {
    return false;
  }
}
