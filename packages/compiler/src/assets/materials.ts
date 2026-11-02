/**
 * @author Aidan Boissonneault
 * @file materials.ts
 * @purpose Provides materials behavior for the assets in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  CompileError,
  MaterialAppearance,
  MaterialContext,
  MaterialTexture,
  SourceSpan,
} from '@bushscad/ir';
import {
  BUILTIN_MATERIALS,
  DEFAULT_MATERIAL_TEXTURE,
  findMaterialByName,
  normalizeMaterialKey,
} from '@bushscad/ir';
import { normalizePath } from '../core/paths.js';

/**
 * Builds the material catalog and assignment context from workspace assets.
 *
 * Materials may come from built-ins and project materials.json files. The
 * evaluator needs one normalized context to apply appearance consistently.
 */
const MATERIAL_TEXTURES: Set<MaterialTexture> = new Set([
  'printed-plastic',
  'fdm-layer',
  'matte',
  'satin',
  'gloss',
  'silk',
  'translucent',
  'clear',
  'rubber',
  'powder',
  'fiber',
  'wood',
  'metal',
  'marble',
  'glitter',
  'glow',
]);

const MATERIAL_RESERVED_KEYS = new Set([
  'version',
  'assignments',
  'filaments',
  'materials',
]);

/**
 * Accepted values for optional material number key are 'opacity', 'reflectivity', 'clearcoat',
 * 'clearcoatRoughness', 'transmission', 'ior', 'thickness', and 'envMapIntensity'.
 */
type OptionalMaterialNumberKey =
  | 'opacity'
  | 'reflectivity'
  | 'clearcoat'
  | 'clearcoatRoughness'
  | 'transmission'
  | 'ior'
  | 'thickness'
  | 'envMapIntensity';

const OPTIONAL_MATERIAL_NUMBERS: {
  key: OptionalMaterialNumberKey;
  min?: number;
  max?: number;
}[] = [
  { key: 'opacity' },
  { key: 'reflectivity', min: 0, max: 1 },
  { key: 'clearcoat', min: 0, max: 1 },
  { key: 'clearcoatRoughness', min: 0, max: 1 },
  { key: 'transmission', min: 0, max: 1 },
  { key: 'ior', min: 1, max: 2.333 },
  { key: 'thickness', min: 0 },
  { key: 'envMapIntensity', min: 0 },
];

/**
 * Returns whether the input meets the `record` condition.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Builds the material data required by the current operation.
 */
function materialAssetSpan(path: string): SourceSpan {
  return { file: path, line: 1, col: 1 };
}

/**
 * Returns whether the input meets the `materials asset` condition.
 */
function isMaterialsAsset(path: string): boolean {
  return (
    normalizePath(path).toLowerCase().endsWith('/materials.json') ||
    normalizePath(path).toLowerCase() === 'materials.json'
  );
}

/**
 * Reads json asset from the supplied source.
 */
function readJsonAsset(
  path: string,
  loadAsset: ((path: string) => Uint8Array | null) | undefined,
): { ok: true; value: unknown } | { ok: false; error: CompileError } {
  const data = loadAsset?.(path) ?? null;
  if (data === null) {
    return {
      ok: false,
      error: {
        message: `Cannot load materials asset '${path}'`,
        span: materialAssetSpan(path),
      },
    };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(new TextDecoder().decode(data)) as unknown,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        message: `Invalid materials JSON '${path}': ${error instanceof Error ? error.message : String(error)}`,
        span: materialAssetSpan(path),
      },
    };
  }
}

/**
 * Handles coerce number in the assets flow.
 */
function coerceNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Handles coerce optional number in the assets flow.
 */
function coerceOptionalNumber(
  value: unknown,
  min = -Infinity,
  max = Infinity,
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < min || value > max) return undefined;
  return value;
}

/**
 * Handles coerce texture in the assets flow.
 */
function coerceTexture(value: unknown): MaterialTexture {
  return typeof value === 'string' &&
    MATERIAL_TEXTURES.has(value as MaterialTexture)
    ? (value as MaterialTexture)
    : DEFAULT_MATERIAL_TEXTURE;
}

/**
 * Builds the material data required by the current operation.
 */
function materialFromFilament(
  record: Record<string, unknown>,
  path: string,
):
  | { ok: true; material: MaterialAppearance }
  | { ok: false; error: CompileError } {
  const name = typeof record.name === 'string' ? record.name : null;
  const color = typeof record.color === 'string' ? record.color : null;
  if (!name || !color) {
    return {
      ok: false,
      error: {
        message: `Filament entries in '${path}' require string 'name' and 'color' fields`,
        span: materialAssetSpan(path),
      },
    };
  }

  const id =
    typeof record.id === 'string' && record.id.trim()
      ? record.id.trim()
      : normalizeMaterialKey(name);
  const material: MaterialAppearance = {
    id,
    name,
    color,
    texture: coerceTexture(record.texture),
    roughness: coerceNumber(record.roughness, 0.48),
    metalness: coerceNumber(record.metalness, 0),
  };
  applyOptionalMaterialNumbers(material, record);

  return {
    ok: true,
    material,
  };
}

/**
 * Applies optional material numbers to the supplied state or geometry.
 */
function applyOptionalMaterialNumbers(
  material: MaterialAppearance,
  record: Record<string, unknown>,
): void {
  for (const { key, min, max } of OPTIONAL_MATERIAL_NUMBERS) {
    const value = coerceOptionalNumber(record[key], min, max);
    if (value !== undefined) material[key] = value;
  }
}

/**
 * Collects assignments from the supplied values.
 */
function collectAssignments(
  value: unknown,
  catalog: MaterialAppearance[],
  path: string,
): { assignments: MaterialContext['assignments']; errors: CompileError[] } {
  const assignments: MaterialContext['assignments'] = [];
  const errors: CompileError[] = [];
  if (!isRecord(value)) {
    errors.push({
      message: `Materials assignments in '${path}' must be an object`,
      span: materialAssetSpan(path),
    });
    return { assignments, errors };
  }

  for (const [target, materialName] of Object.entries(value)) {
    if (typeof materialName !== 'string') {
      errors.push({
        message: `Material assignment '${target}' in '${path}' must reference a material name`,
        span: materialAssetSpan(path),
      });
      continue;
    }

    const material = findMaterialByName(catalog, materialName);
    if (!material) {
      errors.push({
        message: `Unknown material '${materialName}' assigned to '${target}' in '${path}'`,
        span: materialAssetSpan(path),
      });
      continue;
    }

    assignments.push({ target, material });
  }

  return { assignments, errors };
}

/**
 * Material context build, including catalog, assignments, and errors.
 */
type MaterialContextBuild = {
  catalog: MaterialAppearance[];
  assignments: MaterialContext['assignments'];
  errors: CompileError[];
};

/**
 * Collects material context from the supplied values.
 */
export function collectMaterialContext(
  assetPaths: string[],
  loadAsset: ((path: string) => Uint8Array | null) | undefined,
): { context: MaterialContext; errors: CompileError[] } {
  const catalog = BUILTIN_MATERIALS.map((material) => ({ ...material }));
  const assignments: MaterialContext['assignments'] = [];
  const errors: CompileError[] = [];

  for (const path of assetPaths.filter(isMaterialsAsset)) {
    collectMaterialAsset(path, loadAsset, { catalog, assignments, errors });
  }

  return { context: { catalog, assignments }, errors };
}

/**
 * Collects material asset from the supplied values.
 */
function collectMaterialAsset(
  path: string,
  loadAsset: ((path: string) => Uint8Array | null) | undefined,
  build: MaterialContextBuild,
): void {
  const value = readMaterialAssetRecord(path, loadAsset, build.errors);
  if (!value) return;
  collectFilamentMaterials(value.filaments, path, build);
  const result = collectAssignments(
    materialAssignmentValue(value),
    build.catalog,
    path,
  );
  build.assignments.push(...result.assignments);
  build.errors.push(...result.errors);
}

/**
 * Reads material asset record from the supplied source.
 */
function readMaterialAssetRecord(
  path: string,
  loadAsset: ((path: string) => Uint8Array | null) | undefined,
  errors: CompileError[],
): Record<string, unknown> | null {
  const parsed = readJsonAsset(path, loadAsset);
  if (!parsed.ok) {
    errors.push(parsed.error);
    return null;
  }
  if (isRecord(parsed.value)) return parsed.value;
  errors.push({
    message: `Materials JSON '${path}' must contain an object`,
    span: materialAssetSpan(path),
  });
  return null;
}

/**
 * Collects filament materials from the supplied values.
 */
function collectFilamentMaterials(
  filamentValue: unknown,
  path: string,
  build: MaterialContextBuild,
): void {
  if (filamentValue === undefined) return;
  if (!Array.isArray(filamentValue)) {
    build.errors.push({
      message: `Materials 'filaments' in '${path}' must be an array`,
      span: materialAssetSpan(path),
    });
    return;
  }
  for (const entry of filamentValue)
    collectFilamentMaterial(entry, path, build);
}

/**
 * Collects filament material from the supplied values.
 */
function collectFilamentMaterial(
  entry: unknown,
  path: string,
  build: MaterialContextBuild,
): void {
  if (!isRecord(entry)) {
    build.errors.push({
      message: `Filament entries in '${path}' must be objects`,
      span: materialAssetSpan(path),
    });
    return;
  }
  const material = materialFromFilament(entry, path);
  if (material.ok) build.catalog.push(material.material);
  else build.errors.push(material.error);
}

/**
 * Builds the material data required by the current operation.
 */
function materialAssignmentValue(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return isRecord(value.assignments)
    ? value.assignments
    : Object.fromEntries(
        Object.entries(value).filter(
          ([key, entry]) =>
            !MATERIAL_RESERVED_KEYS.has(key) && typeof entry === 'string',
        ),
      );
}
