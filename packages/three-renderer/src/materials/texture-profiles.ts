/**
 * @author Aidan Boissonneault
 * @file texture-profiles.ts
 * @purpose Provides texture profiles behavior for the materials in three renderer package.
 * @last-edited October 6, 2026
 */

import type { MaterialTexture } from '@bushscad/ir';

export const DEFAULT_COLOR = '#94A3B8';

/**
 * Accepted values for rendering style are 'realism' and 'cad'.
 */
export type RenderingStyle = 'realism' | 'cad';

/**
 * Physical profile, including reflectivity, ior, clearcoat, clearcoat roughness, and
 * transmission.
 */
type PhysicalProfile = {
  reflectivity?: number;
  ior?: number;
  clearcoat: number;
  clearcoatRoughness: number;
  transmission: number;
  thickness: number;
  envMapIntensity: number;
};

export const TEXTURE_PROFILES: Record<MaterialTexture, PhysicalProfile> = {
  'printed-plastic': {
    reflectivity: 0.28,
    clearcoat: 0.08,
    clearcoatRoughness: 0.42,
    transmission: 0,
    thickness: 0,
    envMapIntensity: 0.7,
  },
  'fdm-layer': {
    reflectivity: 0.3,
    clearcoat: 0.1,
    clearcoatRoughness: 0.38,
    transmission: 0,
    thickness: 0,
    envMapIntensity: 0.72,
  },
  matte: {
    reflectivity: 0.18,
    clearcoat: 0,
    clearcoatRoughness: 0.8,
    transmission: 0,
    thickness: 0,
    envMapIntensity: 0.42,
  },
  satin: {
    reflectivity: 0.34,
    clearcoat: 0.18,
    clearcoatRoughness: 0.28,
    transmission: 0,
    thickness: 0,
    envMapIntensity: 0.82,
  },
  gloss: {
    reflectivity: 0.48,
    clearcoat: 0.46,
    clearcoatRoughness: 0.12,
    transmission: 0,
    thickness: 0,
    envMapIntensity: 1.08,
  },
  silk: {
    reflectivity: 0.56,
    clearcoat: 0.42,
    clearcoatRoughness: 0.16,
    transmission: 0,
    thickness: 0,
    envMapIntensity: 1.14,
  },
  translucent: {
    ior: 1.46,
    clearcoat: 0.22,
    clearcoatRoughness: 0.08,
    transmission: 0.42,
    thickness: 1.4,
    envMapIntensity: 1.18,
  },
  clear: {
    ior: 1.48,
    clearcoat: 0.18,
    clearcoatRoughness: 0.04,
    transmission: 0.82,
    thickness: 2.2,
    envMapIntensity: 1.38,
  },
  rubber: {
    reflectivity: 0.1,
    clearcoat: 0,
    clearcoatRoughness: 0.9,
    transmission: 0,
    thickness: 0,
    envMapIntensity: 0.3,
  },
  powder: {
    reflectivity: 0.14,
    clearcoat: 0,
    clearcoatRoughness: 0.94,
    transmission: 0,
    thickness: 0,
    envMapIntensity: 0.36,
  },
  fiber: {
    reflectivity: 0.22,
    clearcoat: 0.04,
    clearcoatRoughness: 0.62,
    transmission: 0,
    thickness: 0,
    envMapIntensity: 0.54,
  },
  wood: {
    reflectivity: 0.18,
    clearcoat: 0.06,
    clearcoatRoughness: 0.58,
    transmission: 0,
    thickness: 0,
    envMapIntensity: 0.46,
  },
  metal: {
    reflectivity: 0.74,
    clearcoat: 0.08,
    clearcoatRoughness: 0.18,
    transmission: 0,
    thickness: 0,
    envMapIntensity: 1.34,
  },
  marble: {
    reflectivity: 0.32,
    clearcoat: 0.22,
    clearcoatRoughness: 0.2,
    transmission: 0,
    thickness: 0,
    envMapIntensity: 0.92,
  },
  glitter: {
    reflectivity: 0.62,
    clearcoat: 0.54,
    clearcoatRoughness: 0.1,
    transmission: 0,
    thickness: 0,
    envMapIntensity: 1.22,
  },
  glow: {
    reflectivity: 0.28,
    clearcoat: 0.2,
    clearcoatRoughness: 0.3,
    transmission: 0,
    thickness: 0,
    envMapIntensity: 0.78,
  },
};
