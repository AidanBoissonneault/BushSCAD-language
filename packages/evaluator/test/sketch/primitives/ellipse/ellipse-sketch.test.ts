/**
 * @author Aidan Boissonneault
 * @file ellipse-sketch.test.ts
 * @purpose Tests ellipse sketch behavior in the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRSketch } from '@bushscad/ir';
import {
  evalErrorMessages,
  evalOps,
  expectProfileSketch,
  opsOfKind,
} from '../../../core/test-support.js';

describe('exact ellipse evaluation', () => {
  it('lowers direct unequal axes and canonicalizes equal axes', () => {
    const sketches = opsOfKind<IRSketch>(
      evalOps(`
        sketch oval = ellipse(40, 20);
        sketch round = ellipse(12, 12);
      `),
      'sketch',
    );
    expect(sketches[0].primitive).toMatchObject({
      kind: 'ellipse',
      width: 40,
      height: 20,
    });
    expect(sketches[1].primitive).toMatchObject({
      kind: 'circle',
      diameter: 12,
    });
  });

  it('lowers a placed mixed-path ellipse as one exact profile segment', () => {
    const sketch = expectProfileSketch(
      opsOfKind<IRSketch>(
        evalOps(`sketch seal = path(ellipse(40, 20) at (5, -2));`),
        'sketch',
      )[0],
    );
    expect(sketch.primitive.segments).toMatchObject([
      {
        kind: 'ellipse',
        name: 'ellipse_1',
        center: [5, -2],
        radiusX: 20,
        radiusY: 10,
        full: true,
      },
    ]);
  });

  it('evaluates deferred width and height as persistent dimensions', () => {
    const sketch = opsOfKind<IRSketch>(
      evalOps(`
        sketch seal = ellipse(_, _);
        @seal.width = 40;
        @seal.height = 20;
      `),
      'sketch',
    )[0];

    expect(sketch.primitive).toMatchObject({
      kind: 'ellipse',
      width: 40,
      height: 20,
      dimensions: [
        { dimension: 'length', target: 'width', value: 40 },
        { dimension: 'length', target: 'height', value: 20 },
      ],
    });
  });

  it('keeps a mixed-path construction ellipse out of solid profiles', () => {
    const sketch = expectProfileSketch(
      opsOfKind<IRSketch>(
        evalOps(`sketch ellipse_guide = path(construction ellipse(40, 20));`),
        'sketch',
      )[0],
    );

    expect(sketch.primitive.segments[0]).toMatchObject({
      kind: 'ellipse',
      construction: true,
    });
  });

  it('rejects non-positive ellipse dimensions at the source span', () => {
    expect(evalErrorMessages('sketch bad = ellipse(20, 0);')).toContain(
      'ellipse() width and height must be greater than zero.',
    );
  });
});
