/**
 * @author Aidan Boissonneault
 * @file eval-body-simple-stmts.ts
 * @purpose Evaluates body simple stmts for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ComponentStatement, IRPlacement } from '@bushscad/ir';
import { addError } from '../core/eval-context.js';
import type { EvalCtx } from '../core/eval-types.js';
import {
  evalEnvDecl,
  evalNum,
  evalPlacement,
} from '../expressions/eval-expressions.js';
import { emitSketchOp } from '../geometry/eval-op-emission.js';
import { evalJointDecl } from '../objects/eval-joint.js';
import { declareAnchorAlias } from '../references/eval-anchor-aliases.js';
import { evalVarValue } from '../references/eval-selector-vars.js';
import {
  evalAssertStmt,
  evalFitDeclInBody,
  evalUseLibraryInBody,
} from './eval-shared-statements.js';

/**
 * Evaluates direct body statements that do not recurse into child bodies.
 * These statements mutate the current evaluator context immediately, while
 * loop/function/place dispatch has to coordinate deferred operations.
 */
export function evalBodySimpleStmt(
  stmt: ComponentStatement,
  ctx: EvalCtx,
): boolean {
  switch (stmt.kind) {
    case 'var':
      ctx.values.set(stmt.name, evalVarValue(stmt.value, ctx));
      return true;
    case 'env':
      if (!ctx.values.has(stmt.name)) {
        ctx.values.set(stmt.name, evalEnvDecl(stmt, ctx));
      }
      return true;
    case 'use':
      evalUseLibraryInBody(stmt.library, ctx);
      return true;
    case 'sketch':
      emitSketchOp(stmt, ctx, ctx.names.get(stmt.name) ?? stmt.name);
      return true;
    case 'return':
      addError(
        ctx,
        `'return' can only be evaluated inside a function`,
        stmt.span,
      );
      return true;
    case 'assert':
      evalAssertStmt(stmt, ctx);
      return true;
    case 'fit':
      evalFitDeclInBody(stmt, ctx);
      return true;
    case 'joint':
      evalJointDecl(stmt, ctx);
      return true;
    case 'plane':
      evalPlaneStmt(stmt, ctx);
      return true;
    case 'metadata':
      return true;
    case 'anchor':
      declareAnchorAlias(stmt.name, stmt.point, ctx);
      return true;
    default:
      return false;
  }
}

/**
 * Evaluates plane stmt with the current evaluation context.
 */
function evalPlaneStmt(
  stmt: Extract<ComponentStatement, { kind: 'plane' }>,
  ctx: EvalCtx,
): void {
  const offsetDist = evalNum(stmt.offset, ctx);
  const parent = evalPlacement(stmt.from, ctx);
  const placement: IRPlacement = {
    ...parent,
    offsetZ: (parent.offsetZ ?? 0) + offsetDist,
  };
  ctx.values.set(stmt.name, placement);
}
