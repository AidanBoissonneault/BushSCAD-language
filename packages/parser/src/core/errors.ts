/**
 * @author Aidan Boissonneault
 * @file errors.ts
 * @purpose Provides errors behavior for the core in parser package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from '@bushscad/ir';

/**
 * Parse error, including message and span.
 */
export type ParseError = {
  message: string;
  span: ASTSourceSpan;
};

/**
 * Owns `ParseRecovery` state and behavior for the core layer.
 */
export class ParseRecovery extends Error {}
