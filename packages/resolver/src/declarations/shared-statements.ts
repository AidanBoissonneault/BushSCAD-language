/** Dispatches statement behavior shared by top-level and component scopes. */
import { resolveDefeature } from './defeature/resolve-defeature.js';
import { resolveHeal } from './heal/resolve-heal.js';
import { resolveUse } from './use/resolve-use.js';
import { resolveThread } from './thread/resolve-thread.js';
import { resolveShell } from './shell/resolve-shell.js';
import type {
  ComponentStatement,
  DefeatureDecl,
  HealDecl,
  JointDecl,
  MirrorStmt,
  PatternLinearStmt,
  PatternRadialStmt,
  RotateStatement,
  TopLevelStatement,
  TransformStmt,
} from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { resolveExpr } from '../references/expressions.js';
import { resolveChamferDetail } from './chamfer/resolve-chamfer.js';
import { resolveDraftDetail } from './draft/resolve-draft.js';
import { resolveFilletDetail } from './fillet/resolve-fillet.js';
import { resolvePatternLinear } from './pattern-linear/resolve-pattern-linear.js';
import { resolvePatternRadial } from './pattern-radial/resolve-pattern-radial.js';
import { resolveMirror } from './mirror/resolve-mirror.js';
import { resolveRotate } from './rotate/resolve-rotate.js';
import { resolveTransform } from './transform/resolve-transform.js';
import { resolveJoint } from './joint/resolve-joint.js';

/**
 * Resolves statement kinds handled identically at top level and inside bodies.
 * Returns true if `stmt` was handled, false if the caller must handle it itself.
 */
export type Statement = TopLevelStatement | ComponentStatement;

/**
 * Defines the `SharedResolver` callback contract used by the declarations layer.
 */
type SharedResolver = (stmt: Statement, scope: Scope, state: State) => void;

const SHARED_STMT_RESOLVERS: Partial<
  Record<Statement['kind'], SharedResolver>
> = {
  fillet: (stmt, scope, state) =>
    resolveFilletDetail(
      stmt as Extract<Statement, { kind: 'fillet' }>,
      scope,
      state,
    ),
  chamfer: (stmt, scope, state) =>
    resolveChamferDetail(
      stmt as Extract<Statement, { kind: 'chamfer' }>,
      scope,
      state,
    ),
  draft: (stmt, scope, state) =>
    resolveDraftDetail(
      stmt as Extract<Statement, { kind: 'draft' }>,
      scope,
      state,
    ),
  shell: (stmt, scope, state) =>
    resolveShell(stmt as ComponentStatement, scope, state),
  thread: (stmt, scope, state) =>
    resolveThread(stmt as ComponentStatement, scope, state),
  heal: (stmt, scope, state) => resolveHeal(stmt as HealDecl, scope, state),
  defeature: (stmt, scope, state) =>
    resolveDefeature(stmt as DefeatureDecl, scope, state),
  use: resolveUse,
  fit: (stmt, scope) =>
    scope.define((stmt as Extract<Statement, { kind: 'fit' }>).fitName, 'fit'),
  rotate: (stmt, scope, state) =>
    resolveRotate(stmt as RotateStatement, scope, state),
  patternLinear: (stmt, scope, state) =>
    resolvePatternLinear(stmt as PatternLinearStmt, scope, state),
  patternRadial: (stmt, scope, state) =>
    resolvePatternRadial(stmt as PatternRadialStmt, scope, state),
  mirror: (stmt, scope, state) =>
    resolveMirror(stmt as MirrorStmt, scope, state),
  transform: (stmt, scope, state) =>
    resolveTransform(stmt as TransformStmt, scope, state),
  assert: (stmt, scope, state) =>
    resolveExpr(
      (stmt as Extract<Statement, { kind: 'assert' }>).condition,
      scope,
      state,
    ),
  joint: (stmt, scope, state) => resolveJoint(stmt as JointDecl, scope, state),
};

/**
 * Resolves statement kinds handled identically at top level and inside bodies.
 * Returns true if `stmt` was handled, false if the caller must handle it itself.
 */
export function resolveSharedStmt(
  stmt: Statement,
  scope: Scope,
  state: State,
): boolean {
  const resolver = SHARED_STMT_RESOLVERS[stmt.kind];
  if (!resolver) return false;
  resolver(stmt, scope, state);
  return true;
}
