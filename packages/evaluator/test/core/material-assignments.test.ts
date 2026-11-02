/**
 * @author Aidan Boissonneault
 * @file material-assignments.test.ts
 * @purpose Tests material assignments behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRExtrude, MaterialContext } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk, opsOfKind } from './test-support.js';

describe('material assignments', () => {
  const aluminum = {
    id: 'blue-anodized-aluminum',
    name: 'blue anodized aluminum',
    color: '#2563EB',
    texture: 'metal' as const,
    roughness: 0.28,
    metalness: 0.75,
  };
  const acrylic = {
    id: 'green-acrylic',
    name: 'green acrylic',
    color: '#16A34A',
    texture: 'translucent' as const,
    roughness: 0.18,
    metalness: 0,
    opacity: 0.72,
  };
  const rubber = {
    id: 'dark-rubber',
    name: 'dark rubber',
    color: '#1F2937',
    texture: 'rubber' as const,
    roughness: 0.86,
    metalness: 0,
  };
  const partMaterial = {
    id: 'pla',
    name: 'PLA',
    color: '#F4F1E8',
    texture: 'fdm-layer' as const,
    roughness: 0.48,
    metalness: 0,
  };

  it('matches object, component, plural component, and part assignments in precedence order', () => {
    const materials: MaterialContext = {
      catalog: [aluminum, acrylic, rubber, partMaterial],
      assignments: [
        { target: 'enclosure', material: partMaterial },
        { target: 'badge', material: acrylic },
        { target: 'feet', material: rubber },
        { target: 'body', material: aluminum },
      ],
    };
    const { program } = evalOk(
      `
base_unit = mm;
export part badge {
  sketch b = rect(4, 2);
  obj base = extrude(b, 1);
}
export part foot {
  sketch f = circle(2);
  obj pad = extrude(f, 1);
}
part enclosure {
  sketch s = rect(10, 10);
  obj body = extrude(s, 2);
  sketch cap_s = circle(1);
  obj cap = extrude(cap_s, 1);
  place(badge, @body.top.center);
  place(foot, @body.bottom.center);
}
`,
      { materials },
    );

    const extrudes = opsOfKind<IRExtrude>(program.ops, 'extrude');
    const byName = new Map(
      extrudes.map((op) => [op.objName, op.material?.name]),
    );
    expect(byName.get('body')).toBe('blue anodized aluminum');
    expect(byName.get('cap')).toBe('PLA');
    expect(
      extrudes.find((op) => op.objName.startsWith('base_'))?.material?.name,
    ).toBe('green acrylic');
    expect(
      extrudes.find((op) => op.objName.startsWith('pad_'))?.material?.name,
    ).toBe('dark rubber');
  });

  it('uses component color as printed-plastic material fallback', () => {
    const { program } = evalOk(`
base_unit = mm;
export part badge {
  sketch b = rect(4, 2);
  obj base = extrude(b, 1);
  part.color = #16A34A;
}
part enclosure {
  sketch s = rect(10, 10);
  obj body = extrude(s, 2);
  place(badge, @body.top.center);
}
`);

    const badgeExtrude = opsOfKind<IRExtrude>(program.ops, 'extrude').find(
      (op) => op.objName.startsWith('base_'),
    );
    expect(badgeExtrude?.material).toMatchObject({
      color: '#16A34A',
      texture: 'printed-plastic',
    });
  });

  it('lets part material override materials.json assignments', () => {
    const materials: MaterialContext = {
      catalog: [
        aluminum,
        acrylic,
        rubber,
        partMaterial,
        {
          id: 'tpu',
          name: 'TPU',
          color: '#111827',
          texture: 'rubber',
          roughness: 0.78,
          metalness: 0,
        },
      ],
      assignments: [{ target: 'body', material: aluminum }],
    };
    const { program } = evalOk(
      `
base_unit = mm;
part enclosure {
  sketch s = rect(10, 10);
  part.material = 'TPU';
  obj body = extrude(s, 2);
}
`,
      { materials },
    );

    const extrude = opsOfKind<IRExtrude>(program.ops, 'extrude')[0];
    expect(extrude.material?.name).toBe('TPU');
  });

  it('applies object material overrides over part defaults', () => {
    const { program } = evalOk(`
base_unit = mm;
part enclosure {
  sketch a = rect(10, 10);
  part.material = 'PLA';
  obj body = extrude(a, 2);
  sketch b = circle(2);
  obj foot = extrude(b, 1);
  foot.material = 'dark rubber';
}
`);
    const extrudes = opsOfKind<IRExtrude>(program.ops, 'extrude');
    expect(extrudes[0].material?.name).toBe('PLA');
    expect(extrudes[1].material?.name).toBe('dark rubber');
  });

  it('preserves authored color while using named material surface properties', () => {
    const { program } = evalOk(`
base_unit = mm;
part enclosure {
  part.color = #2563EB;
  part.material = 'matte PLA';
  sketch profile = rect(10, 10);
  obj body = extrude(profile, 2);
}
`);
    const material = opsOfKind<IRExtrude>(program.ops, 'extrude')[0].material;

    expect(material).toMatchObject({
      id: 'matte-pla',
      color: '#2563EB',
      texture: 'matte',
      roughness: 0.82,
      metalness: 0,
    });
  });

  it('leaves material null when no assignment or color exists', () => {
    const { program } = evalOk(`
base_unit = mm;
part enclosure {
  sketch s = rect(10, 10);
  obj body = extrude(s, 2);
}
`);
    const extrude = opsOfKind<IRExtrude>(program.ops, 'extrude')[0];
    expect(extrude.material).toBeNull();
  });
});
