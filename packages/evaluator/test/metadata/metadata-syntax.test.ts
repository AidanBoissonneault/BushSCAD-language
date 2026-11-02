/**
 * @author Aidan Boissonneault
 * @file metadata-syntax.test.ts
 * @purpose Tests metadata syntax behavior in the metadata in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type {
  IRExtrude,
  IRPartBoundary,
  IRSketch,
  MaterialContext,
} from '@bushscad/ir';
import {
  evalErrorMessages,
  evalOk,
  evalOps,
  evalOpsWithPartBoundaries,
} from '../core/test-support.js';

describe('metadata assignment evaluation', () => {
  it('applies part color and material defaults to emitted objects', () => {
    const ops = evalOpsWithPartBoundaries(`
part p {
  part.material = 'PLA';
  part.color = #88ccff;
  sketch s = rect(1, 1);
  obj base = extrude(s, 1);
}
`);
    const boundary = ops.find(
      (op): op is IRPartBoundary => op.kind === 'part',
    )!;
    const extrude = ops.find((op): op is IRExtrude => op.kind === 'extrude')!;
    expect(boundary.color).toBe('#88ccff');
    expect(extrude.material?.name).toBe('PLA');
  });

  it('uses variables for colors and built-in materials', () => {
    const { program } = evalOk(`
var default_finish = 'matte PLA';
var default_color = #4F46E5;

part p {
  var accent_color = #F97316;
  part.material = default_finish;
  part.color = default_color;
  sketch s = rect(1, 1);
  obj base = extrude(s, 1);
  obj accent = extrude(s, 1);
  accent.color = accent_color;
}
`);
    const extrudes = program.ops.filter(
      (op): op is IRExtrude => op.kind === 'extrude',
    );
    expect(extrudes[0].material).toMatchObject({
      name: 'matte PLA',
      color: '#4F46E5',
    });
    expect(extrudes[1].material).toMatchObject({
      name: 'matte PLA',
      color: '#F97316',
    });
  });

  it('uses a variable to select a workspace-defined custom material', () => {
    const customMaterial = {
      id: 'galaxy-black-pla',
      name: 'Galaxy Black PLA',
      color: '#111827',
      texture: 'glitter' as const,
      roughness: 0.4,
      metalness: 0.1,
    };
    const materials: MaterialContext = {
      catalog: [customMaterial],
      assignments: [],
    };
    const { program } = evalOk(
      `
var finish = 'Galaxy Black PLA';
part p {
  part.material = finish;
  sketch s = rect(1, 1);
  obj base = extrude(s, 1);
}
`,
      { materials },
    );
    const extrude = program.ops.find(
      (op): op is IRExtrude => op.kind === 'extrude',
    );
    expect(extrude?.material).toEqual(customMaterial);
  });

  it('rejects variable color values outside #rrggbb format', () => {
    expect(
      evalErrorMessages(`
part p {
  var invalid_color = 'orange';
  part.color = invalid_color;
}
`),
    ).toContain('color metadata expects a #rrggbb hex color string');
  });

  it('lets object metadata override part metadata regardless of statement order', () => {
    const ops = evalOps(`
part p {
  part.material = 'PLA';
  part.color = #dddddd;
  sketch s = rect(1, 1);
  obj base = extrude(s, 1);
  obj accent = extrude(s, 1);
  accent.color = #ff8800;
  base.material = 'PETG';
}
`);
    const base = ops.find(
      (op): op is IRExtrude => op.kind === 'extrude' && op.objName === 'base',
    )!;
    const accent = ops.find(
      (op): op is IRExtrude => op.kind === 'extrude' && op.objName === 'accent',
    )!;
    expect(base.material?.name).toBe('PETG');
    expect(accent.material?.color).toBe('#FF8800');
  });

  it('applies part metadata defaults inside placed refs', () => {
    const ops = evalOps(`
ref marker {
  part.material = 'PETG';
  sketch s = rect(1, 1);
  obj body = extrude(s, 1);
}

part p {
  sketch base_sk = rect(10, 10);
  obj base = extrude(base_sk, 1) {
    @mount = @base.top.center;
  };
  place(marker, @mount);
}
`);
    const marker = ops.find(
      (op): op is IRExtrude =>
        op.kind === 'extrude' && op.objName.startsWith('body_'),
    )!;
    expect(marker.material?.name).toBe('PETG');
  });

  it('keeps placed ref polar offsets as radius and angle metadata', () => {
    const ops = evalOps(`
ref handle {
  sketch loft_base = rect(4, 2);
  sketch loft_top = rect(2, 1);
  obj lofted = loft(loft_base, loft_top, height: 5);
}

part p {
  sketch base_sk = rect(100, 100);
  obj base = extrude(base_sk, 1) {
    @mount = @base.top.center;
  };
  place(handle, @mount(radius: 60, angle: 180deg));
}
`);
    const placedSketch = ops.find(
      (op): op is IRSketch =>
        op.kind === 'sketch' && op.name.startsWith('loft_base_'),
    )!;
    expect(placedSketch.placement).toMatchObject({
      radius: 60,
      angleDeg: 180,
    });
    expect(placedSketch.placement?.offsetY).toBeUndefined();
  });
});
