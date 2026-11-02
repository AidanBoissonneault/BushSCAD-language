/**
 * @author Aidan Boissonneault
 * @file procedural-shader.ts
 * @purpose Provides procedural shader behavior for the materials in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type { MaterialTexture } from '@bushscad/ir';
import {
  textureColorShader,
  textureMetalnessShader,
  textureRoughnessShader,
} from './texture-shader-chunks.js';

/**
 * Applies procedural shader to the supplied state or geometry.
 */
export function applyProceduralShader(
  material: THREE.MeshPhysicalMaterial,
  texture: MaterialTexture,
): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vBushPosition;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vBushPosition = transformed;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vBushPosition;
float bushHash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}
float bushNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = bushHash(i + vec3(0.0, 0.0, 0.0));
  float n100 = bushHash(i + vec3(1.0, 0.0, 0.0));
  float n010 = bushHash(i + vec3(0.0, 1.0, 0.0));
  float n110 = bushHash(i + vec3(1.0, 1.0, 0.0));
  float n001 = bushHash(i + vec3(0.0, 0.0, 1.0));
  float n101 = bushHash(i + vec3(1.0, 0.0, 1.0));
  float n011 = bushHash(i + vec3(0.0, 1.0, 1.0));
  float n111 = bushHash(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
${textureColorShader(texture)}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
${textureRoughnessShader(texture)}`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
${textureMetalnessShader(texture)}`,
      );
  };
  material.customProgramCacheKey = () => `bushscad-preview:${texture}`;
  material.userData.bushscadTexture = texture;
}
