/**
 * @author Aidan Boissonneault
 * @file materials.ts
 * @purpose Provides materials behavior for the materials in IR package.
 * @last-edited October 6, 2026
 */

import type {
  MaterialAppearance,
  MaterialContext,
  MaterialTexture,
} from '../shared/ir.js';

export const DEFAULT_MATERIAL_TEXTURE: MaterialTexture = 'printed-plastic';

export const BUILTIN_MATERIALS: MaterialAppearance[] = [
  {
    id: 'blue-anodized-aluminum',
    name: 'blue anodized aluminum',
    color: '#2563EB',
    texture: 'metal',
    roughness: 0.28,
    metalness: 0.75,
  },
  {
    id: 'green-acrylic',
    name: 'green acrylic',
    color: '#16A34A',
    texture: 'translucent',
    roughness: 0.18,
    metalness: 0,
    opacity: 0.72,
  },
  {
    id: 'dark-rubber',
    name: 'dark rubber',
    color: '#1F2937',
    texture: 'rubber',
    roughness: 0.86,
    metalness: 0,
  },

  {
    id: 'pla',
    name: 'PLA',
    color: '#F4F1E8',
    texture: 'fdm-layer',
    roughness: 0.48,
    metalness: 0,
  },
  {
    id: 'matte-pla',
    name: 'matte PLA',
    color: '#6B7280',
    texture: 'matte',
    roughness: 0.82,
    metalness: 0,
  },
  {
    id: 'silk-pla',
    name: 'silk PLA',
    color: '#D946EF',
    texture: 'silk',
    roughness: 0.22,
    metalness: 0.08,
  },
  {
    id: 'petg',
    name: 'PETG',
    color: '#38BDF8',
    texture: 'satin',
    roughness: 0.34,
    metalness: 0,
  },
  {
    id: 'abs',
    name: 'ABS',
    color: '#F97316',
    texture: 'satin',
    roughness: 0.46,
    metalness: 0,
  },
  {
    id: 'asa',
    name: 'ASA',
    color: '#64748B',
    texture: 'matte',
    roughness: 0.58,
    metalness: 0,
  },
  {
    id: 'tpu',
    name: 'TPU',
    color: '#111827',
    texture: 'rubber',
    roughness: 0.78,
    metalness: 0,
  },
  {
    id: 'nylon',
    name: 'nylon',
    color: '#F2E7D2',
    texture: 'matte',
    roughness: 0.66,
    metalness: 0,
  },
  {
    id: 'polycarbonate',
    name: 'polycarbonate',
    color: '#D1F3FF',
    texture: 'translucent',
    roughness: 0.22,
    metalness: 0,
    opacity: 0.62,
  },
  {
    id: 'standard-resin',
    name: 'standard resin',
    color: '#94A3B8',
    texture: 'gloss',
    roughness: 0.18,
    metalness: 0,
  },
  {
    id: 'clear-resin',
    name: 'clear resin',
    color: '#E0F2FE',
    texture: 'clear',
    roughness: 0.04,
    metalness: 0,
    opacity: 0.34,
  },
  {
    id: 'tough-resin',
    name: 'tough resin',
    color: '#F59E0B',
    texture: 'gloss',
    roughness: 0.24,
    metalness: 0,
  },
  {
    id: 'flexible-resin',
    name: 'flexible resin',
    color: '#334155',
    texture: 'rubber',
    roughness: 0.62,
    metalness: 0,
  },
  {
    id: 'sls-nylon',
    name: 'SLS nylon',
    color: '#F8FAFC',
    texture: 'powder',
    roughness: 0.9,
    metalness: 0,
  },
  {
    id: 'carbon-fiber-filled',
    name: 'carbon-fiber filled',
    color: '#171717',
    texture: 'fiber',
    roughness: 0.72,
    metalness: 0.02,
  },
  {
    id: 'glass-fiber-filled',
    name: 'glass-fiber filled',
    color: '#CBD5E1',
    texture: 'fiber',
    roughness: 0.7,
    metalness: 0,
  },
  {
    id: 'wood-filled',
    name: 'wood-filled',
    color: '#A16207',
    texture: 'wood',
    roughness: 0.74,
    metalness: 0,
  },
  {
    id: 'metal-filled',
    name: 'metal-filled',
    color: '#9CA3AF',
    texture: 'metal',
    roughness: 0.34,
    metalness: 0.45,
  },
  {
    id: 'marble-pla',
    name: 'marble PLA',
    color: '#E5E7EB',
    texture: 'marble',
    roughness: 0.5,
    metalness: 0,
  },
  {
    id: 'glitter-pla',
    name: 'glitter PLA',
    color: '#7C3AED',
    texture: 'glitter',
    roughness: 0.38,
    metalness: 0.12,
  },
  {
    id: 'glow-pla',
    name: 'glow PLA',
    color: '#D9F99D',
    texture: 'glow',
    roughness: 0.42,
    metalness: 0,
  },
];

/**
 * Handles empty material context in the materials flow.
 */
export function emptyMaterialContext(): MaterialContext {
  return { assignments: [], catalog: BUILTIN_MATERIALS };
}

/**
 * Normalizes material key into the canonical form.
 */
export function normalizeMaterialKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Builds the material data required by the current operation.
 */
export function materialKeyVariants(value: string): string[] {
  const key = normalizeMaterialKey(value);
  const variants = new Set<string>([key]);

  if (key.endsWith('ies') && key.length > 3)
    variants.add(`${key.slice(0, -3)}y`);
  if (key.endsWith('s') && key.length > 1) variants.add(key.slice(0, -1));
  if (key === 'feet') variants.add('foot');

  if (key.endsWith('y') && key.length > 1)
    variants.add(`${key.slice(0, -1)}ies`);
  if (!key.endsWith('s')) variants.add(`${key}s`);
  if (key === 'foot') variants.add('feet');

  return [...variants];
}

/**
 * Returns material by name from the supplied input.
 */
export function findMaterialByName(
  catalog: MaterialAppearance[],
  nameOrId: string,
): MaterialAppearance | null {
  const key = normalizeMaterialKey(nameOrId);
  return (
    catalog.find(
      (material) =>
        normalizeMaterialKey(material.id) === key ||
        normalizeMaterialKey(material.name) === key,
    ) ?? null
  );
}

/**
 * Returns assigned material from the supplied input.
 */
export function findAssignedMaterial(
  context: MaterialContext,
  candidates: string[],
): MaterialAppearance | null {
  const exact = new Map(
    context.assignments.map((assignment) => [
      normalizeMaterialKey(assignment.target),
      assignment.material,
    ]),
  );

  const byVariant = new Map<string, MaterialAppearance>();
  for (const assignment of context.assignments) {
    for (const variant of materialKeyVariants(assignment.target)) {
      if (!byVariant.has(variant)) byVariant.set(variant, assignment.material);
    }
  }

  for (const candidate of candidates) {
    const exactMatch = exact.get(normalizeMaterialKey(candidate));
    if (exactMatch) return exactMatch;

    for (const variant of materialKeyVariants(candidate)) {
      const match = byVariant.get(variant);
      if (match) return match;
    }
  }

  return null;
}

/**
 * Handles color material in the materials flow.
 */
export function colorMaterial(color: string): MaterialAppearance {
  const normalized = color.startsWith('#')
    ? color.toUpperCase()
    : `#${color.toUpperCase()}`;
  return {
    id: `color-${normalized.slice(1).toLowerCase()}`,
    name: normalized,
    color: normalized,
    texture: DEFAULT_MATERIAL_TEXTURE,
    roughness: 0.48,
    metalness: 0,
  };
}
