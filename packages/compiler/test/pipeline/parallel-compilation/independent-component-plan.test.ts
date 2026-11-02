/**
 * @author Aidan Boissonneault
 * @file independent-component-plan.test.ts
 * @purpose Tests independent component plan behavior in the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  materializePreparedComponentArtifact,
  planIndependentComponentCompilation,
} from '../../../src/index.js';
import { compile } from '../test-support.js';

/**
 * Handles plan in the pipeline parallel compilation flow.
 */
function plan(source: string) {
  const compiled = compile(source);
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) throw new Error(compiled.errors[0]?.message);
  return planIndependentComponentCompilation(
    compiled.program,
    'components.bscd',
  );
}

describe('independent within-part component planning', () => {
  it('plans source-ordered primitive preparation tasks', () => {
    const result = plan(`
part assembly {
  obj first = cuboid([10, 12, 14]);
  transform(first, translate(x: -20));
  obj second = cylinder(14, r: 5);
  transform(second, translate(x: 20));
}
`);
    expect(result.eligible, JSON.stringify(result)).toBe(true);
    if (!result.eligible) return;
    expect(result.tasks.map((task) => task.name)).toEqual(['first', 'second']);
    expect(result.tasks.map((task) => task.operation.kind)).toEqual([
      'solidPrimitive',
      'solidPrimitive',
    ]);
    expect(result.reductionProgram.ops).toHaveLength(5);
  });

  it('carries local sketch and path declarations into solid tasks', () => {
    const result = plan(`
part assembly {
  sketch profile = circle(6);
  obj column = extrude(profile, 20);
  sketch rail_profile = circle(2);
  path rail_path = polyline([(0,0,0), (0,0,20)]);
  obj rail = sweep(rail_profile along rail_path);
}
`);
    expect(result.eligible, JSON.stringify(result)).toBe(true);
    if (!result.eligible) return;
    expect(result.tasks[0]?.program.ops.map((op) => op.kind)).toEqual([
      'part',
      'sketch',
      'extrude',
    ]);
    expect(result.tasks[1]?.program.ops.map((op) => op.kind)).toEqual([
      'part',
      'sketch',
      'path',
      'sweep',
    ]);
  });

  it('resolves a declaration when its solid intentionally reuses its name', () => {
    const result = plan(`
part assembly {
  sketch rectangle = rect(20, 12);
  obj rectangle = extrude(rectangle, 5);
  sketch circular = circle(8);
  obj circular = extrude(circular, 5);
}
`);
    expect(result.eligible, JSON.stringify(result)).toBe(true);
    if (!result.eligible) return;
    expect(result.tasks.map((task) => task.name)).toEqual([
      'rectangle',
      'circular',
    ]);
    expect(result.tasks[0]?.program.ops.map((op) => op.kind)).toEqual([
      'part',
      'sketch',
      'extrude',
    ]);
  });

  it('does not prepare topology-dependent placements', () => {
    const result = plan(`
part assembly {
  obj base = cuboid([20, 20, 5]);
  obj dependent = cylinder(8, r: 3, @base.top.center);
}
`);
    expect(result).toEqual({
      eligible: false,
      reason: 'fewer than two transferable positive components',
    });
  });

  it('leaves cuts and modifiers in the ordered reduction program', () => {
    const result = plan(`
part assembly {
  obj first = cuboid([20, 20, 8]);
  obj second = cylinder(8, r: 4);
  fillet(@first.top.edges, 1);
}
`);
    expect(result.eligible, JSON.stringify(result)).toBe(true);
    if (!result.eligible) return;
    expect(result.tasks).toHaveLength(2);
    expect(result.reductionProgram.ops.at(-1)?.kind).toBe('fillet');
  });

  it('prepares a local solid used as a cutter but keeps its cut ordered', () => {
    const result = plan(`
part assembly {
  sketch base_profile = rect(30, 20);
  obj base = extrude(base_profile, 8);
  sketch tool_profile = circle(4);
  obj tool = extrude(tool_profile, 12);
  obj pocket = cut(tool, @base.top.center);
}
`);
    expect(result.eligible, JSON.stringify(result)).toBe(true);
    if (!result.eligible) return;
    expect(result.tasks.map((task) => task.name)).toEqual(['base', 'tool']);
    expect(result.reductionProgram.ops.at(-1)?.kind).toBe('solid_cut');
  });

  it('emits deterministic loop consumers and executes one shared recipe', () => {
    const source = `
part assembly {
  for i in range(4) {
    obj pin = cylinder(8, r: 2);
    transform(pin, translate(x: i * 12));
  }
}
`;
    const first = plan(source);
    const second = plan(source);
    expect(first.eligible, JSON.stringify(first)).toBe(true);
    expect(second.eligible, JSON.stringify(second)).toBe(true);
    if (!first.eligible || !second.eligible) return;
    expect(first.componentCount).toBe(4);
    expect(first.tasks).toHaveLength(1);
    expect(first.avoidedBuildCount).toBe(3);
    expect(first.tasks[0]?.consumers.map((item) => item.name)).toEqual([
      'pin_0',
      'pin_1',
      'pin_2',
      'pin_3',
    ]);
    expect(first.tasks[0]?.id).toBe(second.tasks[0]?.id);
    expect(new Set(first.tasks[0]?.semanticConsumerIds)).toHaveLength(4);
  });

  it('can disable compile-local reuse for equivalence diagnostics', () => {
    const compiled = compile(`
part assembly {
  obj first = cuboid([10, 12, 14]);
  obj second = cuboid([10, 12, 14]);
}
`);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const reused = planIndependentComponentCompilation(
      compiled.program,
      'components.bscd',
    );
    const uncached = planIndependentComponentCompilation(
      compiled.program,
      'components.bscd',
      { reuseRecipes: false },
    );
    expect(reused.eligible && reused.tasks).toHaveLength(1);
    expect(uncached.eligible && uncached.tasks).toHaveLength(2);
    if (!reused.eligible || !uncached.eligible) return;
    expect(reused.avoidedBuildCount).toBe(1);
    expect(uncached.avoidedBuildCount).toBe(0);
    expect(uncached.tasks.map((task) => task.id)).toHaveLength(2);
  });

  it('fans one BRep out to distinct authored semantic sidecars', () => {
    const result = plan(`
part assembly {
  obj first = cuboid([10, 12, 14]);
  obj second = cuboid([10, 12, 14]);
}
`);
    expect(result.eligible, JSON.stringify(result)).toBe(true);
    if (!result.eligible) return;
    const task = result.tasks[0];
    if (!task) throw new Error('Expected one shared component task.');
    const brep = new Uint8Array([1, 2, 3]);
    const artifacts = materializePreparedComponentArtifact(task, {
      format: 'occt-brep-v1',
      partName: task.partName,
      name: task.name,
      operationKind: task.operation.kind,
      span: task.operation.span,
      semanticConsumerIds: task.semanticConsumerIds,
      brep,
    });
    expect(artifacts.map((artifact) => artifact.name)).toEqual([
      'first',
      'second',
    ]);
    expect(artifacts[0]?.semanticConsumerIds).not.toEqual(
      artifacts[1]?.semanticConsumerIds,
    );
    expect(artifacts.every((artifact) => artifact.brep === brep)).toBe(true);
  });

  it('shares dependency-derived recipes across declarations and source files', () => {
    const compiled = compile(`
part assembly {
  sketch first_profile = circle(5);
  obj first = extrude(first_profile, 12);
  sketch second_profile = circle(5);
  obj second = extrude(second_profile, 12);
}
`);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const ops = compiled.program.ops.map((op) =>
      'objName' in op && op.objName === 'second'
        ? { ...op, span: { ...op.span, file: 'library.bscd' } }
        : op,
    );
    const result = planIndependentComponentCompilation(
      { ...compiled.program, ops },
      'components.bscd',
    );
    expect(result.eligible, JSON.stringify(result)).toBe(true);
    if (!result.eligible) return;
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]?.operation.kind).toBe('extrude');
    expect(result.tasks[0]?.consumers.map((item) => item.name)).toEqual([
      'first',
      'second',
    ]);
    expect(new Set(result.tasks[0]?.semanticConsumerIds)).toHaveLength(2);
  });
});
