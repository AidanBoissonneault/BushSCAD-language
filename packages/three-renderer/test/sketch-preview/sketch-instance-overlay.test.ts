/**
 * @author Aidan Boissonneault
 * @file sketch-instance-overlay.test.ts
 * @purpose Tests sketch instance overlay behavior in the sketch preview in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type {
  InteractionSketchInstance,
  InteractionSnapshot,
} from '@bushscad/ir';
import { DEFAULT_MODEL_HIGHLIGHT_THEME } from '../../src/scene/model-highlight-layer.js';
import { SketchInstanceOverlay } from '../../src/sketch-preview/sketch-instance-overlay.js';

describe('3D sketch instance overlay', () => {
  it('shares local geometry across placed instances and inherits the part group', () => {
    const part = new THREE.Group();
    part.position.x = 25;
    const overlay = new SketchInstanceOverlay(
      () => part,
      DEFAULT_MODEL_HIGHLIGHT_THEME,
    );
    overlay.setSnapshot(snapshot());
    overlay.setChannels({ sketch: ['definition'] });

    const groups = sketchGroups(part);
    expect(groups).toHaveLength(2);
    const firstLine = groups[0]?.children[0] as THREE.LineSegments;
    const secondLine = groups[1]?.children[0] as THREE.LineSegments;
    expect(firstLine.geometry).toBe(secondLine.geometry);
    expect(groups[1]?.matrix.elements[12]).toBe(10);
    expect(overlay.boundsForTargets(['definition'])?.min.x).toBe(23);
    overlay.dispose();
  });

  it('updates geometry and transforms incrementally while rejecting stale revisions', () => {
    const part = new THREE.Group();
    const overlay = new SketchInstanceOverlay(
      () => part,
      DEFAULT_MODEL_HIGHLIGHT_THEME,
    );
    overlay.setSnapshot(snapshot());
    overlay.setChannels({ pinned: ['definition'] });

    expect(
      overlay.updateSketchDefinition('definition', 1, {
        kind: 'circle',
        diameter: 2,
      }),
    ).toBe(false);
    expect(
      overlay.updateSketchDefinition('definition', 2, {
        kind: 'circle',
        diameter: 8,
      }),
    ).toBe(true);
    expect(
      overlay.updateSketchInstances('definition', [instance('third', 40)], 1),
    ).toBe(false);
    expect(
      overlay.updateSketchInstances('definition', [instance('third', 40)], 2),
    ).toBe(true);
    expect(sketchGroups(part)).toHaveLength(1);
    expect(sketchGroups(part)[0]?.matrix.elements[12]).toBe(40);

    overlay.removeSketchDefinition('definition');
    expect(sketchGroups(part)).toEqual([]);
    overlay.dispose();
  });

  it('renders and exposes unsupported placement diagnostics', () => {
    const part = new THREE.Group();
    const overlay = new SketchInstanceOverlay(
      () => part,
      DEFAULT_MODEL_HIGHLIGHT_THEME,
    );
    const model: InteractionSnapshot = {
      ...snapshot(),
      sketchInstances: [
        {
          ...instance('curved', 0),
          unsupportedReason: 'Curved wrapping is unsupported.',
        },
      ],
    };
    overlay.setSnapshot(model);
    overlay.setChannels({ sketch: ['definition'] });

    const group = sketchGroups(part)[0]!;
    expect(group.userData.sketchUnsupportedReason).toContain('unsupported');
    expect(
      group.children.some((child) => child.userData.ownedSketchCueGeometry),
    ).toBe(true);
    overlay.dispose();
  });
});

/**
 * Handles snapshot in the sketch preview flow.
 */
function snapshot(): InteractionSnapshot {
  return {
    version: 1,
    entrypoint: 'part.bscd',
    entities: [],
    effects: [],
    references: [],
    topology: [],
    sketchDefinitions: [
      {
        id: 'definition',
        entityIds: ['sketch'],
        name: 'profile',
        sourceSpan: { file: 'part.bscd', line: 2, col: 3 },
        revision: 1,
        primitive: { kind: 'rect', width: 4, height: 2 },
      },
    ],
    sketchInstances: [instance('first', 0), instance('second', 10)],
  };
}

/**
 * Handles instance in the sketch preview flow.
 */
function instance(id: string, x: number): InteractionSketchInstance {
  return {
    id,
    definitionId: 'definition',
    entityIds: ['sketch'],
    partEntityId: 'part',
    partName: 'plate',
    sourceSpan: { file: 'part.bscd', line: 3, col: 3 },
    placement: null,
    workplane: 'XY',
    transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, 0, 1],
  };
}

/**
 * Handles sketch groups in the sketch preview flow.
 */
function sketchGroups(parent: THREE.Group): THREE.Group[] {
  return parent.children.filter(
    (child): child is THREE.Group =>
      child.name === '__bushscad_sketch_instance',
  );
}
