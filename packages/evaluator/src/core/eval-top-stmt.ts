/**
 * @author Aidan Boissonneault
 * @file eval-top-stmt.ts
 * @purpose Evaluates top stmt for the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  DrawingOutputIR,
  IRPartBoundary,
  TopLevelStatement,
} from '@bushscad/ir';
import type { Deferred, EvalCtx } from './eval-types.js';
import { addError, childCtx, toSpan } from './eval-context.js';
import { evalEnvDecl, evalNum } from '../expressions/eval-expressions.js';
import { declareAnchorAlias } from '../references/eval-anchor-aliases.js';
import {
  evalBodyStatements,
  emitSketchOp,
  evalComponentBody,
  evalFunction,
} from '../statements/eval-statements.js';
import { bodyUsesThis } from '../statements/eval-body-this.js';
import { bodyRequiresParentContext } from '../statements/eval-body-parent-context.js';
import { collectBodyObjectNames } from '../statements/eval-body-object-names.js';
import { functionCallNameSpan } from '../statements/eval-body-functions.js';
import { evaluatePartMetadata } from '../metadata/eval-metadata.js';
import {
  evalAssertStmt,
  evalBodyStmt,
  evalSharedStmt,
} from '../statements/eval-body-stmts.js';
import { evalPlace } from '../objects/eval-place.js';
import { evalFitDecl, evalUseLibrary } from '../objects/eval-fit.js';
import { evalJointDecl } from '../objects/eval-joint.js';
import { evalDrawingDecl } from '../drawing/eval-drawing.js';
import { evalVarValue } from '../references/eval-selector-vars.js';

/**
 * State for eval top, including drawings and deferred.
 */
type EvalTopState = {
  drawings?: DrawingOutputIR[];
  deferred: Deferred;
};

/**
 * Defines the `TopHandler` callback contract used by the core layer.
 */
type TopHandler<K extends TopLevelStatement['kind']> = (
  stmt: Extract<TopLevelStatement, { kind: K }>,
  ctx: EvalCtx,
  state: EvalTopState,
) => void;

const TOP_HANDLERS: {
  [K in TopLevelStatement['kind']]?: TopHandler<K>;
} = {
  var: (stmt, ctx) => {
    ctx.values.set(stmt.name, evalVarValue(stmt.value, ctx));
  },
  env: (stmt, ctx) => {
    ctx.values.set(stmt.name, evalEnvDecl(stmt, ctx));
  },
  fontImport: evalFontImport,
  shapeImport: evalShapeImport,
  heal: evalHeal,
  defeature: evalDefeature,
  sketch: (stmt, ctx) => emitSketchOp(stmt, ctx, stmt.name),
  objCall: evalTopObjCall,
  fillet: (stmt, ctx, state) => evalBodyStmt(stmt, ctx, state.deferred),
  chamfer: (stmt, ctx, state) => evalBodyStmt(stmt, ctx, state.deferred),
  shell: (stmt, ctx, state) => evalBodyStmt(stmt, ctx, state.deferred),
  draft: (stmt, ctx, state) => evalBodyStmt(stmt, ctx, state.deferred),
  thread: (stmt, ctx, state) => evalBodyStmt(stmt, ctx, state.deferred),
  place: (stmt, ctx, state) =>
    evalPlace(stmt, ctx, state.deferred, { evalBodyStatements, evalFunction }),
  anchor: (stmt, ctx) => declareAnchorAlias(stmt.name, stmt.point, ctx),
  use: (stmt, ctx) => evalUseLibrary(stmt.library, ctx),
  part: (stmt, ctx) => evalPartStmt(stmt, ctx),
  assert: (stmt, ctx) => evalAssertStmt(stmt, ctx),
  fit: (stmt, ctx) => evalFitDecl(stmt, ctx),
  joint: (stmt, ctx) => evalJointDecl(stmt, ctx),
  drawing: (stmt, ctx, state) => {
    if (state.drawings) state.drawings.push(evalDrawingDecl(stmt, ctx));
  },
  import: evalImportedTopStatements,
  export: evalExportedTopStatement,
};

/** Evaluates a top-level statement and mutates the active evaluation context. */
export function evalTopStmt(
  stmt: TopLevelStatement,
  ctx: EvalCtx,
  drawings?: DrawingOutputIR[],
  deferred: Deferred = [],
): void {
  if (evalSharedStmt(stmt, ctx)) return;
  TOP_HANDLERS[stmt.kind]?.(stmt as never, ctx, { drawings, deferred });
}

/**
 * Evaluates font import with the current evaluation context.
 */
function evalFontImport(
  stmt: Extract<TopLevelStatement, { kind: 'fontImport' }>,
  ctx: EvalCtx,
): void {
  ctx.values.set(stmt.name, {
    kind: 'fontAsset',
    name: stmt.name,
    sourcePath: stmt.resolvedPath ?? stmt.path,
    fsPath: stmt.fsPath ?? `/fonts/imported/${stmt.name}`,
  });
}

/**
 * Evaluates shape import with the current evaluation context.
 */
function evalShapeImport(
  stmt: Extract<TopLevelStatement, { kind: 'shapeImport' }>,
  ctx: EvalCtx,
): void {
  const sourcePath = stmt.resolvedPath ?? stmt.path;
  const format = shapeImportFormat(sourcePath);
  const fsPath = stmt.fsPath ?? `/shapes/imported/${stmt.name}.${format}`;
  ctx.names.set(stmt.name, stmt.name);
  ctx.refBases.set(stmt.name, stmt.name);
  ctx.ops.push({
    kind: 'importShape',
    name: stmt.name,
    fsPath,
    format,
    span: toSpan(stmt.span),
  });
}

/**
 * Evaluates heal with the current evaluation context.
 */
function evalHeal(
  stmt: Extract<TopLevelStatement, { kind: 'heal' }>,
  ctx: EvalCtx,
): void {
  const target = stmt.target ? (ctx.names.get(stmt.target) ?? stmt.target) : '';
  if (!target) return;
  ctx.ops.push({
    kind: 'heal',
    target,
    tolerance: evalNum(stmt.tolerance, ctx),
    span: toSpan(stmt.span),
  });
}

/**
 * Evaluates defeature with the current evaluation context.
 */
function evalDefeature(
  stmt: Extract<TopLevelStatement, { kind: 'defeature' }>,
  ctx: EvalCtx,
): void {
  const target = stmt.target ? (ctx.names.get(stmt.target) ?? stmt.target) : '';
  if (!target) return;
  ctx.ops.push({
    kind: 'defeature',
    target,
    featureType: stmt.featureType,
    threshold: evalNum(stmt.threshold, ctx),
    span: toSpan(stmt.span),
  });
}

/**
 * Evaluates imported top statements with the current evaluation context.
 */
function evalImportedTopStatements(
  stmt: Extract<TopLevelStatement, { kind: 'import' }>,
  ctx: EvalCtx,
  state: EvalTopState,
): void {
  for (const resolved of stmt.resolved ?? []) {
    evalTopStmt(resolved, ctx, state.drawings, state.deferred);
  }
}

/**
 * Evaluates a public declaration without changing its ordinary runtime effect.
 *
 * Why:
 * `export` controls cross-file availability. Geometry declarations must still
 * emit visible output; authors use `ref` when declaration-site geometry should
 * remain hidden.
 */
function evalExportedTopStatement(
  stmt: Extract<TopLevelStatement, { kind: 'export' }>,
  ctx: EvalCtx,
  state: EvalTopState,
): void {
  if (stmt.statement.kind === 'fn') {
    ctx.functions.set(stmt.statement.name, stmt.statement);
    return;
  }
  if (stmt.statement.kind === 'part') {
    ctx.components.set(stmt.statement.name, stmt.statement.body);
    evalPartStmt(stmt.statement, ctx, true);
    return;
  }
  evalTopStmt(stmt.statement, ctx, state.drawings, state.deferred);
}

/**
 * Returns the shape data required by the current operation.
 */
function shapeImportFormat(path: string): 'step' | 'stl' {
  return path.toLowerCase().endsWith('.stl') ? 'stl' : 'step';
}

/** Evaluates a top-level `objCall` statement, lowering the function body to ops. */
function evalTopObjCall(
  stmt: Extract<TopLevelStatement, { kind: 'objCall' }>,
  ctx: EvalCtx,
): void {
  const fn = ctx.functions.get(stmt.call.name);
  if (!fn) {
    addError(ctx, `Unknown function '${stmt.call.name}'`, stmt.span);
    return;
  }
  const localDeferred: Deferred = [];
  const fnCtx = evalFunction(
    fn,
    stmt.call.args,
    stmt.call.namedArgs,
    ctx,
    localDeferred,
    null,
    null,
    stmt.span,
    functionCallNameSpan(stmt.call),
  );
  for (const op of localDeferred) ctx.ops.push(op);
  const objNames = collectBodyObjectNames(fn.body);
  if (objNames.length > 0) {
    ctx.names.set(stmt.name, fnCtx.names.get(objNames[0]) ?? objNames[0]);
  }
}

/** Evaluates a top-level `part` statement into a part boundary and body ops. */
function evalPartStmt(
  stmt: Extract<TopLevelStatement, { kind: 'part' }>,
  ctx: EvalCtx,
  exported = false,
): void {
  const usesThis = bodyUsesThis(stmt.body);
  const requiresPlacement = usesThis || bodyRequiresParentContext(stmt.body);
  if (exported && requiresPlacement) {
    addError(
      ctx,
      `Exported part '${stmt.name}' requires placement context; use 'export ref ${stmt.name} { ... }' for hidden reusable geometry`,
      stmt.span,
    );
    return;
  }
  if (usesThis) {
    return;
  }
  const partCtx = childCtx(ctx);
  const metadata = evaluatePartMetadata(stmt.body, partCtx);
  const color = metadata.color;
  ctx.ops.push({
    kind: 'part',
    name: stmt.name,
    color,
    span: toSpan(stmt.span),
  } satisfies IRPartBoundary);
  partCtx.activeColor = color ?? ctx.activeColor;
  partCtx.activeMaterial = metadata.material;
  partCtx.activePartName = stmt.name;
  evalComponentBody(stmt.body, partCtx);
  ctx.partsSnapshot.set(stmt.name, {
    names: partCtx.names,
    tags: partCtx.tags,
  });
}
