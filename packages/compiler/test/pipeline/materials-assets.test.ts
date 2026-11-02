/**
 * @author Aidan Boissonneault
 * @file materials-assets.test.ts
 * @purpose Tests materials assets behavior in the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import type { IRExtrude } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { compileDocument, normalizePath } from '../../src/index';

/**
 * Returns the first extrude op from a successful material compilation.
 *
 * Why:
 * Material asset tests all assert metadata attached to the same body extrude,
 * so the operation lookup should not be repeated in every case.
 */
function firstExtrude(result: {
  ok: true;
  program: { ops: { kind: string }[] };
}): IRExtrude | undefined {
  return result.program.ops.find(
    (op): op is IRExtrude => op.kind === 'extrude',
  );
}

describe('compiler materials assets', () => {
  const enc = new TextEncoder();

  /**
   * Handles compile with materials in the pipeline flow.
   */
  function compileWithMaterials(materialsJson: string, source?: string) {
    const root = normalizePath('C:\\workspace');
    const mainPath = `${root}/src/main.bscd`;
    const manifestPath = `${root}/bushscad.json`;
    const materialsPath = `${root}/assets/materials.json`;
    const documentSource =
      source ??
      `
part enclosure {
  sketch s = rect(10, 10);
  obj body = extrude(s, 2);
}
`;
    return compileDocument({
      source: documentSource,
      filePath: mainPath,
      rootPath: root,
      fileMap: {
        [manifestPath]: JSON.stringify({
          version: 1,
          entrypoints: { main: 'src/main.bscd' },
          defaultEntrypoint: 'main',
          assets: ['assets/materials.json'],
        }),
        [mainPath]: documentSource,
      },
      assetMap: {
        [materialsPath]: enc.encode(materialsJson),
      },
    });
  }

  /**
   * Compiles material assignments and returns the target extrude.
   *
   * Why:
   * Successful material tests differ in material JSON and expected metadata,
   * while result unwrapping and operation lookup are identical.
   */
  function extrudeFromMaterials(materialsJson: string): IRExtrude | undefined {
    const result = compileWithMaterials(materialsJson);
    expect(result.ok).toBe(true);
    if (!result.ok) return undefined;
    return firstExtrude(result);
  }

  it('loads flat M14-style materials assignments', () => {
    const extrude = extrudeFromMaterials(
      JSON.stringify({ body: 'blue anodized aluminum' }),
    );
    expect(extrude?.material).toMatchObject({
      name: 'blue anodized aluminum',
      color: '#2563EB',
      texture: 'metal',
    });
  });

  it('loads versioned materials with custom filaments', () => {
    const result = compileWithMaterials(
      JSON.stringify({
        assignments: {},
        filaments: [
          {
            id: 'galaxy-black-pla',
            name: 'Galaxy Black PLA',
            color: '#111827',
            texture: 'glitter',
            roughness: 0.4,
            metalness: 0.1,
            reflectivity: 0.68,
            clearcoat: 0.45,
            clearcoatRoughness: 0.12,
            transmission: 0.08,
            ior: 1.52,
            thickness: 0.35,
            envMapIntensity: 1.4,
          },
        ],
      }),
      `
var finish = 'Galaxy Black PLA';
part enclosure {
  part.material = finish;
  sketch s = rect(10, 10);
  obj body = extrude(s, 2);
}
`,
    );
    expect(result.ok).toBe(true);
    const extrude = result.ok ? firstExtrude(result) : undefined;
    expect(extrude?.material).toMatchObject({
      id: 'galaxy-black-pla',
      name: 'Galaxy Black PLA',
      color: '#111827',
      texture: 'glitter',
      reflectivity: 0.68,
      clearcoat: 0.45,
      clearcoatRoughness: 0.12,
      transmission: 0.08,
      ior: 1.52,
      thickness: 0.35,
      envMapIntensity: 1.4,
    });
  });

  it('ignores invalid optional physical material fields', () => {
    const extrude = extrudeFromMaterials(
      JSON.stringify({
        assignments: { body: 'Experimental PLA' },
        filaments: [
          {
            name: 'Experimental PLA',
            color: '#111827',
            texture: 'matte',
            reflectivity: 2,
            clearcoat: 'high',
            clearcoatRoughness: -0.1,
            transmission: Number.NaN,
            ior: 0.8,
            thickness: -1,
            envMapIntensity: -0.2,
          },
        ],
      }),
    );
    expect(extrude?.material).toMatchObject({
      name: 'Experimental PLA',
      texture: 'matte',
    });
    expect(extrude?.material).not.toHaveProperty('reflectivity');
    expect(extrude?.material).not.toHaveProperty('clearcoat');
    expect(extrude?.material).not.toHaveProperty('clearcoatRoughness');
    expect(extrude?.material).not.toHaveProperty('transmission');
    expect(extrude?.material).not.toHaveProperty('ior');
    expect(extrude?.material).not.toHaveProperty('thickness');
    expect(extrude?.material).not.toHaveProperty('envMapIntensity');
  });

  it('reports invalid materials JSON', () => {
    const result = compileWithMaterials('{ bad json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain('Invalid materials JSON');
  });

  it('reports unknown assigned materials', () => {
    const result = compileWithMaterials(
      JSON.stringify({ body: 'unobtainium PLA' }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain(
      "Unknown material 'unobtainium PLA'",
    );
  });
});
