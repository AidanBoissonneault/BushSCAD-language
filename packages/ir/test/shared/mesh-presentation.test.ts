/**
 * @author Aidan Boissonneault
 * @file mesh-presentation.test.ts
 * @purpose Tests mesh presentation behavior in the shared in IR package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { meshPresentationMetadata } from '../../src/index.js';

describe('meshPresentationMetadata', () => {
  it('preserves the marker for theme-controlled default colors', () => {
    expect(
      meshPresentationMetadata({
        partName: 'plate',
        bodyName: 'body',
        color: '#2563EB',
        usesDefaultColor: true,
      }),
    ).toEqual({
      partName: 'plate',
      bodyName: 'body',
      color: '#2563EB',
      usesDefaultColor: true,
    });
  });

  it('omits the marker for authored colors', () => {
    expect(
      meshPresentationMetadata({
        partName: 'plate',
        color: '#123456',
        usesDefaultColor: false,
      }),
    ).toEqual({ partName: 'plate', color: '#123456' });
  });
});
