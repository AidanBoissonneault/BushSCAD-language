/**
 * @author Aidan Boissonneault
 * @file sketch-preview-primitive-dispatch.test.ts
 * @purpose Tests sketch preview primitive dispatch and composition.
 * @last-edited November 3, 2026
 */

import * as THREE from 'three';
import type { IRPrimitive, SketchPreviewModel } from '@bushscad/ir';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drawSketchPrimitive } from '../../src/sketch-preview/sketch-preview-primitive-dispatch.js';

const renderers = vi.hoisted(() => ({
  primitive: vi.fn(),
  profile: vi.fn(),
  word: vi.fn(),
}));

vi.mock('../../src/sketch-preview/sketch-preview-primitives.js', () => ({
  drawPrimitive: renderers.primitive,
}));
vi.mock('../../src/sketch-preview/sketch-preview-profiles.js', () => ({
  drawProfile: renderers.profile,
  drawWord: renderers.word,
}));

const preview = {} as SketchPreviewModel;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sketch preview primitive dispatch', () => {
  it('groups translated children and renders both boolean operands', () => {
    const target = new THREE.Group();
    const translated: IRPrimitive = {
      kind: 'sketchAt',
      primitive: { kind: 'rect', width: 10, height: 6 },
      x: 4,
      y: -3,
    };
    drawSketchPrimitive(target, translated, preview, 80);
    const translatedGroup = target.children[0] as THREE.Group;
    expect(translatedGroup.position.toArray()).toEqual([4, -3, 0]);
    expect(renderers.primitive).toHaveBeenCalledWith(
      translatedGroup,
      translated.primitive,
      80,
    );

    const booleanTarget = new THREE.Group();
    renderers.primitive.mockClear();
    drawSketchPrimitive(
      booleanTarget,
      {
        kind: 'sketchBoolean',
        op: 'add',
        left: { kind: 'rect', width: 10, height: 6 },
        right: { kind: 'circle', diameter: 5 },
      },
      preview,
      80,
    );
    expect(renderers.primitive).toHaveBeenCalledTimes(2);
    expect(renderers.primitive).toHaveBeenNthCalledWith(
      1,
      booleanTarget,
      { kind: 'rect', width: 10, height: 6 },
      80,
    );
    expect(renderers.primitive).toHaveBeenNthCalledWith(
      2,
      booleanTarget,
      { kind: 'circle', diameter: 5 },
      80,
    );
  });

  it('does not render unresolved sketch references', () => {
    const target = new THREE.Group();
    drawSketchPrimitive(target, { kind: 'sketchRef', name: 'missing' }, preview, 80);
    expect(renderers.primitive).not.toHaveBeenCalled();
  });
});
