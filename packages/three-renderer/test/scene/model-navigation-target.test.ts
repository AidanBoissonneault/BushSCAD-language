/**
 * @author Aidan Boissonneault
 * @file model-navigation-target.test.ts
 * @purpose Tests model navigation target behavior in the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { InteractionSnapshot } from '@bushscad/ir';
import {
  modelTargetLabel,
  resolveModelNavigationTarget,
} from '../../src/scene/model-navigation-target.js';

describe('shared model navigation target', () => {
  it('selects the authored part outside its declaration and object inside it', () => {
    const snapshot: InteractionSnapshot = {
      version: 1,
      entrypoint: '/model.bscd',
      entities: [
        {
          id: 'part',
          kind: 'part',
          name: 'bracket',
          declarationSpan: {
            file: '/model.bscd',
            line: 1,
            col: 1,
            endLine: 5,
            endCol: 2,
          },
          effectIds: [],
          rendered: true,
        },
        {
          id: 'object',
          kind: 'object',
          name: 'body',
          declarationSpan: { file: '/model.bscd', line: 3, col: 3 },
          effectIds: [],
          rendered: true,
        },
      ],
      effects: [],
      references: [],
      topology: [],
    };
    const hit = {
      meshIndex: 0,
      triangleIndex: 0,
      topologyId: 'face',
      ownerEntityId: 'object',
      semanticTargetIds: ['object'],
      partEntityId: 'part',
      objectEntityId: 'object',
      point: [0, 0, 0] as const,
    };
    const outside = resolveModelNavigationTarget(snapshot, hit, {
      file: '/model.bscd',
      line: 8,
      col: 1,
    });
    const inside = resolveModelNavigationTarget(snapshot, hit, {
      file: '/model.bscd',
      line: 3,
      col: 1,
    });
    expect(modelTargetLabel(outside)).toBe('bracket');
    expect(modelTargetLabel(inside)).toBe('body');
  });
});
