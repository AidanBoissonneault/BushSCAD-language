/** Implements the blends behavior owned by the OCCT bridge. */

import { DraftBridge } from '../draft/draft.js';

import {
  type BlendRetryRequest,
  dotVec,
  endpointsMatch,
  pointsClose,
  torusMesh,
  formatLimit,
} from '../../bridge/occt-bridge-base.js';

import type {
  MeshData,
  OcctError,
  SourceSpan,
  ValidationResult,
} from '@bushscad/ir';

import { FaceLabelMap } from '../../topology/face-labels.js';

import { parseFaceRef } from '../../core/program-utils.js';

import {
  getEdges,
  readBounds,
  readEdgeEndpoints,
  type Vec3,
} from '../../core/geometry-utils.js';

import { recordInteractionEdgeSelection } from '../../topology/interaction-selection-counts.js';

import { normalizeVec } from '../../topology/frame-utils.js';

import {
  edgeIntersectionFailure,
  selectEdgeIntersection,
} from '../../topology/edge-intersection-selection.js';

import { selectSketchComponentEdges } from '../../topology/sketch-component-selection.js';

import {
  isOcctError,
  occtError,
  rawErrorMessage,
} from '../../core/occt-errors.js';

import { conflictingBlendMessage } from '../blend-diagnostics.js';

import {
  modifierValue,
  sameModifierValue,
} from '../modifier-classification.js';

import { edgeKey, edgeVertexKeys } from '../../topology/edge-identity.js';

import { sameTopoShape } from '../../topology/shape-equality.js';

import { tryApplySolidCutToolBlend as applySolidCutToolBlendOperation } from '../solid-cut-tool-blend.js';

import type {
  BlendModifierKind,
  BlendModifierOp,
  ConnectedEdgeSelection,
  EdgeSelection,
  EdgeSelectionBatch,
  GroupBuildState,
  OC,
} from '../../bridge/bridge-types.js';

export abstract class BlendsBridge extends DraftBridge {
  protected override applyBlendModifierPhase(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    recordValidation: (validation: ValidationResult) => void,
    state: GroupBuildState,
    excludedEdges: unknown[] = [],
  ): EdgeSelection[] {
    if (ops.length === 0) return [];

    const parsed = parseFaceRef(ops[0].target);
    const shape = labelMap.getShape(parsed.objName);
    if (!shape)
      throw occtError(
        `Unknown object '${parsed.objName}' for ${kind}`,
        ops[0].span,
      );

    const expandedSelections = this.collectBlendSelectionsForPhase(
      kind,
      owner,
      ops,
      labelMap,
      replaceBody,
      recordValidation,
      state,
      shape,
      excludedEdges,
    );
    if (expandedSelections.length === 0) return [];

    return this.applyBlendSelectionsForPhase(
      kind,
      owner,
      ops,
      labelMap,
      replaceBody,
      recordValidation,
      shape,
      parsed.objName,
      expandedSelections,
    )
      ? expandedSelections
      : [];
  }

  protected override collectBlendSelectionsForPhase(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    recordValidation: (validation: ValidationResult) => void,
    state: GroupBuildState,
    shape: OC,
    excludedEdges: unknown[],
  ): EdgeSelection[] {
    try {
      if (
        this.tryApplySolidCutToolBlend(
          kind,
          owner,
          ops,
          labelMap,
          replaceBody,
          state,
        )
      ) {
        return [];
      }

      const selections = this.collectBlendEdgeSelections(
        kind,
        owner,
        ops,
        labelMap,
        state,
        excludedEdges,
        shape,
      );
      if (selections.length === 0) return [];
      const expanded = this.expandBlendSelections(
        kind,
        owner,
        shape,
        selections,
        labelMap,
      );
      this.captureDebugBlendEdges(state, kind, expanded);
      if (kind === 'fillet') this.rejectOversizedFillets(shape, expanded);
      return expanded;
    } catch (err) {
      if (!isOcctError(err)) throw err;
      recordValidation(this.blendFailureValidation(err as OcctError));
      return [];
    }
  }

  protected override tryApplySolidCutToolBlend(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    state: GroupBuildState,
  ): boolean {
    return applySolidCutToolBlendOperation({
      oc: this.oc,
      kind,
      owner,
      ops,
      labelMap,
      replaceBody,
      state,
      collectSelections: (selectionOwner, selectionOps, selectionLabels) =>
        this.collectBlendEdgeSelections(
          kind,
          selectionOwner,
          selectionOps,
          selectionLabels,
          state,
          [],
        ),
      applyBlendBatch: (
        blendKind,
        targetShape,
        selections,
        targetOwner,
        span,
      ) =>
        this.applyBlendBatch(
          blendKind,
          targetShape,
          selections,
          targetOwner,
          span,
        ),
      applyBoolCut: (target, tool, span) =>
        this.applyBoolCut(target, tool, span),
    });
  }

  protected override expandBlendSelections(
    kind: BlendModifierKind,
    owner: string,
    shape: OC,
    selections: EdgeSelection[],
    labelMap: FaceLabelMap,
  ): EdgeSelection[] {
    return kind === 'fillet'
      ? this.expandFilletTangentSelections(owner, shape, selections, labelMap)
      : selections;
  }

  protected override applyBlendSelectionsForPhase(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    recordValidation: (validation: ValidationResult) => void,
    shape: OC,
    objName: string,
    expandedSelections: EdgeSelection[],
  ): boolean {
    try {
      const result = this.applyBlendBatch(
        kind,
        shape,
        expandedSelections,
        owner,
        ops[0].span,
      );
      replaceBody(objName, result);
      return true;
    } catch (err) {
      return this.retryBlendSelectionsForPhase(
        {
          kind,
          owner,
          ops,
          labelMap,
          replaceBody,
          recordValidation,
          shape,
          objName,
          expandedSelections,
        },
        err,
      );
    }
  }

  protected override retryBlendSelectionsForPhase(
    request: BlendRetryRequest,
    err: unknown,
  ): boolean {
    if (!isOcctError(err)) throw err;
    const targetRetry = this.tryBlendByTargetGroups(
      request.kind,
      request.shape,
      request.expandedSelections,
      request.owner,
      request.labelMap,
      request.replaceBody,
      request.objName,
      request.recordValidation,
    );
    if (targetRetry) return true;
    return this.applyConnectedBlendRetry(request, err as OcctError);
  }

  protected override applyConnectedBlendRetry(
    request: BlendRetryRequest,
    err: OcctError,
  ): boolean {
    try {
      this.applyBlendBatchWithConnectedRetry(
        request.kind,
        request.shape,
        request.expandedSelections,
        request.owner,
        request.labelMap,
        request.ops[0].span,
        (result) => request.replaceBody(request.objName, result),
        err,
      );
      return true;
    } catch (retryErr) {
      if (
        this.canSkipConsumedSourceBlend(
          request.owner,
          request.labelMap,
          request.expandedSelections,
        )
      ) {
        return false;
      }
      if (isOcctError(retryErr)) {
        request.recordValidation(
          this.blendFailureValidation(retryErr as OcctError),
        );
        return false;
      }
      throw retryErr;
    }
  }

  protected override blendFailureValidation(
    error: OcctError,
  ): ValidationResult {
    return {
      passed: false,
      severity: 'error',
      message: error.message,
      span: error.span,
    };
  }

  protected override captureDebugBlendEdges(
    state: GroupBuildState,
    _kind: BlendModifierKind,
    selections: EdgeSelection[],
  ): void {
    const filter = process.env.BUSHSCAD_DEBUG_BLEND_EDGES;
    if (!filter) return;
    for (const selection of selections) {
      const parsed = parseFaceRef(selection.target);
      if (
        filter !== '*' &&
        filter !== selection.target &&
        filter !== parsed.objName
      ) {
        continue;
      }
      const mesh = this.debugClosedPlanarEdgeMesh(selection.edge);
      if (mesh) {
        state.debugBlendEdgeMeshes.push({
          target: selection.target,
          mesh,
        });
      }
    }
  }

  protected override debugClosedPlanarEdgeMesh(
    edge: unknown,
  ): Omit<MeshData, 'partName' | 'color'> | null {
    let bounds: ReturnType<typeof readBounds>;
    let endpoints: [Vec3, Vec3];
    try {
      bounds = readBounds(this.oc, edge);
      endpoints = readEdgeEndpoints(this.oc, edge);
    } catch {
      return null;
    }
    if (!pointsClose(endpoints[0], endpoints[1], 1e-4)) return null;
    const zSpan = bounds.zMax.current - bounds.zMin.current;
    if (Math.abs(zSpan) > 1e-3) return null;

    const cx = (bounds.xMin.current + bounds.xMax.current) / 2;
    const cy = (bounds.yMin.current + bounds.yMax.current) / 2;
    const cz = (bounds.zMin.current + bounds.zMax.current) / 2;
    const rx = (bounds.xMax.current - bounds.xMin.current) / 2;
    const ry = (bounds.yMax.current - bounds.yMin.current) / 2;
    if (rx <= 1e-6 || ry <= 1e-6) return null;
    const tubeRadius = Math.max(0.25, Math.min(rx, ry) * 0.015);
    return torusMesh(cx, cy, cz, rx, ry, tubeRadius);
  }

  protected override canSkipConsumedSourceBlend(
    owner: string,
    labelMap: FaceLabelMap,
    selections: EdgeSelection[],
  ): boolean {
    return (
      selections.length > 0 &&
      selections.every((selection) => {
        if (
          selection.selection?.edgeIntersection ||
          selection.selection?.sketchComponent
        )
          return false;
        const objName = parseFaceRef(selection.target).objName;
        return objName !== owner || labelMap.hasSourceMemory(objName);
      })
    );
  }

  protected override tryBlendByTargetGroups(
    kind: BlendModifierKind,
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
    replaceName: string,
    recordValidation: (validation: ValidationResult) => void,
  ): boolean {
    const groups = this.groupSelectionsByTarget(selections);
    if (groups.length <= 1) return false;

    let currentShape = shape;
    for (const group of groups) {
      try {
        const targetSelections = this.reselectTargetBlendSelections(
          group,
          labelMap,
        );
        currentShape = this.applyBlendBatchWithConnectedRetry(
          kind,
          currentShape,
          targetSelections,
          owner,
          labelMap,
          group[0]?.span ?? { file: '(occt)', line: 1, col: 1 },
          (result) => replaceBody(replaceName, result),
        );
      } catch (err) {
        if (isOcctError(err)) {
          recordValidation(this.blendFailureValidation(err as OcctError));
          continue;
        }
        throw err;
      }
    }
    return true;
  }

  protected override applyBlendBatchWithConnectedRetry(
    kind: BlendModifierKind,
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    labelMap: FaceLabelMap,
    span: SourceSpan,
    replaceCurrentShape: (shape: OC) => void,
    initialError?: OcctError,
  ): OC {
    if (initialError) {
      return this.applyConnectedBlendBatchesAfterFailure(
        kind,
        shape,
        selections,
        owner,
        labelMap,
        span,
        replaceCurrentShape,
        initialError,
      );
    }
    try {
      const result = this.applyBlendBatch(kind, shape, selections, owner, span);
      replaceCurrentShape(result);
      return result;
    } catch (err) {
      if (!isOcctError(err)) throw err;

      return this.applyConnectedBlendBatchesAfterFailure(
        kind,
        shape,
        selections,
        owner,
        labelMap,
        span,
        replaceCurrentShape,
        err as OcctError,
      );
    }
  }

  protected override applyConnectedBlendBatchesAfterFailure(
    kind: BlendModifierKind,
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    labelMap: FaceLabelMap,
    span: SourceSpan,
    replaceCurrentShape: (shape: OC) => void,
    err: OcctError,
  ): OC {
    const batches = this.planConnectedBlendBatches(selections);
    if (!batches || batches.length <= 1) throw err;

    try {
      let currentShape = shape;
      for (const batch of batches) {
        const batchSelections = this.reselectConnectedBlendBatch(
          batch,
          labelMap,
        );
        currentShape = this.applyBlendBatch(
          kind,
          currentShape,
          batchSelections,
          owner,
          batch.selections[0]?.span ?? span,
        );
        replaceCurrentShape(currentShape);
      }
      return currentShape;
    } catch (fallbackErr) {
      if (isOcctError(fallbackErr)) {
        throw occtError(
          `${rawErrorMessage(err)} Disconnected-edge retry also failed: ${rawErrorMessage(fallbackErr)}`,
          (fallbackErr as OcctError).span ?? span,
        );
      }
      throw fallbackErr;
    }
  }

  protected override groupSelectionsByTarget(
    selections: EdgeSelection[],
  ): EdgeSelection[][] {
    const groups: EdgeSelection[][] = [];
    const byTarget = new Map<string, EdgeSelection[]>();
    for (const selection of selections) {
      const key = `${selection.target}:${selection.value}`;
      let group = byTarget.get(key);
      if (!group) {
        group = [];
        byTarget.set(key, group);
        groups.push(group);
      }
      group.push(selection);
    }
    return groups;
  }

  protected override reselectTargetBlendSelections(
    selections: EdgeSelection[],
    labelMap: FaceLabelMap,
  ): EdgeSelection[] {
    const selected: EdgeSelection[] = [];
    const seen = new Set<unknown>();
    for (const selection of selections) {
      const candidates = this.blendEdgesForTarget(
        labelMap,
        selection.target,
        selection.selection,
      );
      const match =
        candidates.find(
          (edge) =>
            sameTopoShape(edge, selection.edge) &&
            ![...seen].some((used) => sameTopoShape(used, edge)),
        ) ?? selection.edge;
      seen.add(match);
      selected.push({ ...selection, edge: match });
    }
    return selected;
  }

  protected override collectBlendEdgeSelections(
    kind: BlendModifierKind,
    owner: string,
    ops: BlendModifierOp[],
    labelMap: FaceLabelMap,
    state: GroupBuildState,
    excludedEdges: unknown[] = [],
    ownerShape?: OC,
  ): EdgeSelection[] {
    const selections: EdgeSelection[] = [];
    for (const op of ops) {
      const value = modifierValue(op);
      const parsed = parseFaceRef(op.target);
      const edges = this.blendEdgesForOperation(
        labelMap,
        op,
        parsed.objName,
        excludedEdges,
        ownerShape,
      );
      recordInteractionEdgeSelection(
        this.oc,
        state,
        labelMap,
        op.selection,
        edges,
      );
      if (edges.length === 0 && op.selection?.edgeIntersection) {
        throw occtError(
          edgeIntersectionFailure(
            op.selection,
            selectEdgeIntersection(this.oc, labelMap, op.selection, ownerShape),
          ),
          op.span,
        );
      }
      if (edges.length === 0 && labelMap.hasSourceMemory(parsed.objName)) {
        continue;
      }
      if (edges.length === 0)
        throw occtError(`No edges for ${kind} '${op.target}'`, op.span);

      this.addBlendEdgeSelections(selections, edges, kind, owner, op, value);
    }
    return selections;
  }

  protected override blendEdgesForOperation(
    labelMap: FaceLabelMap,
    op: BlendModifierOp,
    sourceObjName: string,
    excludedEdges: unknown[],
    ownerShape?: OC,
  ): unknown[] {
    return this.blendEdgesForTarget(
      labelMap,
      op.target,
      op.selection,
      ownerShape,
    )
      .filter(
        (edge) =>
          !excludedEdges.some((excluded) =>
            this.edgesMatchForExclusion(excluded, edge),
          ),
      )
      .filter((edge) => this.edgeBelongsToSource(edge, sourceObjName));
  }

  protected override blendEdgesForTarget(
    labelMap: FaceLabelMap,
    target: string,
    selection: import('@bushscad/ir').ResolvedSelectionTarget | undefined,
    ownerShape?: OC,
  ): unknown[] {
    if (selection?.edgeIntersection) {
      return selectEdgeIntersection(this.oc, labelMap, selection, ownerShape)
        .selected;
    }
    return selection?.sketchComponent
      ? selectSketchComponentEdges(this.oc, labelMap, selection, ownerShape)
      : labelMap.getBlendEdges(this.oc, target);
  }

  protected override edgeBelongsToSource(
    edge: unknown,
    sourceObjName: string,
  ): boolean {
    const sourceName = (edge as { _sourceName?: string })?._sourceName;
    return sourceName === undefined || sourceName === sourceObjName;
  }

  protected override addBlendEdgeSelections(
    selections: EdgeSelection[],
    edges: unknown[],
    kind: BlendModifierKind,
    owner: string,
    op: BlendModifierOp,
    value: number,
  ): void {
    for (const edge of edges) {
      this.addBlendEdgeSelection(selections, edge, kind, owner, op, value);
    }
  }

  protected override addBlendEdgeSelection(
    selections: EdgeSelection[],
    edge: unknown,
    kind: BlendModifierKind,
    owner: string,
    op: BlendModifierOp,
    value: number,
  ): void {
    const existing = selections.find((selection) =>
      sameTopoShape(selection.edge, edge),
    );
    if (!existing) {
      selections.push({
        edge,
        value,
        target: op.target,
        span: op.span,
        ...(op.selection ? { selection: op.selection } : {}),
      });
      return;
    }
    if (sameModifierValue(existing.value, value)) return;
    if (existing.target !== op.target) {
      selections.push({
        edge,
        value,
        target: op.target,
        span: op.span,
        ...(op.selection ? { selection: op.selection } : {}),
      });
      return;
    }
    throw occtError(
      conflictingBlendMessage(kind, owner, existing, op.target, value),
      op.span,
    );
  }

  protected override edgesMatchForExclusion(
    claimed: unknown,
    candidate: unknown,
  ): boolean {
    if (sameTopoShape(claimed, candidate)) return true;
    try {
      const claimedEndpoints = readEdgeEndpoints(this.oc, claimed);
      const candidateEndpoints = readEdgeEndpoints(this.oc, candidate);
      return endpointsMatch(claimedEndpoints, candidateEndpoints);
    } catch {
      return false;
    }
  }

  protected override expandTangentSelection(
    owner: string,
    current: EdgeSelection,
    candidates: unknown[],
    expanded: EdgeSelection[],
    queued: EdgeSelection[],
  ): void {
    for (const edge of candidates) {
      if (!this.shouldPropagateTangentEdge(current, edge, expanded)) continue;
      const existing = expanded.find((selection) =>
        sameTopoShape(selection.edge, edge),
      );
      if (existing) {
        throw occtError(
          conflictingBlendMessage(
            'fillet',
            owner,
            existing,
            current.target,
            current.value,
          ),
          current.span,
        );
      }
      const propagated = { ...current, edge };
      expanded.push(propagated);
      queued.push(propagated);
    }
  }

  protected override shouldPropagateTangentEdge(
    current: EdgeSelection,
    edge: unknown,
    expanded: EdgeSelection[],
  ): boolean {
    if (!this.edgesAreTangentConnected(current.edge, edge)) return false;
    const existing = expanded.find((selection) =>
      sameTopoShape(selection.edge, edge),
    );
    if (!existing) return true;
    if (sameModifierValue(existing.value, current.value)) return false;
    return existing.target === current.target;
  }

  protected override targetScopedTangentCandidates(
    shape: OC,
    selections: EdgeSelection[],
    labelMap: FaceLabelMap,
  ): unknown[] {
    const candidates = getEdges(this.oc, shape);
    if (
      selections.every(
        (selection) =>
          !labelMap.hasSourceMemory(parseFaceRef(selection.target).objName),
      )
    ) {
      return candidates;
    }
    const byTarget = new Map<string, unknown[]>();
    for (const selection of selections) {
      if (!byTarget.has(selection.target)) {
        byTarget.set(
          selection.target,
          this.blendEdgesForTarget(
            labelMap,
            selection.target,
            selection.selection,
          ),
        );
      }
    }
    return candidates.filter((edge) =>
      [...byTarget].some(([target, targetEdges]) => {
        const targetObj = parseFaceRef(target).objName;
        const sourceName = (edge as { _sourceName?: string })?._sourceName;
        return (
          sourceName === targetObj ||
          targetEdges.some((targetEdge) => sameTopoShape(edge, targetEdge))
        );
      }),
    );
  }

  protected override edgesAreTangentConnected(a: unknown, b: unknown): boolean {
    if (sameTopoShape(a, b)) return false;
    const groupA = (a as { _tangentGroup?: unknown })?._tangentGroup;
    const groupB = (b as { _tangentGroup?: unknown })?._tangentGroup;
    if (groupA !== undefined && groupA === groupB) return this.edgesTouch(a, b);

    const dirA = this.edgeDirection(a);
    const dirB = this.edgeDirection(b);
    if (!dirA || !dirB || !this.edgesTouch(a, b)) return false;
    return Math.abs(dotVec(dirA, dirB)) >= Math.cos((8 * Math.PI) / 180);
  }

  protected override edgesTouch(a: unknown, b: unknown): boolean {
    const keysA = edgeVertexKeys(this.oc, a);
    const keysB = edgeVertexKeys(this.oc, b);
    return Boolean(keysA && keysB && keysA.some((key) => keysB.includes(key)));
  }

  protected override edgeDirection(edge: unknown): Vec3 | null {
    try {
      const [first, last] = readEdgeEndpoints(this.oc, edge);
      return normalizeVec([
        last[0] - first[0],
        last[1] - first[1],
        last[2] - first[2],
      ]);
    } catch {
      return null;
    }
  }

  protected override rejectOversizedFillets(
    shape: OC,
    selections: EdgeSelection[],
  ): void {
    const limit = this.estimateFilletRadiusLimit(shape);
    if (limit === null) return;
    for (const selection of selections) {
      if (selection.value <= limit) continue;
      throw occtError(
        `Fillet radius ${selection.value} is too large for '${selection.target}'; maximum estimated radius is ${formatLimit(limit)}`,
        selection.span,
      );
    }
  }

  protected override estimateFilletRadiusLimit(shape: OC): number | null {
    try {
      const bounds = readBounds(this.oc, shape);
      const dims = [
        bounds.xMax.current - bounds.xMin.current,
        bounds.yMax.current - bounds.yMin.current,
        bounds.zMax.current - bounds.zMin.current,
      ].filter((dim) => Number.isFinite(dim) && dim > 1e-6);
      if (dims.length === 0) return null;
      return Math.min(...dims) / 2;
    } catch {
      return null;
    }
  }

  protected override applyBlendBatch(
    kind: BlendModifierKind,
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    span: SourceSpan,
  ): OC {
    return kind === 'fillet'
      ? this.applyFilletBatch(shape, selections, owner, span)
      : this.applyChamferBatch(shape, selections, owner, span);
  }

  protected override planConnectedBlendBatches(
    selections: EdgeSelection[],
  ): EdgeSelectionBatch[] | null {
    const connected = selections.map((selection) => {
      const vertexKeys = edgeVertexKeys(this.oc, selection.edge);
      if (!vertexKeys) return null;
      return {
        ...selection,
        vertexKeys,
        edgeKey: edgeKey(vertexKeys),
      };
    });

    if (connected.some((selection) => selection === null)) return null;

    const planned = connected as ConnectedEdgeSelection[];
    const parents = planned.map((_, index) => index);
    const byVertex = new Map<string, number>();
    /**
     * Finds the root index for an edge selection and compresses the traversed path.
     */
    const find = (index: number): number => {
      let root = index;
      while (parents[root] !== root) root = parents[root];
      while (parents[index] !== index) {
        const next = parents[index];
        parents[index] = root;
        index = next;
      }
      return root;
    };
    /**
     * Joins the sets containing two edge selections when they have different roots.
     */
    const union = (a: number, b: number): void => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parents[rootB] = rootA;
    };

    planned.forEach((selection, index) => {
      for (const vertexKey of selection.vertexKeys) {
        const existing = byVertex.get(vertexKey);
        if (existing === undefined) {
          byVertex.set(vertexKey, index);
        } else {
          union(existing, index);
        }
      }
    });

    const batches: EdgeSelectionBatch[] = [];
    const byRoot = new Map<number, EdgeSelectionBatch>();
    planned.forEach((selection, index) => {
      const root = find(index);
      let batch = byRoot.get(root);
      if (!batch) {
        batch = { selections: [] };
        byRoot.set(root, batch);
        batches.push(batch);
      }
      batch.selections.push(selection);
    });

    return batches;
  }

  protected override reselectConnectedBlendBatch(
    batch: EdgeSelectionBatch,
    labelMap: FaceLabelMap,
  ): EdgeSelection[] {
    const candidatesByTarget = new Map<string, ConnectedEdgeSelection[]>();
    const used: ConnectedEdgeSelection[] = [];
    const selected: EdgeSelection[] = [];

    for (const planned of batch.selections) {
      const targetKey = `${planned.target}:${planned.value}`;
      let candidates = candidatesByTarget.get(targetKey);
      if (!candidates) {
        candidates = labelMap
          .getBlendEdges(this.oc, planned.target)
          .map((edge) => {
            const vertexKeys = edgeVertexKeys(this.oc, edge);
            return vertexKeys
              ? {
                  edge,
                  value: planned.value,
                  target: planned.target,
                  span: planned.span,
                  vertexKeys,
                  edgeKey: edgeKey(vertexKeys),
                }
              : null;
          })
          .filter(
            (selection): selection is ConnectedEdgeSelection =>
              selection !== null,
          );
        candidatesByTarget.set(targetKey, candidates);
      }

      const match = candidates.find(
        (candidate) =>
          candidate.edgeKey === planned.edgeKey &&
          !used.some((existing) =>
            sameTopoShape(existing.edge, candidate.edge),
          ),
      );
      if (!match) return batch.selections;

      used.push(match);
      selected.push({
        edge: match.edge,
        value: planned.value,
        target: planned.target,
        span: planned.span,
      });
    }

    return selected;
  }
}
