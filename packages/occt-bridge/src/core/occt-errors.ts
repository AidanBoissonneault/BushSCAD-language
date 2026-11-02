/**
 * @author Aidan Boissonneault
 * @file occt-errors.ts
 * @purpose Provides OpenCascade errors behavior for the core in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { OcctError, SourceSpan } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';

/**
 * Returns whether the input meets the `null shape` condition.
 */
export function isNullShape(shape: OC | null | undefined): boolean {
  return !shape || (typeof shape.IsNull === 'function' && shape.IsNull());
}

/**
 * Handles OpenCascade error in the core flow.
 */
export function occtError(
  message: string,
  span: SourceSpan,
): Error & OcctError {
  const err = new Error(message) as Error & OcctError & { __occtError: true };
  err.message = message;
  err.span = span;
  err.__occtError = true;
  return err;
}

/**
 * Returns whether the input meets the `OpenCascade error` condition.
 */
export function isOcctError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && '__occtError' in e;
}

/**
 * Handles describe unexpected OpenCascade exception in the core flow.
 */
export function describeUnexpectedOcctException(
  err: unknown,
  opKind: string,
): string {
  return `OCCT ${opKind} operation failed unexpectedly: ${rawErrorMessage(err)}`;
}

/**
 * Converts the supplied value into readable raw error text.
 */
export function rawErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Handles safe call in the core flow.
 */
export function safeCall<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
