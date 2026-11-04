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
 * Separates normalized positional slots from named aliases.
 *
 * Why:
 * Primitive overloads support labels interleaved with positional values. A
 * per-primitive slot schema lets labels claim their fields before positional
 * values fill the next unassigned field, and reports unknown or duplicate
 * labels instead of silently ignoring them.
 */
export type ArgBag = {
  positional: (SolidPrimitiveArg | undefined)[];
  named: Map<string, SolidPrimitiveArg>;
  roundedCuboidSizeForm?: boolean;
};

type PrimitiveArgSchema = string[][];
type NamedArgumentSlots = {
  named: Map<string, SolidPrimitiveArg>;
  occupiedSlots: Set<number>;
};

const PRIMITIVE_ARG_SCHEMAS: Record<
  SolidPrimitiveOp['primitive'],
  PrimitiveArgSchema
> = {
  cube: [
    ['size', 'width', 'x'],
    ['depth', 'y'],
    ['height', 'z'],
    ['radius', 'r'],
    ['segments', 'fn'],
  ],
  cuboid: [
    ['size', 'width', 'x'],
    ['depth', 'y'],
    ['height', 'z'],
    ['radius', 'r'],
    ['segments', 'fn'],
  ],
  roundedCuboid: [
    ['size', 'width', 'x'],
    ['depth', 'y'],
    ['height', 'z'],
    ['radius', 'r'],
    ['segments', 'fn'],
  ],
  sphere: [
    ['radius', 'r', 'diameter', 'd'],
    ['segments', 'fn'],
  ],
  geodesicSphere: [
    ['radius', 'r', 'diameter', 'd'],
    ['segments', 'fn'],
  ],
  ellipsoid: [
    ['radius', 'r'],
    ['segments', 'fn'],
  ],
  cylinder: [
    ['height', 'h'],
    ['radius', 'r', 'diameter', 'd'],
    ['radiusBottom', 'bottomRadius', 'r1', 'diameterBottom', 'd1'],
    ['radiusTop', 'topRadius', 'r2', 'diameterTop', 'd2'],
    ['segments', 'fn'],
  ],
  roundedCylinder: [
    ['height', 'h'],
    ['radius', 'r', 'diameter', 'd'],
    ['radiusBottom', 'bottomRadius', 'r1', 'diameterBottom', 'd1'],
    ['radiusTop', 'topRadius', 'r2', 'diameterTop', 'd2'],
    ['segments', 'fn'],
    ['roundingRadius', 'roundRadius', 'fillet'],
  ],
  cylinderElliptic: [
    ['height', 'h'],
    ['radius', 'r'],
    ['startRadius', 'radiusStart', 'r1'],
    ['endRadius', 'radiusEnd', 'r2'],
    ['segments', 'fn'],
  ],
  cone: [
    ['height', 'h'],
    ['radius', 'r', 'diameter', 'd'],
    ['segments', 'fn'],
  ],
  frustum: [
    ['height', 'h'],
    ['radiusBottom', 'bottomRadius', 'r1', 'diameterBottom', 'd1'],
    ['radiusTop', 'topRadius', 'r2', 'diameterTop', 'd2'],
    ['segments', 'fn'],
  ],
  torus: [
    ['majorRadius', 'outerRadius', 'ro'],
    ['minorRadius', 'innerRadius', 'ri'],
    ['segments', 'majorSegments', 'fn'],
    ['minorSegments', 'tubeSegments'],
  ],
  polyhedron: [['points'], ['faces', 'triangles']],
};

/**
 * Binds mixed primitive arguments to the slots declared for that primitive.
 *
 * Positional values fill the next free schema slot after named values have
 * claimed theirs, allowing callers to label only the fields that need clarity.
 */
export function argBag(op: SolidPrimitiveOp, ctx: EvalCtx): ArgBag {
  const { schema, roundedCuboidSizeForm } = primitiveArgSchema(op, ctx);
  const aliasesToSlot = createAliasSlots(schema);
  const namedArgs = bindNamedArgs(op, aliasesToSlot, ctx);
  const positional = bindPositionalArgs(
    op,
    schema,
    namedArgs.occupiedSlots,
    ctx,
  );
  return {
    positional,
    named: namedArgs.named,
    roundedCuboidSizeForm,
  };
}

/** Selects the declared parameter order, including the rounded cuboid overload. */
function primitiveArgSchema(
  op: SolidPrimitiveOp,
  ctx: EvalCtx,
): { schema: PrimitiveArgSchema; roundedCuboidSizeForm: boolean } {
  const roundedCuboidSizeForm =
    op.primitive === 'roundedCuboid' && usesRoundedCuboidSizeForm(op, ctx);
  return {
    schema: roundedCuboidSizeForm
      ? [['size'], ['radius', 'r'], ['segments', 'fn']]
      : PRIMITIVE_ARG_SCHEMAS[op.primitive],
    roundedCuboidSizeForm,
  };
}

/** Maps accepted argument labels to the canonical slot they select. */
function createAliasSlots(schema: PrimitiveArgSchema): Map<string, number> {
  return new Map(
    schema.flatMap((aliases, slot) =>
      aliases.map((alias) => [alias, slot] as const),
    ),
  );
}

/** Claims named slots once and reports invalid or repeated labels. */
function bindNamedArgs(
  op: SolidPrimitiveOp,
  aliasesToSlot: Map<string, number>,
  ctx: EvalCtx,
): NamedArgumentSlots {
  const named = new Map<string, SolidPrimitiveArg>();
  const occupiedSlots = new Set<number>();
  for (const arg of op.args) {
    if (arg.name === null) continue;
    const slot = aliasesToSlot.get(arg.name);
    if (slot === undefined) {
      addError(ctx, `Unknown ${op.primitive} argument '${arg.name}'`, arg.span);
      continue;
    }
    if (occupiedSlots.has(slot)) {
      addError(
        ctx,
        `Duplicate ${op.primitive} argument for '${arg.name}'`,
        arg.span,
      );
      continue;
    }
    occupiedSlots.add(slot);
    named.set(arg.name, arg);
  }
  return { named, occupiedSlots };
}

/** Fills free parameter slots with positional values in source order. */
function bindPositionalArgs(
  op: SolidPrimitiveOp,
  schema: PrimitiveArgSchema,
  occupiedSlots: Set<number>,
  ctx: EvalCtx,
): (SolidPrimitiveArg | undefined)[] {
  const positional: (SolidPrimitiveArg | undefined)[] = [];
  let nextSlot = 0;
  for (const arg of op.args) {
    if (arg.name !== null) continue;
    while (occupiedSlots.has(nextSlot)) nextSlot++;
    if (nextSlot >= schema.length) {
      addError(
        ctx,
        `Too many positional arguments for ${op.primitive}`,
        arg.span,
      );
      continue;
    }
    positional[nextSlot] = arg;
    occupiedSlots.add(nextSlot);
    nextSlot++;
  }
  return positional;
}

/** Chooses the roundedCuboid size or dimension overload before slot binding. */
function usesRoundedCuboidSizeForm(
  op: SolidPrimitiveOp,
  ctx: EvalCtx,
): boolean {
  const dimensionAliases = new Set(['width', 'x', 'depth', 'y', 'height', 'z']);
  const hasDimensionLabels = op.args.some(
    (arg) => arg.name !== null && dimensionAliases.has(arg.name),
  );
  const firstPositional = op.args.find((arg) => arg.name === null);
  const positionalCount = op.args.filter((arg) => arg.name === null).length;
  const sizeOverload =
    op.args.some((arg) => arg.name === 'size') ||
    (!hasDimensionLabels && positionalCount < 3) ||
    (!hasDimensionLabels &&
      firstPositional !== undefined &&
      Array.isArray(evalExpr(firstPositional.value, ctx)));
  return sizeOverload;
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
  positionalIndex = -1,
): number | undefined {
  const arg = named(args, names) ?? args.positional[positionalIndex];
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
  positionalIndex = -1,
): number | undefined {
  const arg = named(args, names) ?? args.positional[positionalIndex];
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
  positionalIndex = 1,
): [number, number] {
  const arg = named(args, names) ?? args.positional[positionalIndex];
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
export function segments(
  args: ArgBag,
  ctx: EvalCtx,
  positionalIndex = -1,
  names = ['segments', 'fn'],
): number {
  return Math.max(3, Math.round(numArg(args, ctx, names, positionalIndex, 48)));
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
