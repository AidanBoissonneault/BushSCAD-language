/**
 * @author Aidan Boissonneault
 * @file part-deps.test.ts
 * @purpose Tests part deps behavior in the core in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, it, expect } from 'vitest';
import type { IROp, IRProgram, SourceSpan } from '@bushscad/ir';
import { originRootedParts } from '../../src/core/part-deps.js';

const span: SourceSpan = { file: 't.bscd', line: 1, col: 1 };

/**
 * Handles part boundary in the core flow.
 */
function partBoundary(name: string): IROp {
  return { kind: 'part', name, color: null, span };
}

/**
 * Handles sketch in the core flow.
 */
function sketch(name: string, placementRef: string | null): IROp {
  return {
    kind: 'sketch',
    name,
    primitive: { kind: 'rect', width: 10, height: 10, span },
    placement: placementRef ? { faceRef: placementRef } : null,
    span,
  } as IROp;
}

/**
 * Handles extrude in the core flow.
 */
function extrude(objName: string, sketchName: string, fromRef?: string): IROp {
  return {
    kind: 'extrude',
    objName,
    sketchName,
    depth: 10,
    from: fromRef ? { faceRef: fromRef } : null,
    symmetric: false,
    wrap: false,
    span,
  } as IROp;
}

/**
 * Handles program in the core flow.
 */
function program(ops: IROp[], parts: string[]): IRProgram {
  return { ops, parts, baseUnitMm: 1 };
}

describe('originRootedParts', () => {
  it('returns empty for null IR', () => {
    expect(originRootedParts(null).size).toBe(0);
  });

  it('parts placed on world planes are all origin-rooted', () => {
    const ir = program(
      [
        partBoundary('a'),
        sketch('s1', 'xy'),
        extrude('boxA', 's1'),
        partBoundary('b'),
        sketch('s2', 'xy'),
        extrude('boxB', 's2'),
      ],
      ['a', 'b'],
    );
    const out = originRootedParts(ir);
    expect(out.has('a')).toBe(true);
    expect(out.has('b')).toBe(true);
  });

  it('a part placed on another part is marked derived', () => {
    const ir = program(
      [
        partBoundary('base'),
        sketch('s1', null),
        extrude('plate', 's1'),
        partBoundary('lid'),
        sketch('s2', 'plate.top'),
        extrude('lidBody', 's2'),
      ],
      ['base', 'lid'],
    );
    const out = originRootedParts(ir);
    expect(out.has('base')).toBe(true);
    expect(out.has('lid')).toBe(false);
  });

  it('extrude `from` referencing another part marks it derived', () => {
    // Mirrors test-23-M30-hinge.bscd: lid extrudes `from box.top.center`,
    // so the lid is built off the box and should stay attached in Origin mode.
    const ir = program(
      [
        partBoundary('box'),
        sketch('s1', null),
        extrude('body', 's1'),
        partBoundary('lid'),
        sketch('s2', null),
        extrude('panel', 's2', 'box.top.center'),
      ],
      ['box', 'lid'],
    );
    const out = originRootedParts(ir);
    expect(out.has('box')).toBe(true);
    expect(out.has('lid')).toBe(false);
  });

  it('self-referencing faces inside the same part stay origin-rooted', () => {
    const ir = program(
      [
        partBoundary('a'),
        sketch('s1', null),
        extrude('mainBody', 's1'),
        sketch('s2', 'mainBody.top'),
        extrude('boss', 's2'),
      ],
      ['a'],
    );
    const out = originRootedParts(ir);
    expect(out.has('a')).toBe(true);
  });
});
