/**
 * AST contracts for function declarations and their named parameters.
 */
import type { ASTSourceSpan } from '../sourceSpan.js';
import type { Expr } from '../expressions.js';
import type { ComponentBody } from './body.js';
/**
 * Fn decl, including operation kind, name, params, body, and exported.
 */
export type FnDecl = {
  kind: 'fn';
  name: string;
  params: FnParam[];
  body: ComponentBody;
  exported: boolean;
  span: ASTSourceSpan;
};

/**
 * Fn param, including name and default.
 */
export type FnParam = {
  name: string;
  default: Expr | null;
};
