/**
 * @author Aidan Boissonneault
 * @file m40-optional-keyword-args.test.ts
 * @purpose Tests m40 optional keyword args behavior in the metadata in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import type { IRCut } from '@bushscad/ir';
import { evaluate } from '../../src/index.js';

/**
 * Handles no files in the metadata flow.
 */
const noFiles = () => null;

/**
 * Evaluates ok with the current evaluation context.
 */
function evalOk(source: string) {
  const parsed = parse(source, 'm40.bscd');
  expect(parsed.errors).toEqual([]);
  const resolved = resolve(parsed.ast, 'm40.bscd', noFiles);
  expect(resolved.errors).toEqual([]);
  const evaluated = evaluate(resolved.ast);
  expect(evaluated.errors).toEqual([]);
  return evaluated.program;
}

describe('M40 optional keyword argument evaluation', () => {
  it('evaluates shorthand and mixed built-in value arguments', () => {
    const program = evalOk(`
part p {
  sketch base = rect(width: 60, height: 40);
  obj base = extrude(base, depth: 10);
  sketch hole = circle(d: 4);
  obj hole = cut(hole, depth: 2 , @base.top(10, y: 15));
  for i in range(count: 2, step: 1) {
    sketch repeat = circle(1);
    obj repeat = cut(repeat, 1 , @base.top(i, 1));
  }
}`);

    const cuts = program.ops.filter((op): op is IRCut => op.kind === 'cut');
    expect(cuts).toHaveLength(3);
    expect(cuts[0]).toMatchObject({
      depth: 2,
      from: { offsetX: 10, offsetY: 15 },
    });
    expect(cuts.slice(1).map((cut) => cut.from.offsetX)).toEqual([0, 1]);
  });
});
