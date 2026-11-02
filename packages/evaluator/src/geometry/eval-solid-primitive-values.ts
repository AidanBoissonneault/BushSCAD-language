/**
 * @author Aidan Boissonneault
 * @file eval-solid-primitive-values.ts
 * @purpose Evaluates solid primitive values for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { Expr, SolidPrimitiveArg, SolidPrimitiveOp } from '@bushscad/ir';
import type { EvalCtx, EvalValue } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import { evalExpr, evalNum } from '../expressions/eval-expressions.js';

/**
 * Arg bag, including positional and named.
 */
export type ArgBag = {
  positional: SolidPrimitiveArg[];
  named: Map<string, SolidPrimitiveArg>;
};

/**
 * Handles arg bag in the geometry flow.
 */
export function argBag(args: SolidPrimitiveArg[]): ArgBag {
  return {
    positional: args.filter((arg) => arg.name === null),
    named: new Map(
      args
        .filter((arg) => arg.name !== null)
        .map((arg) => [arg.name as string, arg]),
    ),
  };
}

/**
 * Handles named in the geometry flow.
 */
export function named(
  args: ArgBag,
  names: string[],
): SolidPrimitiveArg | undefined {
  return names.map((name) => args.named.get(name)).find(Boolean);
}

/**
 * Evaluates arg with the current evaluation context.
 */
export function evalArg(
  args: ArgBag,
  ctx: EvalCtx,
  names: string[],
  index: number,
): EvalValue {
  const arg = named(args, names) ?? args.positional[index];
  return arg ? evalExpr(arg.value, ctx) : 0;
}

/**
 * Handles num arg in the geometry flow.
 */
export function numArg(
  args: ArgBag,
  ctx: EvalCtx,
  names: string[],
  index: number,
  fallback: number,
): number {
  const arg = named(args, names) ?? args.positional[index];
  return arg ? evalNum(arg.value, ctx) : fallback;
}

/**
 * Handles optional num in the geometry flow.
 */
export function optionalNum(
  args: ArgBag,
  ctx: EvalCtx,
  names: string[],
): number | undefined {
  const arg = named(args, names);
  return arg ? evalNum(arg.value, ctx) : undefined;
}

/**
 * Handles radius arg in the geometry flow.
 */
export function radiusArg(
  args: ArgBag,
  ctx: EvalCtx,
  positionalIndex: number,
): number {
  const d = named(args, ['d', 'diameter']);
  if (d) return evalNum(d.value, ctx) / 2;
  return numArg(args, ctx, ['radius', 'r'], positionalIndex, 1);
}

/**
 * Handles optional radius in the geometry flow.
 */
export function optionalRadius(
  args: ArgBag,
  ctx: EvalCtx,
  names: string[],
): number | undefined {
  const arg = named(args, names);
  if (!arg) return undefined;
  const value = evalNum(arg.value, ctx);
  return arg.name?.startsWith('d') || arg.name?.startsWith('diameter')
    ? value / 2
    : value;
}

/**
 * Handles size value in the geometry flow.
 */
export function sizeValue(expr: Expr, ctx: EvalCtx): [number, number, number] {
  const value = evalExpr(expr, ctx);
  if (typeof value === 'number') return [value, value, value];
  return vec3FromValue(value, [1, 1, 1]);
}

/**
 * Handles vec3 arg in the geometry flow.
 */
export function vec3Arg(
  args: ArgBag,
  ctx: EvalCtx,
  names: string[],
  fallback: [number, number, number],
): [number, number, number] {
  const arg = named(args, names) ?? args.positional[0];
  return arg ? vec3FromValue(evalExpr(arg.value, ctx), fallback) : fallback;
}

/**
 * Handles vec2 arg in the geometry flow.
 */
export function vec2Arg(
  args: ArgBag,
  ctx: EvalCtx,
  names: string[],
  fallback: [number, number],
): [number, number] {
  const arg = named(args, names) ?? args.positional[1];
  const value = arg ? evalExpr(arg.value, ctx) : fallback;
  return Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
    ? [value[0], value[1]]
    : fallback;
}

/**
 * Handles vec3 from value in the geometry flow.
 */
function vec3FromValue(
  value: EvalValue,
  fallback: [number, number, number],
): [number, number, number] {
  return Array.isArray(value) &&
    value.length >= 3 &&
    value.every((item) => typeof item === 'number')
    ? [value[0] as number, value[1] as number, value[2] as number]
    : fallback;
}

/**
 * Creates point geometry from the supplied coordinates.
 */
export function pointList(
  value: EvalValue,
  span: SolidPrimitiveOp['span'],
  ctx: EvalCtx,
): [number, number, number][] {
  if (!Array.isArray(value)) {
    addError(ctx, 'polyhedron points must be a list of [x, y, z] lists', span);
    return [];
  }
  return value.map((item) => vec3FromValue(item, [0, 0, 0]));
}

/**
 * Resolves the face data required by the current selector.
 */
export function faceList(
  value: EvalValue,
  span: SolidPrimitiveOp['span'],
  ctx: EvalCtx,
): number[][] {
  if (!Array.isArray(value)) {
    addError(ctx, 'polyhedron faces must be a list of index lists', span);
    return [];
  }
  return value.map((face) =>
    Array.isArray(face) ? face.map((i) => Math.round(Number(i))) : [],
  );
}

/**
 * Handles segments in the geometry flow.
 */
export function segments(args: ArgBag, ctx: EvalCtx): number {
  return Math.max(3, Math.round(numArg(args, ctx, ['segments', 'fn'], -1, 48)));
}

/**
 * Handles positive in the geometry flow.
 */
export function positive(
  value: number,
  label: string,
  span: SolidPrimitiveOp['span'],
  ctx: EvalCtx,
  allowZero = false,
): number {
  if (allowZero ? value < 0 : value <= 0)
    addError(
      ctx,
      `${label} must be ${allowZero ? 'non-negative' : 'positive'}`,
      span,
    );
  return value;
}

/**
 * Handles positive vec3 in the geometry flow.
 */
export function positiveVec3(
  value: [number, number, number],
  label: string,
  span: SolidPrimitiveOp['span'],
  ctx: EvalCtx,
): [number, number, number] {
  value.forEach((item) => positive(item, label, span, ctx));
  return value;
}

/**
 * Handles positive vec2 in the geometry flow.
 */
export function positiveVec2(
  value: [number, number],
  label: string,
  span: SolidPrimitiveOp['span'],
  ctx: EvalCtx,
): [number, number] {
  value.forEach((item) => positive(item, label, span, ctx));
  return value;
}
