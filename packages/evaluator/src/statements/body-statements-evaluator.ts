/**
 * Callback contract for evaluating nested component bodies.
 *
 * Control-flow statement evaluators receive this callback so body sequencing
 * stays owned by the statements orchestrator.
 */
import type { ComponentBody } from '@bushscad/ir';
import type { Deferred, EvalCtx } from '../core/eval-types.js';

export type BodyStatementsEvaluator = (
  body: ComponentBody,
  ctx: EvalCtx,
  deferred: Deferred,
) => void;
