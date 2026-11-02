/**
 * @author Aidan Boissonneault
 * @file joints.test.ts
 * @purpose Tests joints behavior in the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import type { IRJoint } from '@bushscad/ir';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { previewFile } from '../../src/pipeline/previewFile.js';
import { compileExample } from './test-support.js';

const SLIDER_EXAMPLE = fileURLToPath(
  new URL('../../../../examples/test-22-M30-joints.bscd', import.meta.url),
);

describe('M30 joint compilation', () => {
  it('compiles test 22 with a slider joint targeting the drawer part', () => {
    const result = compileExample('test-22-M30-joints.bscd');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const joints = result.program.ops.filter(
      (op): op is IRJoint => op.kind === 'joint',
    );
    expect(joints).toHaveLength(1);
    expect(joints[0]).toMatchObject({
      name: 'slide',
      jointType: 'slider',
      limitMin: 0,
      limitMax: 55,
      defaultValue: 20,
      sideB: 'housing.front',
    });
    expect(joints[0].sideA).toBe('drawer.front');
  });

  it('keeps the slider target as an independently movable preview part', async () => {
    const result = await previewFile({ filePath: SLIDER_EXAMPLE });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meshes.map((mesh) => mesh.partName).sort()).toEqual([
      'drawer',
      'housing',
    ]);
    expect(result.joints).toEqual([
      expect.objectContaining({
        name: 'slide',
        jointType: 'slider',
        movingPartName: 'drawer',
        staticPartName: 'housing',
      }),
    ]);
  }, 30_000);

  it('compiles test 23 with the lid extrude placed on the box top', () => {
    const result = compileExample('test-23-M30-hinge.bscd');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const lidExtrude = result.program.ops.find(
      (op) => op.kind === 'extrude' && op.objName === 'panel',
    );
    expect(lidExtrude).toMatchObject({
      kind: 'extrude',
      from: { faceRef: 'box.top.center' },
    });
  });
});
