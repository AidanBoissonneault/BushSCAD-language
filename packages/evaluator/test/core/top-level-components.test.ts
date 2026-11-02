/**
 * @author Aidan Boissonneault
 * @file top-level-components.test.ts
 * @purpose Tests top level components behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRAlignShape, IRExtrude, IRFillet } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import {
  evalErrorMessages,
  evalOk,
  evalOkWithAssets,
  evalOpsWithPartBoundaries,
  opsOfKind,
} from './test-support.js';

describe('top-level components', () => {
  it('emit geometry for the default output', () => {
    const { program } = evalOk(`
base_unit = mm;
part plate {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
}
`);

    expect(program.ops.map((op) => op.kind)).toEqual(['sketch', 'extrude']);
  });

  it('emits exported parts while retaining them as reusable components', () => {
    const ops = evalOpsWithPartBoundaries(`
export part bracket {
  sketch profile = rect(16, 12);
  obj body = extrude(profile, 5);
  @mount = @body.bottom.center;
}
part assembly {
  sketch base_profile = rect(40, 30);
  obj base = extrude(base_profile, 4);
  place(bracket, @base.top.center, @mount);
}
`);

    expect(ops.filter((op) => op.kind === 'part').map((op) => op.name)).toEqual(
      ['bracket', 'assembly'],
    );
    expect(
      opsOfKind<IRExtrude>(ops, 'extrude').map((op) => op.objName),
    ).toEqual(['body', 'base', expect.stringMatching(/^body_\d+$/)]);
  });

  it('emits exported objects like ordinary visible objects', () => {
    const ops = evalOpsWithPartBoundaries(`
sketch profile = circle(4);
export obj pin = extrude(profile, 12);
`);

    expect(ops.map((op) => op.kind)).toEqual(['sketch', 'extrude']);
    expect(opsOfKind<IRExtrude>(ops, 'extrude')[0]?.objName).toBe('pin');
  });

  it('directs placement-dependent exported geometry to ref', () => {
    expect(
      evalErrorMessages(`
export part cover {
  sketch face = rect(this.width, this.height);
  obj face = extrude(face, 2);
}
`),
    ).toEqual([
      "Exported part 'cover' requires placement context; use 'export ref cover { ... }' for hidden reusable geometry",
    ]);
  });

  it('emits top-level fillets after their target geometry', () => {
    const { program } = evalOk(`
sketch base = rect(10, 10);
obj base = extrude(base, 2);
fillet(@base.top.edges, 0.5);
`);

    const fillets = opsOfKind<IRFillet>(program.ops, 'fillet');
    expect(program.ops.map((op) => op.kind)).toEqual([
      'sketch',
      'extrude',
      'fillet',
    ]);
    expect(fillets[0]).toMatchObject({
      target: 'base.top.edges',
      radius: 0.5,
    });
  });

  it('emits distinct instances for repeated imported ref placement', () => {
    const { program } = evalOkWithAssets(`
base_unit = mm;

import shape motor = './T21.step';

ref motor_shape extends motor {
  @motor_left = @motor_shape.left.center;
};

part housing {
  sketch base = rect(80, 60);
  obj body = extrude(base, 20);

  place(motor_shape, @body.top.center);
  place(motor_shape, @motor_shape.top.center, @motor_left);
}
`);

    const placements = opsOfKind<IRAlignShape>(program.ops, 'alignShape');
    expect(placements).toHaveLength(2);
    expect(placements[0]).toMatchObject({
      name: 'motor_shape',
      instanceName: 'motor_shape_0',
      targetPlacement: { faceRef: 'body.top.center' },
    });
    expect(placements[1]).toMatchObject({
      name: 'motor_shape',
      instanceName: 'motor_shape_1',
      sourceRef: 'motor_shape.left.center',
      targetPlacement: { faceRef: 'motor_shape_0.top.center' },
    });
  });

  it('places imported shapes directly without a ref wrapper', () => {
    const { program } = evalOkWithAssets(`
import shape base = './base.stl';

place(base);
`);

    const imports = opsOfKind(program.ops, 'importShape');
    const placements = opsOfKind<IRAlignShape>(program.ops, 'alignShape');
    expect(imports[0]).toMatchObject({
      name: 'base',
      format: 'stl',
    });
    expect(placements).toHaveLength(1);
    expect(placements[0]).toMatchObject({
      name: 'base',
      instanceName: 'base_0',
      targetPlacement: { faceRef: '0,0,0' },
    });
  });
});
