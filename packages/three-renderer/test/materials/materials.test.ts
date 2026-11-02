/**
 * @author Aidan Boissonneault
 * @file materials.test.ts
 * @purpose Tests materials behavior in the materials in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BUILTIN_MATERIALS } from '@bushscad/ir';
import {
  createOpenSurfaceMaterial,
  createPreviewMaterial,
} from '../../src/materials/materials.js';

describe('preview materials', () => {
  it('creates a Three material for every built-in material texture', () => {
    for (const appearance of BUILTIN_MATERIALS) {
      const material = createPreviewMaterial(appearance);
      expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
      expect(material.userData.bushscadTexture).toBe(appearance.texture);
      expect(material.color.equals(new THREE.Color(appearance.color))).toBe(
        true,
      );
      expect(material.roughness).toBeCloseTo(appearance.roughness);
      expect(material.metalness).toBeCloseTo(appearance.metalness);
      material.dispose();
    }
  });

  it('creates printed-plastic fallback from mesh color', () => {
    const material = createPreviewMaterial(undefined, '#123456');
    expect(material.userData.bushscadTexture).toBe('printed-plastic');
    expect(material.userData.bushscadRenderStyle).toBe('realism');
    expect(material.color.equals(new THREE.Color('#123456'))).toBe(true);
    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    material.dispose();
  });

  it('applies transparent physical settings from material metadata', () => {
    const material = createPreviewMaterial({
      id: 'custom-clear',
      name: 'custom clear',
      color: '#D1F3FF',
      texture: 'clear',
      roughness: 0.08,
      metalness: 0,
      opacity: 0.42,
      transmission: 0.72,
      ior: 1.42,
      thickness: 3,
      clearcoat: 0.34,
      clearcoatRoughness: 0.09,
      envMapIntensity: 1.7,
    });

    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.opacity).toBeCloseTo(0.42);
    expect(material.transmission).toBeCloseTo(0.72);
    expect(material.ior).toBeCloseTo(1.42);
    expect(material.thickness).toBeCloseTo(3);
    expect(material.clearcoat).toBeCloseTo(0.34);
    expect(material.clearcoatRoughness).toBeCloseTo(0.09);
    expect(material.envMapIntensity).toBeCloseTo(1.7);
    material.dispose();
  });

  it('respects explicit reflectivity when no ior is provided', () => {
    const material = createPreviewMaterial({
      id: 'custom-gloss',
      name: 'custom gloss',
      color: '#FFAA00',
      texture: 'gloss',
      roughness: 0.18,
      metalness: 0,
      reflectivity: 0.64,
    });

    expect(material.reflectivity).toBeCloseTo(0.64);
    material.dispose();
  });

  it('creates matte analytical materials for CAD style', () => {
    const material = createPreviewMaterial(
      {
        id: 'custom-metal',
        name: 'custom metal',
        color: '#94A3B8',
        texture: 'metal',
        roughness: 0.18,
        metalness: 0.8,
        transmission: 0.6,
        clearcoat: 0.5,
      },
      undefined,
      'cad',
    );

    expect(material.userData.bushscadRenderStyle).toBe('cad');
    expect(material.roughness).toBeGreaterThanOrEqual(0.74);
    expect(material.metalness).toBe(0);
    expect(material.transmission).toBe(0);
    expect(material.clearcoat).toBe(0);
    expect(material.envMapIntensity).toBeCloseTo(0.08);
    expect(material.reflectivity).toBeCloseTo(0.12);
    material.dispose();
  });

  it('creates two-sided transparent materials for open surfaces', () => {
    const material = createOpenSurfaceMaterial(undefined, '#88CCFF');
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.opacity).toBeLessThanOrEqual(0.56);
    expect(material.userData.bushscadOpenSurface).toBe(true);
    material.dispose();
  });
});
