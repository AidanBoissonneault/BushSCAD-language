/**
 * @author Aidan Boissonneault
 * @file eval-radial-syntax.test.ts
 * @purpose Tests eval radial syntax behavior in the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRRadialCut, IRRadialExtrude } from '@bushscad/ir';
import { evalOps, opsOfKind } from '../core/test-support.js';

/**
 * Evaluates radial syntax and returns the first emitted operation of a kind.
 *
 * Why:
 * These tests each assert a single lowered radial op, so the lookup should be
 * consistent while shared test support owns parse/resolve/evaluate checks.
 */
function evalRadialOp<T extends IRRadialCut | IRRadialExtrude>(
  source: string,
  kind: T['kind'],
): T | undefined {
  return opsOfKind<T>(evalOps(source), kind)[0];
}

/**
 * Builds the common part used by simplified radial lowering tests.
 *
 * Why:
 * Each case needs the same base object and sketch input, while only the radial
 * operation and optional setup differ.
 */
function radialPartSource(
  operation: string,
  options: { baseSize?: string; setup?: string } = {},
): string {
  const setup = options.setup ? `  ${options.setup}\n` : '';
  return `
base_unit = mm;
part p {
${setup}  sketch base = rect(${options.baseSize ?? '20, 20'});
  obj base = extrude(base, 4);
  sketch s = rect(1, 1);
  ${operation}
}
`;
}

describe('simplified radial evaluation', () => {
  it('uses , @placement as inferred radial axis', () => {
    const op = evalRadialOp<IRRadialExtrude>(
      radialPartSource(
        'obj o = radial_extrude(s, from: base.top.center, angle: 90, length: 10);',
      ),
      'radial_extrude',
    );
    expect(op?.from?.faceRef).toBe('base.top.center');
    expect(typeof op?.axis).toBe('object');
  });

  it('emits placement-bridge radial cut extent', () => {
    const op = evalRadialOp<IRRadialCut>(
      radialPartSource(
        'obj o = radial_cut(s, from: base.top.center, to: base.top.center, along: bend_path);',
        { setup: 'path bend_path = polyline([(0,0,0), (5,0,0)]);' },
      ),
      'radial_cut',
    );
    expect(op?.extent.kind).toBe('placement-bridge');
    if (op?.extent.kind === 'placement-bridge') {
      expect(op.extent.guidePathName).toBe('bend_path');
    }
  });

  it('emits placement-bridge radial extrude extent without along', () => {
    const op = evalRadialOp<IRRadialExtrude>(
      radialPartSource(
        'obj o = radial_extrude(s, from: base.left.center, to: base.right.center, curve: ease-in-out);',
        { baseSize: '24, 16' },
      ),
      'radial_extrude',
    );
    expect(op?.extent.kind).toBe('placement-bridge');
    if (op?.extent.kind === 'placement-bridge') {
      expect(op.extent.from.faceRef).toBe('base.left.center');
      expect(op.extent.to.faceRef).toBe('base.right.center');
      expect(op.extent.guidePathName).toBeNull();
    }
    expect(op?.curve.kind).toBe('ease-in-out');
  });

  it('emits auto placement bridge when along is omitted', () => {
    const op = evalRadialOp<IRRadialCut>(
      radialPartSource(
        'obj o = radial_cut(s, from: base.top.center, to: base.front.center, curve: ease-out);',
      ),
      'radial_cut',
    );
    expect(op?.extent.kind).toBe('placement-bridge');
    if (op?.extent.kind === 'placement-bridge') {
      expect(op.extent.guidePathName).toBeNull();
    }
    expect(op?.curve.kind).toBe('ease-out');
  });
});
