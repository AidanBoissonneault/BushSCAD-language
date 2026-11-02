/**
 * @author Aidan Boissonneault
 * @file selector-compatibility.test.ts
 * @purpose Tests selector compatibility behavior in the references in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  SELECTOR_CONSUMER_COMPATIBILITY,
  SELECTOR_CONSUMERS,
  SELECTOR_KINDS,
  selectorConsumerCompatibility,
  selectorConsumerDiagnostic,
} from '../../src/references/refs.js';
import { resolveErrors } from '../core/test-support.js';

describe('selector/consumer compatibility', () => {
  it('contains one explicit cell for every selector and consumer', () => {
    expect(Object.keys(SELECTOR_CONSUMER_COMPATIBILITY)).toEqual(
      SELECTOR_KINDS,
    );
    for (const selector of SELECTOR_KINDS) {
      expect(Object.keys(SELECTOR_CONSUMER_COMPATIBILITY[selector])).toEqual(
        SELECTOR_CONSUMERS,
      );
    }
  });

  it('keeps the three face fill forms topologically distinct', () => {
    expect(selectorConsumerCompatibility('face', 'fill')).toBe(
      'preserve-face-wires',
    );
    expect(selectorConsumerCompatibility('face-perimeter', 'fill')).toBe(
      'use-outer-loop',
    );
    expect(selectorConsumerCompatibility('face-edges', 'fill')).toBe(
      'rebuild-classified-loops',
    );
  });

  it('limits bare-object edge inference to fillet and chamfer', () => {
    for (const consumer of SELECTOR_CONSUMERS) {
      const expected =
        consumer === 'fillet' || consumer === 'chamfer'
          ? 'infer-object-edges'
          : consumer === 'measurement'
            ? 'measure-by-query'
            : consumer === 'selection-highlight'
              ? 'preserve-selection'
              : null;
      expect(selectorConsumerCompatibility('bare-object', consumer)).toBe(
        expected,
      );
    }
  });

  it('keeps face, edge, and corner consumer coercions explicit', () => {
    expect(selectorConsumerCompatibility('face', 'fillet')).toBe(
      'derive-boundary-edges',
    );
    expect(selectorConsumerCompatibility('named-edge', 'revolve-axis')).toBe(
      'use-edge-axis',
    );
    expect(selectorConsumerCompatibility('edge-intersection', 'fillet')).toBe(
      'use-selected-edges',
    );
    expect(selectorConsumerCompatibility('named-corner', 'chamfer')).toBe(
      'use-incident-edges',
    );
    expect(selectorConsumerCompatibility('named-corner', 'fillet')).toBeNull();
    expect(selectorConsumerCompatibility('face-edges', 'draft')).toBeNull();
  });

  it('validates intersection operands against the owning object', () => {
    const errors = resolveErrors(`
part intersections {
  sketch profile = rect(20, 10, right: first) + rect(10, 20, top: second);
  obj body = extrude(profile, 4);
  fillet(@body.(first, missing), 1);
}
`);

    expect(errors).toContain("Unknown named edge 'missing' on object 'body'");
  });

  it('records singular and repeatable expansion policies', () => {
    for (const consumer of [
      'fill',
      'sketch-on-surface',
      'revolve-axis',
    ] as const) {
      expect(
        selectorConsumerCompatibility('expanded-selection', consumer),
      ).toBe('validate-one-expanded-member');
    }
    for (const consumer of [
      'placement',
      'fillet',
      'chamfer',
      'draft',
      'selection-highlight',
    ] as const) {
      expect(
        selectorConsumerCompatibility('expanded-selection', consumer),
      ).toBe('repeat-expanded-members');
    }
  });

  it('returns a precise diagnostic only for invalid cells', () => {
    expect(selectorConsumerDiagnostic('face-edges', 'draft')).toBe(
      'draft does not accept a face edge set; expected a face',
    );
    expect(selectorConsumerDiagnostic('face', 'draft')).toBeNull();
    expect(selectorConsumerDiagnostic('named-corner', 'fill')).toContain(
      'fill does not accept a named corner',
    );
  });

  it('applies compatibility and cardinality at real consumer boundaries', () => {
    const errors = resolveErrors(`
part selectors {
  obj body = extrude(rect(20, 10), 4);
  surface invalid_kind = fill(body.top.corner.front_left);
  surface invalid_count = fill(@body.[top, bottom]);
}
`);

    expect(errors).toContain(
      'fill does not accept a named corner; expected a closed sketch boundary, a face, a face perimeter, a face edge set, or a named edge',
    );
    expect(errors).toContain(
      'fill requires exactly one selector target; received 2',
    );
  });
});
