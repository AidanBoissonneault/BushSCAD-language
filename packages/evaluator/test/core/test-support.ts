/**
 * @author Aidan Boissonneault
 * @file test-support.ts
 * @purpose Tests test support behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IROp, IRSketch, MaterialContext } from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import { expect } from 'vitest';
import { evaluate } from '../../src/index.js';

/**
 * Handles no files in the core flow.
 */
export const noFiles = () => null;

/**
 * Resolves test source using the core rules.
 */
function resolveTestSource(src: string, loadAsset?: () => Uint8Array) {
  const parsed = parse(src, 'test.bscd');
  expect(
    parsed.errors,
    `parse errors: ${parsed.errors.map((e) => e.message).join(', ')}`,
  ).toHaveLength(0);
  const resolved = resolve(parsed.ast, 'test.bscd', noFiles, loadAsset);
  expect(
    resolved.errors,
    `resolve errors: ${resolved.errors.map((e) => e.message).join(', ')}`,
  ).toHaveLength(0);
  return resolved.ast;
}

/**
 * Evaluates ok with the current evaluation context.
 */
export function evalOk(
  src: string,
  options: { materials?: MaterialContext } = {},
) {
  const result = evaluate(resolveTestSource(src), options);
  expect(
    result.errors,
    `eval errors: ${result.errors.map((e) => e.message).join(', ')}`,
  ).toHaveLength(0);
  result.program.ops = result.program.ops.filter((op) => op.kind !== 'part');
  return result;
}

/**
 * Evaluates source and returns the emitted operation list.
 *
 * Why:
 * Many evaluator tests assert only IR operations, so this keeps the shared
 * parse/resolve/evaluate error handling in one place.
 */
export function evalOps(src: string): IROp[] {
  return evalOk(src).program.ops;
}

/**
 * Evaluates source and returns every emitted operation, including part markers.
 *
 * Why:
 * Most evaluator tests ignore part boundaries, but metadata tests need to
 * assert that part-level color and material defaults reach the boundary IR.
 */
export function evalOpsWithPartBoundaries(src: string): IROp[] {
  const result = evaluate(resolveTestSource(src));
  expect(
    result.errors,
    `eval errors: ${result.errors.map((e) => e.message).join(', ')}`,
  ).toHaveLength(0);
  return result.program.ops;
}

/**
 * Resolves source expected to fail during name/reference analysis.
 *
 * Why:
 * Some evaluator-facing tests assert resolver diagnostics before evaluation
 * should run, while still sharing parser setup and parse-error checks.
 */
export function resolveErrorMessages(src: string): string[] {
  const parsed = parse(src, 'test.bscd');
  const parseMessages = parsed.errors.map(({ message }) => message);
  expect(parseMessages, `parse errors: ${parseMessages.join(', ')}`).toEqual(
    [],
  );
  return resolve(parsed.ast, 'test.bscd', noFiles).errors.map(
    (error) => error.message,
  );
}

/**
 * Evaluates source that is expected to fail and returns evaluator errors.
 *
 * Why:
 * Negative evaluator tests need shared parse and resolve assertions while
 * preserving spans and other diagnostic metadata for focused assertions.
 */
export function evalErrors(src: string): ReturnType<typeof evaluate>['errors'] {
  return evaluate(resolveTestSource(src)).errors;
}

/**
 * Evaluates source that is expected to fail and returns evaluator messages.
 *
 * Why:
 * Negative evaluator tests still need shared parse and resolve assertions while
 * allowing the evaluator phase to produce diagnostics.
 */
export function evalErrorMessages(src: string): string[] {
  return evalErrors(src).map((error) => error.message);
}

/**
 * Handles ops of kind in the core flow.
 */
export function opsOfKind<T extends IROp>(ops: IROp[], kind: T['kind']): T[] {
  return ops.filter((op) => op.kind === kind) as T[];
}

/**
 * Derives `ProfileSketch` from `IRSketch & { primitive: Extract<IRSketch['primitive'], { kind:
 * 'profile' }>; }` to preserve its type relationship in the core layer.
 */
type ProfileSketch = IRSketch & {
  primitive: Extract<IRSketch['primitive'], { kind: 'profile' }>;
};

/**
 * Asserts that a sketch operation contains profile geometry and narrows it.
 *
 * Why:
 * Sketch evaluator tests repeatedly need the same runtime assertion before
 * inspecting profile segments, dimensions, and closed-body metadata.
 */
export function expectProfileSketch(
  sketch: IRSketch | undefined,
): ProfileSketch {
  expect(sketch?.primitive.kind).toBe('profile');
  if (!sketch || sketch.primitive.kind !== 'profile') {
    throw new Error('Expected a profile sketch');
  }
  return sketch as ProfileSketch;
}

/**
 * Evaluates ok with assets with the current evaluation context.
 */
export function evalOkWithAssets(src: string) {
  const result = evaluate(resolveTestSource(src, () => new Uint8Array([0])));
  expect(
    result.errors,
    `eval errors: ${result.errors.map((e) => e.message).join(', ')}`,
  ).toHaveLength(0);
  return result;
}
