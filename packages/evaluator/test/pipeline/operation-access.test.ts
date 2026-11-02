/**
 * @author Aidan Boissonneault
 * @file operation-access.test.ts
 * @purpose Tests operation access behavior in the pipeline in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRAssert, IRMirror, IRSolidCut } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { operationAccess } from '../../src/index.js';

const span = { file: 'access.bscd', line: 3, col: 5 };

describe('operation access classification', () => {
  it('separates semantic provenance from expanded scheduling dependencies', () => {
    const fit = operationAccess({
      kind: 'fit',
      fitKind: 'clearance',
      fitName: 'bolt_fit',
      relation: 'through',
      targetName: 'housing.hole',
      toleranceLevel: 'normal',
      resolvedOffsetMm: 0.2,
      processProfile: 'std.printing.fdm',
      span,
    });

    expect(fit.semanticInputs).toEqual([]);
    expect(fit.semanticOutputs).toEqual([]);
    expect(fit.schedulingInputs).toEqual(['housing']);
    expect(fit.schedulingOutputs).toEqual(['bolt_fit']);
    expect(fit.role).toBe('relationship');
  });

  it('discovers topology reads nested in assertions and mirror planes', () => {
    const assertion: IRAssert = {
      kind: 'assert',
      left: {
        kind: 'binary',
        op: '+',
        left: { kind: 'query', fn: 'volume', args: ['body'] },
        right: { kind: 'query', fn: 'face_area', args: ['lid.top'] },
      },
      op: '>',
      right: { kind: 'literal', value: 0 },
      severity: 'error',
      message: null,
      span,
    };
    const mirror: IRMirror = {
      kind: 'mirror',
      objName: 'bracket',
      across: { kind: 'faceRef', ref: 'housing.right' },
      span,
    };

    expect(operationAccess(assertion).schedulingInputs).toEqual([
      'body',
      'lid',
    ]);
    expect(operationAccess(mirror).schedulingInputs).toEqual([
      'bracket',
      'housing',
    ]);
  });

  it('includes dependencies of inline solid-cut tool recipes', () => {
    const solidCut: IRSolidCut = {
      kind: 'solid_cut',
      objName: 'body',
      tool: {
        kind: 'operation',
        operation: {
          kind: 'extrude',
          objName: 'tool',
          sketchName: 'cutter',
          depth: 10,
          from: null,
          symmetric: false,
          wrap: false,
          span,
        },
      },
      from: {
        faceRef: 'body.top',
      },
      span,
    };

    expect(operationAccess(solidCut).schedulingInputs).toEqual([
      'body',
      'tool',
      'cutter',
    ]);
    expect(operationAccess(solidCut)).toMatchObject({
      polarity: 'negative',
      topologySensitive: true,
      continuation: true,
      partEffect: true,
    });
  });
});
