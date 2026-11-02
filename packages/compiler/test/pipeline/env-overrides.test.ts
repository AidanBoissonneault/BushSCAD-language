/**
 * @author Aidan Boissonneault
 * @file env-overrides.test.ts
 * @purpose Tests env overrides behavior in the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import type { IRChamfer, IRCut } from '@bushscad/ir';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compile, workspacePath } from './test-support.js';

describe('compiler env overrides', () => {
  /**
   * Asserts that a successful compile emitted a circle sketch diameter.
   *
   * Why:
   * Env tests repeatedly compile a single circle sketch and differ only by the
   * source of the environment value.
   */
  function expectCircleDiameter(
    result: ReturnType<typeof compile>,
    diameter: number,
  ): void {
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sketch = result.program.ops.find((op) => op.kind === 'sketch');
    expect(sketch?.primitive).toMatchObject({ kind: 'circle', diameter });
  }

  it('compiles test-05 loop cuts with final base edge chamfers intact', () => {
    const source = readFileSync(
      new URL('../../../../examples/test-05-loops.bscd', import.meta.url),
      'utf8',
    );
    const result = compile(source);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cuts = result.program.ops.filter(
      (op): op is IRCut => op.kind === 'cut',
    );
    const chamfers = result.program.ops.filter(
      (op): op is IRChamfer => op.kind === 'chamfer',
    );

    expect(cuts).toHaveLength(24);
    expect(new Set(cuts.map((op) => op.objName)).size).toBe(24);
    expect(chamfers.map((op) => op.target)).toEqual([
      'base.top.edges',
      'base.bottom.edges',
    ]);
  });

  it('returns the parsed workplane on the compiled IR program', () => {
    const result = compile(`
workplane = YZ;
part plate {
  sketch s = rect(10, 5);
  obj body = extrude(s, 2);
}
`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.program.workplane).toBe('YZ');
  });

  it('uses env fallbacks when no override is provided', () => {
    const result = compile(`
env d fallback 5;
part plate {
  sketch s = circle(d);
  obj body = extrude(s, 1);
}
`);

    expectCircleDiameter(result, 5);
  });

  it('coerces number, string, boolean, and list overrides from fallback types', () => {
    const result = compile(
      `
env count fallback 2;
env mode fallback 'debug';
env show fallback false;
env sizes fallback [1, 2];
part plate {
  for s in sizes {
    sketch hole = circle(show ? s : count);
    obj hole = extrude(hole, mode == 'release' ? 2 : 1);
  }
}
`,
      {
        count: '9',
        mode: 'release',
        show: 'true',
        sizes: '[3, 4, 5]',
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.program.ops.filter((op) => op.kind === 'sketch'),
    ).toHaveLength(3);
    const extrudes = result.program.ops.filter((op) => op.kind === 'extrude');
    expect(extrudes.every((op) => op.depth === 2)).toBe(true);
  });

  it('reports unknown env overrides', () => {
    const result = compile('env d fallback 5;', { missing: '1' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain(
      "Unknown env override 'missing'",
    );
  });

  it('uses imported env declarations with the same override map', () => {
    const source = `
import './vars.bscd';
part plate {
  sketch s = circle(d);
  obj body = extrude(s, 1);
}
`;
    const result = compile(
      source,
      { d: '7' },
      {
        [workspacePath('main.bscd')]: source,
        [workspacePath('vars.bscd')]: 'export env d fallback 5;',
      },
    );

    expectCircleDiameter(result, 7);
  });

  it('reports type errors at the env declaration span', () => {
    const result = compile(
      `
env d fallback 5;
part plate {
  sketch s = circle(d);
  obj body = extrude(s, 1);
}
`,
      { d: 'wide' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain(
      "Invalid number override for env 'd'",
    );
    expect(result.errors[0].span.line).toBe(2);
  });

  it('rejects expressions inside environment list fallbacks', () => {
    const result = compile('env sizes fallback [2 + 3];');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain(
      'Environment fallback lists may contain only literal values',
    );
  });

  it('rejects expressions inside environment list overrides', () => {
    const result = compile('env sizes fallback [1];', {
      sizes: '[2 + 3]',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain(
      'Environment fallback lists may contain only literal values',
    );
  });
});
