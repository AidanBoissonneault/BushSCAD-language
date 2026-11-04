/**
 * AST contract for if/else branch statements.
 */
import type { ASTSourceSpan } from '../sourceSpan.js';
import type { Expr } from '../expressions.js';
import type { ComponentBody } from './body.js';
/**
 * If statement, including operation kind, condition, then, else, and span.
 */
export type IfStatement = {
  kind: 'if';
  condition: Expr;
  then: ComponentBody;
  else: ComponentBody | null;
  span: ASTSourceSpan;
};
