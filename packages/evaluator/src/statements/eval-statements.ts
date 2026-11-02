/**
 * @author Aidan Boissonneault
 * @file eval-statements.ts
 * @purpose Evaluates statements for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

/**
 * Re-export barrel — consolidates the evaluator's statement execution modules.
 * Kept as a compatibility shim so eval-program.ts doesn't need import changes.
 */
export { emitSketchOp } from '../geometry/eval-op-emission.js';

export { evalBodyStatements, evalComponentBody } from './eval-body-stmts.js';

export { evalFunction } from './eval-body-stmts.js';
