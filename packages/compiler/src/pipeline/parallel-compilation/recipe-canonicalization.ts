/**
 * @author Aidan Boissonneault
 * @file recipe-canonicalization.ts
 * @purpose Provides recipe canonicalization behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { IROp, IRProgram } from '@bushscad/ir';
import { stableDigest, stableStringify } from './stable-serialization.js';

/**
 * Type used for context for recipe.
 */
export type RecipeContext = Readonly<{
  program: Pick<IRProgram, 'baseUnitMm' | 'workplane'>;
  dependencyDigests: ReadonlyMap<string, string>;
  assetDigests?: Readonly<Record<string, string>>;
}>;

/**
 * Type used for canonical recipe.
 */
export type CanonicalRecipe = Readonly<{
  digest: string;
  canonical: string;
  cacheSafe: boolean;
}>;

type RecipeDescriptor = {
  value: Readonly<Record<string, unknown>>;
  cacheSafe: boolean;
};

/** Canonicalizes local geometry while excluding authored semantic identity. */
export function canonicalRecipe(
  op: IROp,
  context: RecipeContext,
): CanonicalRecipe | null {
  const common = {
    schema: 1,
    baseUnitMm: context.program.baseUnitMm,
    workplane: context.program.workplane ?? 'XY',
  };
  const descriptor = recipeDescriptor(op, context);
  if (!descriptor) return null;
  const canonical = stableStringify({ ...common, ...descriptor.value });
  return {
    canonical,
    digest: stableDigest(canonical),
    cacheSafe: descriptor.cacheSafe,
  };
}

/** Dispatches each operation to its domain-specific recipe description. */
function recipeDescriptor(
  op: IROp,
  context: RecipeContext,
): RecipeDescriptor | null {
  return (
    primitiveRecipeDescriptor(op, context) ??
    sweptRecipeDescriptor(op, context) ??
    surfaceRecipeDescriptor(op, context)
  );
}

/** Describes source shapes and imported assets without authored identity. */
function primitiveRecipeDescriptor(
  op: IROp,
  context: RecipeContext,
): RecipeDescriptor | null {
  switch (op.kind) {
    case 'sketch':
      return entry({
        kind: op.kind,
        primitive: op.primitive,
        surfaceBound: op.surfaceBound,
      });
    case 'path':
      return entry({ kind: op.kind, primitive: op.primitive });
    case 'solidPrimitive':
      return entry({ kind: op.kind, shape: op.shape });
    case 'importShape': {
      const digest = context.assetDigests?.[op.fsPath];
      return entry(
        { kind: op.kind, format: op.format, assetDigest: digest ?? op.fsPath },
        digest !== undefined,
      );
    }
    case 'hardware_visual':
      return entry({
        kind: op.kind,
        hardwareKind: op.hardwareKind,
        diameterMm: op.diameterMm,
        heightMm: op.heightMm,
        headDiameterMm: op.headDiameterMm,
        headHeightMm: op.headHeightMm,
        placement: op.placement,
      });
    default:
      return null;
  }
}

/** Describes profile-based operations using the recipes of their inputs. */
function sweptRecipeDescriptor(
  op: IROp,
  context: RecipeContext,
): RecipeDescriptor | null {
  switch (op.kind) {
    case 'extrude':
      return entry({
        kind: op.kind,
        sketch: dependency(op.sketchName, context),
        closedBodyNames: op.closedBodyNames,
        depth: op.depth,
        from: op.from,
        symmetric: op.symmetric,
        wrap: op.wrap,
      });
    case 'revolve':
      return entry({
        kind: op.kind,
        sketch: dependency(op.sketchName, context),
        angleDeg: op.angleDeg,
        around: op.around,
        radius: op.radius,
      });
    case 'radial_extrude':
      return entry({
        kind: op.kind,
        sketch: dependency(op.sketchName, context),
        axis: op.axis,
        extent: op.extent,
        curve: op.curve,
        direction: op.direction,
        startDeg: op.startDeg,
        twistDeg: op.twistDeg,
        taperDeg: op.taperDeg,
        radius: op.radius,
        sections: op.sections,
        from: op.from,
      });
    case 'loft':
      return entry({
        kind: op.kind,
        sketches: op.sketchNames.map((name) => dependency(name, context)),
        height: op.height,
        guide: op.guide ? dependency(op.guide, context) : null,
        guideWorkplane: op.guideWorkplane,
      });
    case 'sweep':
      return entry({
        kind: op.kind,
        sketch: dependency(op.sketchName, context),
        path: dependency(op.pathName, context),
        orientation: op.orientation,
      });
    default:
      return null;
  }
}

/** Describes surface constructors and modifications as cacheable recipes. */
function surfaceRecipeDescriptor(
  op: IROp,
  context: RecipeContext,
): RecipeDescriptor | null {
  switch (op.kind) {
    case 'surface':
      return entry({
        kind: op.kind,
        boundary: op.boundary,
        selection: op.selection,
      });
    case 'surfaceOffset':
      return entry({
        kind: op.kind,
        source: dependency(op.source, context),
        distance: op.distance,
      });
    case 'surfaceThicken':
      return entry({
        kind: op.kind,
        surface: dependency(op.surfaceName, context),
        thickness: op.thickness,
      });
    default:
      return null;
  }
}

/** Resolves a dependency to its recipe digest or its named entity fallback. */
function dependency(name: string, context: RecipeContext): string {
  return context.dependencyDigests.get(name) ?? `entity:${name}`;
}

/** Wraps a canonical value with the cache-safety decision for its source. */
function entry(
  value: Readonly<Record<string, unknown>>,
  cacheSafe = true,
): RecipeDescriptor {
  return { value, cacheSafe };
}
