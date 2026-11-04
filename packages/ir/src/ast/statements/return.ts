/**
 * AST contract for return bodies inside user-defined functions.
 */
import type { ASTSourceSpan } from '../sourceSpan.js';
import type { ComponentBody } from './body.js';
/**
 * Return statement, including operation kind, body, and span.
 */
export type ReturnStatement = {
  kind: 'return';
  body: ComponentBody;
  span: ASTSourceSpan;
};
