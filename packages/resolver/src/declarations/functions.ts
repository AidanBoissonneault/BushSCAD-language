/**
 * @author Aidan Boissonneault
 * @file functions.ts
 * @purpose Provides functions behavior for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type { ComponentBody, ComponentStatement, FnDecl } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { addError } from '../core/errors.js';
import { resolveExpr } from '../references/expressions.js';
import { isSelectorNameValue } from '../references/selector-vars.js';

/**
 * Resolves function parameter defaults and validates supported return-block shape.
 */
export function resolveFn(stmt: FnDecl, scope: Scope, state: State): void {
  for (const param of stmt.params) {
    if (param.default && !isSelectorNameValue(param.default)) {
      resolveExpr(param.default, scope, state);
    }
  }
  validateFunctionReturnRules(stmt.body, state);
  validateNoMetadataAssignments(stmt.body, state);
}

/**
 * Validates function return rules and reports any violations.
 */
function validateFunctionReturnRules(body: ComponentBody, state: State): void {
  let returnCount = 0;
  body.statements.forEach((stmt, index) => {
    if (stmt.kind === 'return') {
      returnCount++;
      if (returnCount > 1) {
        addError(
          state,
          `Function body can contain at most one return block`,
          stmt.span,
        );
      }
      if (index !== body.statements.length - 1) {
        addError(
          state,
          `Function return block must be the final statement`,
          stmt.span,
        );
      }
      validateNoNestedReturnBlocks(stmt.body, state);
      return;
    }
    validateNestedFunctionReturns(stmt, state);
  });
}

/**
 * Validates no nested return blocks and reports any violations.
 */
function validateNoNestedReturnBlocks(body: ComponentBody, state: State): void {
  for (const stmt of body.statements) {
    if (stmt.kind === 'return') {
      addError(state, `Nested return blocks are not supported`, stmt.span);
      continue;
    }
    validateNestedFunctionReturns(stmt, state);
  }
}

/**
 * Validates nested function returns and reports any violations.
 */
function validateNestedFunctionReturns(
  stmt: ComponentStatement,
  state: State,
): void {
  switch (stmt.kind) {
    case 'fn':
      validateFunctionReturnRules(stmt.body, state);
      break;
    case 'for':
      validateNoNestedReturnBlocks(stmt.body, state);
      break;
    case 'if':
      validateNoNestedReturnBlocks(stmt.then, state);
      if (stmt.else) validateNoNestedReturnBlocks(stmt.else, state);
      break;
    default:
      break;
  }
}

/**
 * Validates no metadata assignments and reports any violations.
 */
function validateNoMetadataAssignments(
  body: ComponentBody,
  state: State,
): void {
  for (const stmt of body.statements) {
    if (stmt.kind === 'metadata') {
      const target = stmt.target.kind === 'part' ? 'part' : stmt.target.name;
      addError(
        state,
        `${target}.${stmt.property} is only valid as a direct statement inside a part body`,
        stmt.span,
      );
      continue;
    }
    if (stmt.kind === 'fn' || stmt.kind === 'return') {
      validateNoMetadataAssignments(stmt.body, state);
    } else if (stmt.kind === 'for') {
      validateNoMetadataAssignments(stmt.body, state);
    } else if (stmt.kind === 'if') {
      validateNoMetadataAssignments(stmt.then, state);
      if (stmt.else) validateNoMetadataAssignments(stmt.else, state);
    }
  }
}
