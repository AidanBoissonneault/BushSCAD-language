/**
 * @author Aidan Boissonneault
 * @file part-boundaries.test.ts
 * @purpose Tests part boundaries behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRDeclareShape,
  IRExtrude,
  IRFuse,
  IRLoft,
  IRPartBoundary,
  IRSketch,
  IRSolidCut,
} from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/index.js';
import { evalOk, noFiles, opsOfKind } from './test-support.js';

describe('part boundaries', () => {
  const SRC = `
base_unit = mm;

part base_plate {
    sketch base = rect(100, 80);
    obj base = extrude(base, 6);
    fillet(@base.top.edges, 1);
    part.color = #2563EB;
}

part lid {
    sketch face = rect(100, 80);
    obj face = extrude(face, 3);
    chamfer(@face.top.edges, 0.3);
    part.color = #7C3AED;
}
`;

  it('parts array contains part names in order', () => {
    const { program } = evalOk(SRC);
    expect(program.parts).toEqual(['base_plate', 'lid']);
  });

  it('part boundary op emitted with color', () => {
    const parsed = parse(SRC, 'test.bscd');
    const resolved = resolve(parsed.ast, 'test.bscd', noFiles);
    const { program } = evaluate(resolved.ast);
    const boundaries = program.ops.filter((op) => op.kind === 'part');
    expect(boundaries).toHaveLength(2);
    expect((boundaries[0] as IRPartBoundary).name).toBe('base_plate');
    expect((boundaries[0] as IRPartBoundary).color).toBe('#2563EB');
    expect((boundaries[1] as IRPartBoundary).name).toBe('lid');
    expect((boundaries[1] as IRPartBoundary).color).toBe('#7C3AED');
  });

  it('fillet/chamfer deferred within each part', () => {
    const { program } = evalOk(SRC);
    // base_plate boundary, sketch, extrude, fillet; lid boundary, sketch, extrude, chamfer
    const kinds = program.ops.map((op) => op.kind);
    // fillet comes after extrude within base_plate block
    const extrudeIdx = kinds.indexOf('extrude');
    const filletIdx = kinds.indexOf('fillet');
    expect(filletIdx).toBeGreaterThan(extrudeIdx);
  });

  it('lowers fuse statements to explicit IR fuse ops', () => {
    const { program } = evalOk(`
part fused {
  sketch a = rect(10, 10);
  sketch b = rect(4, 4);
  obj base = extrude(a, 2);
  obj boss = extrude(b, 2 , @base.top.center);
  fuse(base, boss);
}
`);
    const fuse = opsOfKind<IRFuse>(program.ops, 'fuse')[0];
    expect(fuse.targets).toEqual(['base', 'boss']);
  });

  it('lowers predefined object solid cuts without consuming the tool', () => {
    const { program } = evalOk(`
part p {
  sketch base_sk = rect(40, 30);
  sketch tool_sk = rect(6, 10);
  obj base = extrude(base_sk, 8);
  obj tool = extrude(tool_sk, 12);
  obj slot = cut(tool, @base.top.center);
}
`);
    const solidCut = opsOfKind<IRSolidCut>(program.ops, 'solid_cut')[0];
    expect(solidCut.tool).toEqual({ kind: 'object', objName: 'tool' });
    expect(solidCut.from.faceRef).toBe('base.top.center');
    expect(
      opsOfKind<IRExtrude>(program.ops, 'extrude').map((op) => op.objName),
    ).toContain('tool');
  });

  it('lowers inline loft solid cuts as temporary tool operations', () => {
    const { program } = evalOk(`
part p {
  sketch base_sk = rect(50, 35);
  sketch a = rect(8, 5);
  sketch b = rect(4, 12);
  obj base = extrude(base_sk, 10);
  obj channel = cut(loft(a, b, height: 16), @base.top.center);
}
`);
    const solidCut = opsOfKind<IRSolidCut>(program.ops, 'solid_cut')[0];
    expect(solidCut.tool.kind).toBe('operation');
    if (solidCut.tool.kind === 'operation') {
      expect(solidCut.tool.operation.kind).toBe('loft');
    }
    expect(opsOfKind<IRLoft>(program.ops, 'loft')).toHaveLength(0);
  });

  it('uses loft and solid-cut aliases as within dimensions for auto placement', () => {
    const { program } = evalOk(`
part p {
  sketch base_sketch = circle(100);
  sketch upper_sketch = circle(120);
  obj tray = loft(base_sketch, upper_sketch, height: 30);
  sketch base_inner = circle(90);
  sketch upper_inner = circle(110);
  ref tray_cut_ref = loft(base_inner, upper_inner, height: 25);
  obj tray_cut = cut(tray_cut_ref, @tray.top.center);
  for i in range(2) within tray_cut.bottom.width {
    sketch ridge = rect(10, 4, @tray_cut.bottom);
    obj ridge = extrude(ridge, 3 , @tray_cut.bottom.center(x: auto));
  }
}
`);
    const ridges = opsOfKind<IRExtrude>(program.ops, 'extrude').filter((op) =>
      op.objName.startsWith('ridge'),
    );
    expect(ridges.map((op) => op.from?.offsetX)).toEqual([
      100 / 3,
      (100 / 3) * 2,
    ]);
    expect(
      opsOfKind<IRSketch>(program.ops, 'sketch')
        .filter((op) => op.name.startsWith('ridge'))
        .every((op) => op.surfaceBound?.faceRef === 'tray_cut.bottom'),
    ).toBe(true);
  });

  it('lowers one-line refs as hidden reusable object shapes', () => {
    const { program } = evalOk(`
part p {
  sketch base_sk = rect(40, 30);
  sketch tool_sk = rect(6, 10);
  obj base = extrude(base_sk, 8);
  ref punch_tool = extrude(tool_sk, 12);
  obj slot = cut(punch_tool, @base.top.center);
}
`);
    expect(
      opsOfKind<IRExtrude>(program.ops, 'extrude').map((op) => op.objName),
    ).toContain('punch_tool');
    expect(opsOfKind<IRDeclareShape>(program.ops, 'declareShape')).toEqual([
      expect.objectContaining({ name: 'punch_tool' }),
    ]);
    expect(opsOfKind<IRSolidCut>(program.ops, 'solid_cut')[0].tool).toEqual({
      kind: 'object',
      objName: 'punch_tool',
    });
  });
});
