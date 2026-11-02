/**
 * @author Aidan Boissonneault
 * @file index.ts
 * @purpose Public entry point for evaluator package.
 * @last-edited October 6, 2026
 */

/**
 * @bushscad/evaluator — public API barrel.
 *
 * Evaluates a resolved AST Program into a flat IRProgram.
 * All loops, conditionals, and variables are fully unrolled.
 */

export type {
  EvaluateResult,
  EvaluateOptions,
  EnvOverrideValue,
} from './core/eval-types.js';
export {
  FACE_WORDS,
  serializeFaceRefSegments,
  serializeFaceRef,
  asFaceRefValue,
  serializeAnchorTarget,
  evalFaceRefExpr,
  evalPlacement,
  evalPosToPlacement,
} from './references/eval-face-refs.js';
export { evaluate } from './core/eval-program.js';
export { operationAccess } from './pipeline/operation-access.js';
export type {
  OperationAccess,
  OperationSelectionUsage,
} from './pipeline/operation-access.js';
