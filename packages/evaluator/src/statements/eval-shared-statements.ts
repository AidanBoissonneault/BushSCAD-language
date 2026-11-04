/**
 * @author Aidan Boissonneault
 * @file eval-shared-statements.ts
 * @purpose Evaluates shared statements for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  AssertStatement,
  ComponentStatement,
  FitDecl,
  TopLevelStatement,
} from '@bushscad/ir';
import { addError, toSpan } from '../core/eval-context.js';
import type { EvalCtx } from '../core/eval-types.js';
import {
  buildIRAssert,
  tryEvalAssertCondition,
} from '../geometry/eval-geometry-queries.js';
import { evalObjOp, evalPathDecl } from '../geometry/eval-op-emission.js';
import { evalSurfaceDecl } from '../geometry/eval-surface.js';
import { evalFitDecl, evalUseLibrary } from '../objects/eval-fit.js';
import { declareAnchorAlias } from '../references/eval-anchor-aliases.js';
import { evalRefDecl } from '../references/eval-ref-decl.js';
import {
  evalMirror,
  evalPatternLinear,
  evalPatternRadial,
  evalRotate,
  evalTransform,
} from './eval-body-control-flow.js';

// Material application

/**
 * Evaluates statement kinds handled identically at top level and inside bodies.
 * Returns true if `stmt` was handled, false if the caller must handle it itself.
 */
export function evalSharedStmt(
  stmt: TopLevelStatement | ComponentStatement,
  ctx: EvalCtx,
): boolean {
  switch (stmt.kind) {
    case 'path':
      evalPathDecl(stmt, ctx);
      return true;
    case 'obj': {
      const irName = evalObjOp(stmt.name, stmt.operation, ctx);
      ctx.refBases.set(stmt.name, irName);
      for (const anchor of stmt.anchors) {
        declareAnchorAlias(anchor.name, anchor.point, ctx);
      }
      return true;
    }
    case 'refPart':
      if (stmt.extends) {
        evalRefDecl(stmt.name, stmt.extends, stmt.body, stmt.span, ctx);
      } else {
        ctx.components.set(stmt.name, stmt.body);
      }
      return true;
    case 'refObj': {
      const irName = evalObjOp(stmt.name, stmt.operation, ctx);
      ctx.ops.push({
        kind: 'declareShape',
        name: irName,
        span: toSpan(stmt.span),
      });
      ctx.refBases.set(stmt.name, irName);
      return true;
    }
    case 'rotate':
      evalRotate(stmt, ctx);
      return true;
    case 'patternLinear':
      evalPatternLinear(stmt, ctx);
      return true;
    case 'patternRadial':
      evalPatternRadial(stmt, ctx);
      return true;
    case 'mirror':
      evalMirror(stmt, ctx);
      return true;
    case 'transform':
      evalTransform(stmt, ctx);
      return true;
    case 'fn':
      ctx.functions.set(stmt.name, stmt);
      return true;
    case 'surface':
      evalSurfaceDecl(stmt, ctx);
      return true;
    default:
      return false;
  }
}

// Assert

/**
 * Evaluates assert stmt with the current evaluation context.
 */
export function evalAssertStmt(stmt: AssertStatement, ctx: EvalCtx): void {
  const result = tryEvalAssertCondition(stmt.condition, ctx);

  if (result !== null) {
    // Fully resolved at compile time.
    if (!result) {
      const msg = stmt.message ?? 'Assertion failed';
      addError(
        ctx,
        `${stmt.severity === 'warning' ? 'Warning: ' : ''}${msg}`,
        stmt.span,
      );
    }
    // When the condition passes, no op emitted.
    return;
  }

  // Could not determine at compile time (OCCT-deferred). Emit IRAssert for post-build.
  const irAssert = buildIRAssert(stmt, ctx);
  if (irAssert) {
    ctx.ops.push(irAssert);
  } else {
    // Condition is too complex to represent as IRAssert — skip silently.
    addError(
      ctx,
      `assert condition too complex for deferred evaluation; simplify to a direct comparison`,
      stmt.span,
    );
  }
}

// Fit / tolerance

/**
 * Evaluates fit declaration in body with the current evaluation context.
 */
export function evalFitDeclInBody(stmt: FitDecl, ctx: EvalCtx): void {
  evalFitDecl(stmt, ctx);
}

/**
 * Evaluates use library in body with the current evaluation context.
 */
export function evalUseLibraryInBody(library: string, ctx: EvalCtx): void {
  evalUseLibrary(library, ctx);
}
