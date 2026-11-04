/**
 * AST contract for a function invocation used as a statement.
 */
import type { ASTSourceSpan } from '../sourceSpan.js';
import type { FnCallExpr } from '../expressions.js';

/**
 * Call statement, including the invocation and its source span.
 */
export type CallStatement = {
  kind: 'callStmt';
  call: FnCallExpr;
  span: ASTSourceSpan;
};
