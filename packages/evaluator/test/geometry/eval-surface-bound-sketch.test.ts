/**
 * @author Aidan Boissonneault
 * @file eval-surface-bound-sketch.test.ts
 * @purpose Tests eval surface bound sketch behavior in the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import { evaluate } from '../../src/index.js';
import type { IRCut, IRExtrude, IROp, IRSketch } from '@bushscad/ir';

/**
 * Handles no files in the geometry flow.
 */
const noFiles = () => null;

/**
 * Evaluates source with the current evaluation context.
 */
function evalSource(src: string) {
  const parsed = parse(src, 'surface-bound-sketch.bscd');
  expect(parsed.errors).toEqual([]);
  const resolved = resolve(
    parsed.ast,
    'surface-bound-sketch.bscd',
    noFiles,
  );
  expect(resolved.errors).toEqual([]);
  return evaluate(resolved.ast);
}

/**
 * Evaluates ok with the current evaluation context.
 */
function evalOk(src: string) {
  const result = evalSource(src);
  expect(result.errors).toEqual([]);
  return result.program;
}

/**
 * Handles ops of kind in the geometry flow.
 */
function opsOfKind<T extends IROp>(ops: IROp[], kind: T['kind']): T[] {
  return ops.filter((op) => op.kind === kind) as T[];
}

describe('surface-bound sketch evaluation', () => {
  it('emits surfaceBound metadata and uses it as the extrude placement', () => {
    const program = evalOk(`
sketch base_sk = circle(60);
obj base = extrude(base_sk, 8);
sketch pad = rect(80, 80, @base.top);
obj pad = extrude(pad, 2);
`);

    const padSketch = opsOfKind<IRSketch>(program.ops, 'sketch').find(
      (op) => op.name === 'pad',
    );
    const padExtrude = opsOfKind<IRExtrude>(program.ops, 'extrude').find(
      (op) => op.objName === 'pad',
    );
    expect(padSketch?.surfaceBound?.faceRef).toBe('base.top');
    expect(padExtrude?.from?.faceRef).toBe('base.top');
  });

  it('uses the bound face for cut placement when , @is omitted', () => {
    const program = evalOk(`
sketch base_sk = circle(60);
obj base = extrude(base_sk, 8);
sketch drain = circle(5, @base.top);
obj drain = cut(drain, through base);
`);

    const cut = opsOfKind<IRCut>(program.ops, 'cut')[0];
    expect(cut.from.faceRef).toBe('base.top');
  });

  it('rejects reuse of a surface-bound sketch', () => {
    const result = evalSource(`
sketch base_sk = circle(60);
obj base = extrude(base_sk, 8);
sketch pad = rect(20, 20, @base.top);
obj a = extrude(pad, 1);
obj b = extrude(pad, 1);
`);

    expect(result.errors.map((error) => error.message)).toContain(
      "Surface-bound sketch 'pad' can only be consumed once",
    );
  });

  it('rejects reuse through loop unrolling', () => {
    const result = evalSource(`
part holder {
sketch base_sk = circle(60);
obj base = extrude(base_sk, 8);
sketch pad = rect(20, 20, @base.top);
for i in range(2) {
  obj pad_feature = extrude(pad, 1 , @base.top.center(radius: 10, angle: i * 180));
}
}
`);

    expect(result.errors.map((error) => error.message)).toContain(
      "Surface-bound sketch 'pad' can only be consumed once",
    );
  });

  it('evaluates inset against the bound face context', () => {
    const program = evalOk(`
sketch base_sk = rect(60, 40);
obj base = extrude(base_sk, 8);
sketch lid = rect inset(5, @base.top);
obj lid = extrude(lid, 1);
`);

    const lid = opsOfKind<IRSketch>(program.ops, 'sketch').find(
      (op) => op.name === 'lid',
    );
    expect(lid?.primitive).toMatchObject({
      kind: 'rect',
      width: 50,
      height: 30,
    });
  });

  it('evaluates the circular soap holder example', () => {
    const source = readFileSync(
      new URL(
        '../../../../examples/test-33-surface-bound-sketch-on.bscd',
        import.meta.url,
      ),
      'utf8',
    );
    evalOk(source);
  });
});
