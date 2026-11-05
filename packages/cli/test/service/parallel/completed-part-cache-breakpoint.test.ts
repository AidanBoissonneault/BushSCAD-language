import { describe, expect, it } from 'vitest';
import type { SourceSpan } from '@bushscad/ir';
import { completedPartCacheBreakpoint } from '../../../src/service/parallel/completed-part-cache-breakpoint.js';

describe('completed-part cache breakpoint location', () => {
  it('anchors the full-part marker after later placed geometry', () => {
    const event = completedPartCacheBreakpoint(
      [
        { kind: 'part', span: { ...span(2), endLine: 10, endCol: 2 } },
        { kind: 'sketch', span: span(4) },
        { kind: 'extrude', span: span(5) },
        { kind: 'solidPrimitive', span: span(9) },
      ],
      'shell',
      0,
      100,
    );

    expect(event?.span).toEqual({
      file: 'model.bscd',
      line: 10,
      col: 2,
      endLine: 10,
      endCol: 2,
    });
    expect(event?.message).toContain('completed-part');
  });

  it('falls back to the part header when no geometry operation has a source span', () => {
    const event = completedPartCacheBreakpoint(
      [{ kind: 'part', span: span(2) }, { kind: 'extrude' }],
      'shell',
      0,
      100,
    );

    expect(event?.span).toEqual(span(2));
  });
});

/** Creates a source span on one line in a synthetic model. */
function span(line: number): SourceSpan {
  return { file: 'model.bscd', line, col: 1 };
}
