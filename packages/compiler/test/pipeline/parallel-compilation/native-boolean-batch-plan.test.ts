/**
 * @author Aidan Boissonneault
 * @file native-boolean-batch-plan.test.ts
 * @purpose Tests native boolean batch plan behavior in the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { planNativeBooleanBatches } from '../../../src/index.js';
import { compile } from '../test-support.js';

/**
 * Handles plan in the pipeline parallel compilation flow.
 */
function plan(source: string) {
  const result = compile(source);
  expect(result.ok, JSON.stringify(result.ok ? [] : result.errors)).toBe(true);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return planNativeBooleanBatches(result.program);
}

describe('native boolean batch proof', () => {
  it('groups within-loop holes across immutable sketch preparations', () => {
    const result = plan(`
part plate {
  sketch base_profile = rect(120, 80);
  obj base = extrude(base_profile, 8);
  for i in range(4) within base.top.width {
    sketch hole = circle(4);
    obj hole = cut(hole, through base, @base.top(x: auto, y: 20));
  }
}
`);
    expect(result.batches).toHaveLength(1);
    expect(result.batches[0]).toMatchObject({
      kind: 'cut',
      targetName: 'base',
      memberNames: ['hole_0', 'hole_1', 'hole_2', 'hole_3'],
    });
  });

  it('uses the same planner for ordinary authored cuts', () => {
    const result = plan(`
part plate {
  sketch base_profile = rect(80, 60);
  obj base = extrude(base_profile, 8);
  sketch first_profile = circle(3);
  sketch second_profile = circle(3);
  obj first = cut(first_profile, 8, @base.top(x: 20, y: 20));
  obj second = cut(second_profile, 8, @base.top(x: 50, y: 20));
}
`);
    expect(result.batches[0]?.memberNames, JSON.stringify(result)).toEqual([
      'first',
      'second',
    ]);
  });

  it('groups additive extrusions anchored to one pre-run surface', () => {
    const result = plan(`
part plate {
  sketch base_profile = rect(80, 60);
  obj base = extrude(base_profile, 8);
  sketch first_profile = circle(5);
  obj first = extrude(first_profile, 6, @base.top(x: 20, y: 20));
  sketch second_profile = circle(5);
  obj second = extrude(second_profile, 6, @base.top(x: 50, y: 20));
  fuse(base, first, second);
}
`);
    expect(result.batches[0]).toMatchObject({
      kind: 'additive-extrude',
      targetName: 'base',
      memberNames: ['first', 'second'],
    });
    expect(result.batches).toHaveLength(1);
  });

  it('natively fuses independent bodies after their world placements are fixed', () => {
    const result = plan(`
part placed_fuse {
  sketch profile_a = rect(24, 20);
  obj first = extrude(profile_a, 8);
  sketch profile_b = rect(24, 20);
  obj second = extrude(profile_b, 8);
  transform(second, translate(x: 12));
  sketch profile_c = rect(24, 20);
  obj third = extrude(profile_c, 8);
  transform(third, translate(x: 24));
  fuse(first, second, third);
}
`);
    expect(result.batches).toContainEqual(
      expect.objectContaining({
        kind: 'fuse',
        targetName: 'first',
        memberNames: ['first', 'second', 'third'],
      }),
    );
  });

  it('preserves compound semantics when additive members are not fused', () => {
    const result = plan(`
part plate {
  sketch base_profile = rect(80, 60);
  obj base = extrude(base_profile, 8);
  sketch first_profile = circle(5);
  obj first = extrude(first_profile, 6, @base.top(x: 20, y: 20));
  sketch second_profile = circle(5);
  obj second = extrude(second_profile, 6, @base.top(x: 50, y: 20));
}
`);
    expect(result.batches).toHaveLength(0);
    expect(result.rejections[0]?.reason).toMatch(/explicit fuse/);
  });

  it('rejects a generated target and an intervening topology observer', () => {
    const generatedTarget = plan(`
part plate {
  sketch base_profile = rect(80, 60);
  obj base = extrude(base_profile, 8);
  sketch first_profile = circle(3);
  obj first = cut(first_profile, 4, @base.top(x: 20, y: 20));
  sketch second_profile = circle(2);
  obj second = cut(second_profile, 2, @first.inner.bottom.center);
}
`);
    expect(generatedTarget.batches).toHaveLength(0);
    expect(
      generatedTarget.rejections.map(({ reason }) => reason).join(' '),
    ).toMatch(/different targets|generated|fewer/i);

    const observedSource = compile(`
part plate {
  sketch base_profile = rect(80, 60);
  obj base = extrude(base_profile, 8);
  sketch first_profile = circle(3);
  obj first = cut(first_profile, 8, @base.top(x: 20, y: 20));
  fillet(@base.top.edges, 1);
  sketch second_profile = circle(3);
  obj second = cut(second_profile, 8, @base.top(x: 50, y: 20));
}
`);
    expect(observedSource.ok).toBe(true);
    if (!observedSource.ok) return;
    const ordered = [...observedSource.program.ops];
    const filletIndex = ordered.findIndex((op) => op.kind === 'fillet');
    const secondCutIndex = ordered.map((op) => op.kind).lastIndexOf('cut');
    const [fillet] = ordered.splice(filletIndex, 1);
    if (!fillet) throw new Error('Expected a fillet observer.');
    ordered.splice(secondCutIndex, 0, fillet);
    const observed = planNativeBooleanBatches({
      ...observedSource.program,
      ops: ordered,
    });
    expect(observed.batches).toHaveLength(0);
    expect(
      observed.rejections.some(({ reason }) => reason.includes('fillet')),
      JSON.stringify(observed),
    ).toBe(true);

    const surfaceObserved = plan(`
part plate {
  sketch base_profile = rect(80, 60);
  obj base = extrude(base_profile, 8);
  sketch first_profile = circle(3);
  obj first = cut(first_profile, 8, @base.top(x: 20, y: 20));
  sketch second_profile = circle(3, @base.top);
  obj second = cut(second_profile, 8, @base.top(x: 50, y: 20));
}
`);
    expect(surfaceObserved.batches).toHaveLength(0);
    expect(surfaceObserved.rejections[0]?.reason).toMatch(
      /intervening profile observes/,
    );
  });
});
