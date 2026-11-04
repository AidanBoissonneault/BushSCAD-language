/**
 * @author Aidan Boissonneault
 * @file command-call-syntax.test.ts
 * @purpose Tests command call syntax behavior in the statements in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type {
  AssertStatement,
  ComponentStatement,
  FitDecl,
  MirrorStmt,
  PartDecl,
  PatternLinearStmt,
  PatternRadialStmt,
  ThreadDetail,
  TransformStmt,
} from '@bushscad/ir';
import { parse } from '../../src/core/parser.js';
import { parseOk } from '../fixtures/parse.js';
import { faceChain } from '../fixtures/face-ref-format.js';

/**
 * Handles statements in the statements flow.
 */
function statements(source: string): ComponentStatement[] {
  const ast = parseOk(source);
  return (ast.statements[0] as PartDecl).body.statements;
}

/**
 * Handles statement of in the statements flow.
 */
function statementOf<T extends ComponentStatement>(
  body: ComponentStatement[],
  kind: T['kind'],
  index = 0,
): T {
  const matches = body.filter((stmt) => stmt.kind === kind);
  if (!matches[index]) throw new Error(`missing ${kind}[${index}]`);
  return matches[index] as T;
}

describe('call-style command syntax', () => {
  it('parses pattern, mirror, and transform calls with optional labels', () => {
    const body = statements(`
part p {
  sketch base = rect(20, 20);
  obj base = extrude(base, 10);
  sketch hole = circle(2);
  obj hole = cut(hole, through base);
  pattern(hole, linear, 4, 12);
  pattern(target: hole, mode: radial, count: 6, around: base.top.center);
  mirror(target: base, across: plane(center));
  transform(base, translate(10, y: 5, z: 2));
  transform(target: base, operation: rotate(angle: 45deg, around: z));
}
`);

    const linear = statementOf<PatternLinearStmt>(body, 'patternLinear');
    expect(linear.target).toBe('hole');
    expect(linear.countX.kind).toBe('number');
    expect(linear.spacingX.kind).toBe('number');

    const radial = statementOf<PatternRadialStmt>(body, 'patternRadial');
    expect(radial.target).toBe('hole');
    expect(faceChain(radial.around)).toBe('base.top.center');

    const mirror = statementOf<MirrorStmt>(body, 'mirror');
    expect(mirror.across).toEqual({ kind: 'named', name: 'center' });

    const translate = statementOf<TransformStmt>(body, 'transform');
    expect(translate.operation).toMatchObject({ kind: 'translate' });

    const rotate = statementOf<TransformStmt>(body, 'transform', 1);
    expect(rotate.operation).toMatchObject({ kind: 'rotate', around: 'z' });
  });

  it('parses assert, fit, and thread calls with optional labels', () => {
    const body = statements(`
part p {
  sketch base = rect(20, 20);
  obj base = extrude(base, 10);
  sketch hole = circle(2);
  obj hole = cut(hole, through base);
  assert(condition: volume(base) > 1, warning: 'too small');
  fit(clearance, M3_bolt, through, hole);
  thread(target: hole, type: internal, d: 4, pitch: 0.7, length: 8, direction: counterclockwise);
}
`);

    const assertion = statementOf<AssertStatement>(body, 'assert');
    expect(assertion.severity).toBe('warning');
    expect(assertion.message).toBe('too small');

    const fit = statementOf<FitDecl>(body, 'fit');
    expect(fit).toMatchObject({
      fitKind: 'clearance',
      fitName: 'M3_bolt',
      relation: 'through',
      targetName: 'hole',
      toleranceLevel: 'normal',
    });

    const thread = statementOf<ThreadDetail>(body, 'thread');
    expect(thread).toMatchObject({
      target: 'hole',
      threadType: 'internal',
      direction: 'counter_clockwise',
    });
  });

  it('fills positional arguments after labeled arguments in call order', () => {
    const body = statements(`
part p {
  sketch base = rect(20, 20);
  obj base = extrude(base, 10);
  sketch hole = circle(2);
  obj hole = cut(hole, through base);
  pattern(target: hole, radial, 6, base.top.center);
  transform(target: base, translate(x: 1, 2, 3));
  assert(condition: volume(base) > 1, warning, 'too small');
  fit(kind: clearance, M3_bolt, through, hole);
  thread(target: hole, external, 4, 1, length: 8);
}
`);

    expect(statementOf<PatternRadialStmt>(body, 'patternRadial')).toMatchObject(
      {
        target: 'hole',
        count: { kind: 'number', value: 6 },
      },
    );
    const transform = statementOf<TransformStmt>(body, 'transform');
    expect(transform.target).toBe('base');
    expect(transform.operation).toMatchObject({
      kind: 'translate',
      x: { kind: 'number', value: 1 },
      y: { kind: 'number', value: 2 },
      z: { kind: 'number', value: 3 },
    });
    expect(statementOf<AssertStatement>(body, 'assert')).toMatchObject({
      severity: 'warning',
      message: 'too small',
    });
    expect(statementOf<FitDecl>(body, 'fit')).toMatchObject({
      fitKind: 'clearance',
      fitName: 'M3_bolt',
      relation: 'through',
      targetName: 'hole',
    });
    expect(statementOf<ThreadDetail>(body, 'thread')).toMatchObject({
      target: 'hole',
      threadType: 'external',
      diameter: { kind: 'number', value: 4 },
      pitch: { kind: 'number', value: 1 },
      length: { kind: 'number', value: 8 },
    });
  });

  it('rejects removed legacy command forms', () => {
    const result = parse(
      `
part p {
  sketch base = rect(20, 20);
  obj base = extrude(base, 10);
  pattern base linear x: 2 spacing: 5;
  mirror base across X;
  transform base translate(x: 1);
  assert volume(base) > 0;
  fit clearance M3_bolt through base tolerance: normal;
  thread: base type: external d: 6 pitch: 1;
}
`,
      'legacy-command-syntax.bscd',
    );

    expect(result.errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('pattern syntax is pattern'),
        expect.stringContaining('mirror syntax is mirror'),
        expect.stringContaining('transform syntax is transform'),
        expect.stringContaining('assert syntax is assert'),
        expect.stringContaining('fit syntax is fit'),
        expect.stringContaining('thread syntax is thread'),
      ]),
    );
  });
});
