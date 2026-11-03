/**
 * @author Aidan Boissonneault
 * @file interaction-declarations.test.ts
 * @purpose Tests source declaration collection for interaction metadata.
 * @last-edited November 3, 2026
 */

import type { Program, SourceSpan } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import {
  collectInteractionDeclarationSpans,
  interactionDeclarationSource,
} from '../../src/metadata/interaction-declarations.js';

const outerSpan: SourceSpan = {
  file: 'model.bscd',
  line: 1,
  col: 1,
  endLine: 12,
  endCol: 1,
};
const innerSpan: SourceSpan = {
  file: 'model.bscd',
  line: 3,
  col: 2,
  endLine: 5,
  endCol: 8,
};

describe('interaction declaration spans', () => {
  it('collects valid declarations once and chooses the narrowest containing span', () => {
    const inner = {
      kind: 'sketch',
      name: 'profile',
      nameSpan: { ...innerSpan, endLine: undefined, endCol: undefined },
      span: innerSpan,
    };
    const outer: {
      kind: string;
      name: string;
      span: SourceSpan;
      body: unknown[];
    } = {
      kind: 'part',
      name: 'housing',
      span: outerSpan,
      body: [inner],
    };
    const program = {
      kind: 'program',
      baseUnit: null,
      workplane: null,
      span: outerSpan,
      statements: [outer, { kind: 'unknown', span: outerSpan }],
    } as unknown as Program;
    outer.body.push(outer);

    const declarations = collectInteractionDeclarationSpans(program);

    expect(declarations).toEqual([
      { span: outerSpan, name: 'housing' },
      {
        span: innerSpan,
        linkSpan: inner.nameSpan,
        name: 'profile',
      },
    ]);
    expect(
      interactionDeclarationSource(
        { file: 'model.bscd', line: 4, col: 2, endLine: 4, endCol: 4 },
        declarations,
      ),
    ).toEqual({ span: innerSpan, linkSpan: inner.nameSpan, name: 'profile' });
  });

  it('falls back to the operation span when no declaration contains it', () => {
    const operationSpan: SourceSpan = {
      file: 'other.bscd',
      line: 20,
      col: 1,
      endLine: 20,
      endCol: 5,
    };
    expect(interactionDeclarationSource(operationSpan, [])).toEqual({
      span: operationSpan,
    });
  });
});
