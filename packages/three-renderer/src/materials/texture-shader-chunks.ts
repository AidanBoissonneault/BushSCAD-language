/**
 * @author Aidan Boissonneault
 * @file texture-shader-chunks.ts
 * @purpose Provides texture shader chunks behavior for the materials in three renderer package.
 * @last-edited October 6, 2026
 */

import type { MaterialTexture } from '@bushscad/ir';

/**
 * Handles texture color shader in the materials flow.
 */
export function textureColorShader(texture: MaterialTexture): string {
  switch (texture) {
    case 'fdm-layer':
    case 'printed-plastic':
      return `
      {
        float layer = smoothstep(0.45, 0.55, abs(fract(vBushPosition.z * 2.4) - 0.5) * 2.0);
        diffuseColor.rgb *= mix(vec3(0.92), vec3(1.08), layer);
      }
      `;
    case 'matte':
      return `
      {
        float n = bushNoise(vBushPosition * 0.45);
        diffuseColor.rgb *= mix(vec3(0.86), vec3(1.02), n);
      }
      `;
    case 'satin':
      return `
      {
        float wave = sin((vBushPosition.x + vBushPosition.y) * 0.18) * 0.5 + 0.5;
        diffuseColor.rgb *= mix(vec3(0.94), vec3(1.06), wave);
      }
      `;
    case 'gloss':
      return `
      {
        diffuseColor.rgb *= vec3(1.04);
      }
      `;
    case 'silk':
      return `
      {
        float silk = sin((vBushPosition.x - vBushPosition.y + vBushPosition.z) * 0.22) * 0.5 + 0.5;
        diffuseColor.rgb *= mix(vec3(0.88, 0.92, 1.08), vec3(1.18, 1.08, 0.96), silk);
      }
      `;
    case 'translucent':
    case 'clear':
      return `
      {
        float n = bushNoise(vBushPosition * 0.2);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), 0.18 + n * 0.08);
      }
      `;
    case 'rubber':
      return `
      {
        float n = bushNoise(vBushPosition * 1.15);
        diffuseColor.rgb *= mix(vec3(0.72), vec3(0.98), n);
      }
      `;
    case 'powder':
      return `
      {
        float n = bushNoise(vBushPosition * 1.65);
        diffuseColor.rgb *= mix(vec3(0.82), vec3(1.12), n);
      }
      `;
    case 'fiber':
      return `
      {
        float grain = step(0.82, bushNoise(vec3(vBushPosition.x * 1.6, vBushPosition.y * 0.25, vBushPosition.z * 1.2)));
        diffuseColor.rgb *= mix(vec3(0.76), vec3(1.18), grain);
      }
      `;
    case 'wood':
      return `
      {
        float rings = sin((length(vBushPosition.xy) + bushNoise(vBushPosition * 0.25) * 8.0) * 0.32) * 0.5 + 0.5;
        diffuseColor.rgb *= mix(vec3(0.72, 0.50, 0.32), vec3(1.26, 0.94, 0.58), rings);
      }
      `;
    case 'metal':
      return `
      {
        float grain = bushNoise(vec3(vBushPosition.x * 1.8, vBushPosition.y * 0.35, vBushPosition.z * 0.35));
        diffuseColor.rgb *= mix(vec3(0.82), vec3(1.16), grain);
      }
      `;
    case 'marble':
      return `
      {
        float vein = abs(sin((vBushPosition.x + vBushPosition.y * 0.4 + vBushPosition.z) * 0.12 + bushNoise(vBushPosition * 0.18) * 5.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.18), smoothstep(0.90, 1.0, vein) * 0.42);
      }
      `;
    case 'glitter':
      return `
      {
        float sparkle = step(0.965, bushNoise(vBushPosition * 4.0));
        diffuseColor.rgb += sparkle * vec3(0.55);
      }
      `;
    case 'glow':
      return `
      {
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 1.0, 0.45), 0.32);
      }
      `;
  }
}

/**
 * Handles texture roughness shader in the materials flow.
 */
export function textureRoughnessShader(texture: MaterialTexture): string {
  switch (texture) {
    case 'fdm-layer':
    case 'printed-plastic':
      return `
      {
        float bushLayer = smoothstep(0.45, 0.55, abs(fract(vBushPosition.z * 2.4) - 0.5) * 2.0);
        float bushMicro = bushNoise(vBushPosition * 3.1);
        roughnessFactor = clamp(roughnessFactor * mix(1.14, 0.92, bushLayer) + (bushMicro - 0.5) * 0.045, 0.04, 1.0);
      }
      `;
    case 'matte':
    case 'powder':
      return `
      {
        float bushDust = bushNoise(vBushPosition * 1.7);
        roughnessFactor = clamp(max(roughnessFactor, 0.68) + bushDust * 0.12, 0.04, 1.0);
      }
      `;
    case 'gloss':
    case 'silk':
    case 'glitter':
      return `
      {
        float bushPolish = bushNoise(vBushPosition * 0.9);
        roughnessFactor = clamp(roughnessFactor * mix(0.76, 1.08, bushPolish), 0.03, 0.82);
      }
      `;
    case 'translucent':
    case 'clear':
      return `
      {
        float bushRipple = bushNoise(vBushPosition * 0.7);
        roughnessFactor = clamp(roughnessFactor * mix(0.72, 1.18, bushRipple), 0.02, 0.56);
      }
      `;
    case 'rubber':
      return `
      {
        float bushPore = bushNoise(vBushPosition * 2.0);
        roughnessFactor = clamp(max(roughnessFactor, 0.74) + bushPore * 0.1, 0.04, 1.0);
      }
      `;
    case 'fiber':
      return `
      {
        float bushStrand = bushNoise(vec3(vBushPosition.x * 1.8, vBushPosition.y * 0.32, vBushPosition.z * 1.3));
        roughnessFactor = clamp(roughnessFactor * mix(0.96, 1.28, bushStrand), 0.08, 1.0);
      }
      `;
    case 'wood':
      return `
      {
        float bushRing = abs(sin((length(vBushPosition.xy) + bushNoise(vBushPosition * 0.22) * 8.0) * 0.32));
        roughnessFactor = clamp(roughnessFactor * mix(0.88, 1.26, bushRing), 0.08, 1.0);
      }
      `;
    case 'metal':
      return `
      {
        float bushBrush = bushNoise(vec3(vBushPosition.x * 2.2, vBushPosition.y * 0.3, vBushPosition.z * 0.3));
        roughnessFactor = clamp(roughnessFactor * mix(0.74, 1.34, bushBrush), 0.06, 0.86);
      }
      `;
    case 'marble':
      return `
      {
        float bushVein = abs(sin((vBushPosition.x + vBushPosition.y * 0.4 + vBushPosition.z) * 0.12 + bushNoise(vBushPosition * 0.18) * 5.0));
        roughnessFactor = clamp(roughnessFactor * mix(0.84, 1.18, smoothstep(0.86, 1.0, bushVein)), 0.06, 0.9);
      }
      `;
    case 'satin':
    case 'glow':
      return `
      {
        float bushSoft = bushNoise(vBushPosition * 0.8);
        roughnessFactor = clamp(roughnessFactor * mix(0.88, 1.12, bushSoft), 0.05, 0.92);
      }
      `;
  }
}

/**
 * Handles texture metalness shader in the materials flow.
 */
export function textureMetalnessShader(texture: MaterialTexture): string {
  switch (texture) {
    case 'metal':
      return `
      {
        float bushBrush = bushNoise(vec3(vBushPosition.x * 2.1, vBushPosition.y * 0.34, vBushPosition.z * 0.34));
        metalnessFactor = clamp(metalnessFactor * mix(0.86, 1.08, bushBrush), 0.0, 1.0);
      }
      `;
    case 'glitter':
      return `
      {
        float bushSparkle = step(0.965, bushNoise(vBushPosition * 4.0));
        metalnessFactor = clamp(metalnessFactor + bushSparkle * 0.34, 0.0, 1.0);
      }
      `;
    case 'silk':
      return `
      {
        float bushSheen = sin((vBushPosition.x - vBushPosition.y + vBushPosition.z) * 0.22) * 0.5 + 0.5;
        metalnessFactor = clamp(metalnessFactor + bushSheen * 0.025, 0.0, 1.0);
      }
      `;
    case 'fiber':
      return `
      {
        float bushFleck = step(0.88, bushNoise(vBushPosition * 2.6));
        metalnessFactor = clamp(metalnessFactor + bushFleck * 0.04, 0.0, 1.0);
      }
      `;
    case 'printed-plastic':
    case 'fdm-layer':
    case 'matte':
    case 'satin':
    case 'gloss':
    case 'translucent':
    case 'clear':
    case 'rubber':
    case 'powder':
    case 'wood':
    case 'marble':
    case 'glow':
      return '';
  }
}
