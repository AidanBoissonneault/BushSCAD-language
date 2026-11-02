/**
 * @author Aidan Boissonneault
 * @file eval-body-modifier-stmts.ts
 * @purpose Evaluates body modifier stmts for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ComponentStatement,
  IRChamfer,
  IRDefeature,
  IRDraft,
  IRFillet,
  IRHeal,
  IRShell,
  IRThread,
} from '@bushscad/ir';
import { addError, toSpan } from '../core/eval-context.js';
import type { Deferred, EvalCtx } from '../core/eval-types.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { objectTargetNames } from '../objects/eval-object-arrays.js';
import { evalRepeatableSelectionTargets } from '../references/eval-repeatable-refs.js';
import { paramSpansFrom } from './eval-param-spans.js';

/**
 * Evaluates body statements that emit deferred geometry modifiers.
 * Blend, shell, thread, heal, and defeature statements all lower to operation
 * records, but they do not affect lexical flow or nested body evaluation.
 */
export function evalBodyModifierStmt(
  stmt: ComponentStatement,
  ctx: EvalCtx,
  deferred: Deferred,
): boolean {
  switch (stmt.kind) {
    case 'heal':
      evalHealStmt(stmt, ctx);
      return true;
    case 'defeature':
      evalDefeatureStmt(stmt, ctx);
      return true;
    case 'fillet':
      emitFilletStmt(stmt, ctx, deferred);
      return true;
    case 'chamfer':
      emitChamferStmt(stmt, ctx, deferred);
      return true;
    case 'draft':
      emitDraftStmt(stmt, ctx, deferred);
      return true;
    case 'thread':
      emitThreadStmt(stmt, ctx);
      return true;
    case 'shell':
      emitShellStmt(stmt, ctx);
      return true;
    default:
      return false;
  }
}

/**
 * Evaluates heal stmt with the current evaluation context.
 */
function evalHealStmt(
  stmt: Extract<ComponentStatement, { kind: 'heal' }>,
  ctx: EvalCtx,
): void {
  const healTarget = stmt.target
    ? (ctx.names.get(stmt.target) ?? stmt.target)
    : '';
  if (!healTarget) {
    addError(
      ctx,
      `'heal' requires a target name outside a ref block`,
      stmt.span,
    );
    return;
  }
  ctx.ops.push({
    kind: 'heal',
    target: healTarget,
    tolerance: evalNum(stmt.tolerance, ctx),
    span: toSpan(stmt.span),
  } satisfies IRHeal);
}

/**
 * Evaluates defeature stmt with the current evaluation context.
 */
function evalDefeatureStmt(
  stmt: Extract<ComponentStatement, { kind: 'defeature' }>,
  ctx: EvalCtx,
): void {
  const dfTarget = stmt.target
    ? (ctx.names.get(stmt.target) ?? stmt.target)
    : '';
  if (!dfTarget) {
    addError(
      ctx,
      `'defeature' requires a target name outside a ref block`,
      stmt.span,
    );
    return;
  }
  ctx.ops.push({
    kind: 'defeature',
    target: dfTarget,
    featureType: stmt.featureType,
    threshold: evalNum(stmt.threshold, ctx),
    span: toSpan(stmt.span),
  } satisfies IRDefeature);
}

/**
 * Emits fillet stmt into the current output.
 */
function emitFilletStmt(
  stmt: Extract<ComponentStatement, { kind: 'fillet' }>,
  ctx: EvalCtx,
  deferred: Deferred,
): void {
  for (const selection of evalRepeatableSelectionTargets(
    stmt.target,
    ctx,
    'fillet',
  )) {
    deferred.push({
      kind: 'fillet',
      target: selection.label,
      selection,
      radius: evalNum(stmt.radius, ctx),
      paramSpans: paramSpansFrom({ radius: stmt.radius }),
      span: toSpan(stmt.span),
    } satisfies IRFillet);
  }
}

/**
 * Emits chamfer stmt into the current output.
 */
function emitChamferStmt(
  stmt: Extract<ComponentStatement, { kind: 'chamfer' }>,
  ctx: EvalCtx,
  deferred: Deferred,
): void {
  for (const selection of evalRepeatableSelectionTargets(
    stmt.target,
    ctx,
    'chamfer',
  )) {
    deferred.push({
      kind: 'chamfer',
      target: selection.label,
      selection,
      offset: evalNum(stmt.offset, ctx),
      paramSpans: paramSpansFrom({ offset: stmt.offset }),
      span: toSpan(stmt.span),
    } satisfies IRChamfer);
  }
}

/**
 * Emits draft stmt into the current output.
 */
function emitDraftStmt(
  stmt: Extract<ComponentStatement, { kind: 'draft' }>,
  ctx: EvalCtx,
  deferred: Deferred,
): void {
  for (const selection of evalRepeatableSelectionTargets(
    stmt.target,
    ctx,
    'draft',
  )) {
    deferred.push({
      kind: 'draft',
      target: selection.label,
      selection,
      angleDeg: evalNum(stmt.angle, ctx),
      paramSpans: paramSpansFrom({ angleDeg: stmt.angle }),
      span: toSpan(stmt.span),
    } satisfies IRDraft);
  }
}

/**
 * Emits thread stmt into the current output.
 */
function emitThreadStmt(
  stmt: Extract<ComponentStatement, { kind: 'thread' }>,
  ctx: EvalCtx,
): void {
  for (const threadTarget of objectTargetNames(stmt.target, ctx)) {
    const cutThread = ctx.cutThreads.get(threadTarget);
    ctx.ops.push({
      kind: 'thread',
      target: threadTarget,
      threadType: stmt.threadType,
      diameterMm: evalNum(stmt.diameter, ctx),
      pitchMm: evalNum(stmt.pitch, ctx),
      axis: cutThread?.placement ?? null,
      axialExtentMm: stmt.length
        ? evalNum(stmt.length, ctx)
        : (cutThread?.depthMm ?? null),
      direction: stmt.direction,
      threadAngleDeg: stmt.angle ? evalNum(stmt.angle, ctx) : null,
      span: toSpan(stmt.span),
    } satisfies IRThread);
  }
}

/**
 * Emits shell stmt into the current output.
 */
function emitShellStmt(
  stmt: Extract<ComponentStatement, { kind: 'shell' }>,
  ctx: EvalCtx,
): void {
  for (const objIrName of objectTargetNames(stmt.target, ctx)) {
    ctx.ops.push({
      kind: 'shell',
      objName: objIrName,
      thickness: evalNum(stmt.thickness, ctx),
      openFaces: stmt.openFaces,
      paramSpans: paramSpansFrom({ thickness: stmt.thickness }),
      span: toSpan(stmt.span),
    } satisfies IRShell);
  }
}
