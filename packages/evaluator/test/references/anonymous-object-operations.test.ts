import { describe, expect, it } from 'vitest';
import type {
  IRExtrude,
  IRFillet,
  IRSolidPrimitive,
  IRSketch,
} from '@bushscad/ir';
import { evalOps } from '../core/test-support.js';

describe('anonymous object operation evaluation', () => {
  it('emits a bare operation without declaring a source object name', () => {
    const ops = evalOps('cube(4);');
    const solids = ops.filter(
      (op): op is IRSolidPrimitive => op.kind === 'solidPrimitive',
    );

    expect(solids).toHaveLength(1);
    expect(solids[0]?.objName).toMatch(/^__anonymous-operation_/);
  });

  it('materializes inline selector targets once and reuses them in placements', () => {
    const ops = evalOps(`
part pin {
  sketch shaft_profile = rect(1, 1);
  obj shaft = extrude(shaft_profile, 2);
}
part assembly {
  place(pin, @cube(8).top);
  fillet(@cube(10).top, 2);
}
`);
    const solids = ops.filter(
      (op): op is IRSolidPrimitive => op.kind === 'solidPrimitive',
    );
    const inlineSolids = solids.filter((solid) =>
      solid.objName.startsWith('__inline-operation_'),
    );
    const fillet = ops.find((op): op is IRFillet => op.kind === 'fillet')!;
    const placedSketch = ops.find(
      (op): op is IRSketch =>
        op.kind === 'sketch' &&
        op.placement?.faceRef === `${inlineSolids[0]?.objName}.top`,
    )!;

    expect(inlineSolids).toHaveLength(2);
    expect(fillet.target).toBe(`${inlineSolids[1]?.objName}.top`);
    expect(placedSketch.placement?.faceRef).toBe(
      `${inlineSolids[0]?.objName}.top`,
    );
  });

  it('evaluates inline operation arguments with a placed component this context', () => {
    const ops = evalOps(`
part assembly {
  obj base = cube([20, 10, 4]);
  ref contextual {
    fillet(@extrude(rect(this.width, 10), 2).top, 1);
  }
  place(contextual, @base.top.center);
}
`);
    const inlineExtrude = ops.find(
      (op): op is IRExtrude =>
        op.kind === 'extrude' && op.objName.startsWith('__inline-operation_'),
    );
    const inlineSketch = ops.find(
      (op): op is IRSketch =>
        op.kind === 'sketch' && op.name === inlineExtrude?.sketchName,
    );

    expect(inlineSketch?.primitive).toMatchObject({
      kind: 'rect',
      width: 20,
      height: 10,
    });
  });
});
