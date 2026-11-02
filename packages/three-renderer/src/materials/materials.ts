/**
 * @author Aidan Boissonneault
 * @file materials.ts
 * @purpose Provides materials behavior for the materials in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';

import type { MaterialAppearance } from '@bushscad/ir';

import { applyProceduralShader } from './procedural-shader.js';

import { DEFAULT_COLOR, TEXTURE_PROFILES } from './texture-profiles.js';

import type { RenderingStyle } from './texture-profiles.js';

export type { RenderingStyle } from './texture-profiles.js';

/**
 * Clamps to its supported range.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Builds the material data required by the current operation.
 */
function materialNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  return clamp(
    typeof value === 'number' && Number.isFinite(value) ? value : fallback,
    min,
    max,
  );
}

/**
 * Creates preview material with the supplied values.
 */
export function createPreviewMaterial(
  material: MaterialAppearance | undefined,
  fallbackColor = DEFAULT_COLOR,
  style: RenderingStyle = 'realism',
): THREE.MeshPhysicalMaterial {
  const appearance: MaterialAppearance = material ?? {
    id: 'preview-fallback',
    name: 'preview fallback',
    color: fallbackColor,
    texture: 'printed-plastic',
    roughness: 0.48,
    metalness: 0,
  };

  if (style === 'cad') {
    const opacity = materialNumber(appearance.opacity, 1, 0, 1);
    const mat = new THREE.MeshPhysicalMaterial({
      color: appearance.color,
      roughness: materialNumber(
        Math.max(appearance.roughness, 0.74),
        0.82,
        0,
        1,
      ),
      metalness: 0,
      clearcoat: 0,
      clearcoatRoughness: 1,
      transmission: 0,
      thickness: 0,
      envMapIntensity: 0.08,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
      side: THREE.DoubleSide,
    });
    mat.reflectivity = 0.12;
    mat.userData.bushscadTexture = appearance.texture;
    mat.userData.bushscadRenderStyle = style;
    return mat;
  }

  const profile = TEXTURE_PROFILES[appearance.texture];
  const transmission = materialNumber(
    appearance.transmission,
    profile.transmission,
    0,
    1,
  );
  const opacity = materialNumber(appearance.opacity, 1, 0, 1);
  const transparent =
    opacity < 1 || transmission > 0 || appearance.texture === 'clear';
  const mat = new THREE.MeshPhysicalMaterial({
    color: appearance.color,
    roughness: materialNumber(appearance.roughness, 0.48, 0, 1),
    metalness: materialNumber(appearance.metalness, 0, 0, 1),
    clearcoat: materialNumber(appearance.clearcoat, profile.clearcoat, 0, 1),
    clearcoatRoughness: materialNumber(
      appearance.clearcoatRoughness,
      profile.clearcoatRoughness,
      0,
      1,
    ),
    transmission,
    thickness: materialNumber(appearance.thickness, profile.thickness, 0, 100),
    envMapIntensity: materialNumber(
      appearance.envMapIntensity,
      profile.envMapIntensity,
      0,
      5,
    ),
    transparent,
    opacity,
    depthWrite: !transparent,
    side: THREE.DoubleSide,
  });

  if (appearance.ior !== undefined) {
    mat.ior = materialNumber(appearance.ior, 1.5, 1, 2.333);
  } else if (appearance.reflectivity !== undefined) {
    mat.reflectivity = materialNumber(appearance.reflectivity, 0.5, 0, 1);
  } else if (profile.ior !== undefined) {
    mat.ior = materialNumber(profile.ior, 1.5, 1, 2.333);
  } else {
    mat.reflectivity = materialNumber(profile.reflectivity, 0.5, 0, 1);
  }

  applyProceduralShader(mat, appearance.texture);
  mat.userData.bushscadRenderStyle = style;
  return mat;
}

/**
 * Creates open surface material with the supplied values.
 */
export function createOpenSurfaceMaterial(
  material: MaterialAppearance | undefined,
  fallbackColor = DEFAULT_COLOR,
  style: RenderingStyle = 'realism',
): THREE.MeshPhysicalMaterial {
  const mat = createPreviewMaterial(material, fallbackColor, style);
  mat.side = THREE.DoubleSide;
  mat.transparent = true;
  mat.opacity = Math.min(mat.opacity, style === 'cad' ? 0.42 : 0.56);
  mat.depthWrite = false;
  mat.userData.bushscadOpenSurface = true;
  return mat;
}
