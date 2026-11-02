/**
 * @author Aidan Boissonneault
 * @file languageFacts.test.ts
 * @purpose Tests language facts behavior in the language in language server package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { HOVER_DOCS, KEYWORDS } from '../../src/language/languageFacts.js';

describe('language facts', () => {
  it('documents compact rectangle side references', () => {
    expect(HOVER_DOCS.rect).toContain('bottom:');
    expect(HOVER_DOCS.rect).toContain('bare identifiers');
  });

  it('documents the compact rectangle plant suffix', () => {
    expect(HOVER_DOCS.plant).toContain('rect(width, height) plant bottom');
    expect(HOVER_DOCS.rect).toContain('plant bottom|right|top|left');
  });

  it('documents postfix sketch component aliases', () => {
    expect(KEYWORDS).toContain('as');
    expect(HOVER_DOCS.as).toContain('rect(...) as outer');
    expect(HOVER_DOCS.rect).toContain('@body.name.top');
  });

  it('documents point-pair horizontal and vertical constraints', () => {
    expect(HOVER_DOCS.constraint).toContain('align two points');
  });

  it('limits deferred dimensions to compact primitive arguments', () => {
    expect(HOVER_DOCS._).toContain('not a general expression');
    expect(HOVER_DOCS.circle).toContain('@sketch.diameter');
  });

  it('documents compact circle radius drivers', () => {
    expect(HOVER_DOCS.circle).toContain('@sketch.radius');
    expect(HOVER_DOCS.circle).toContain('explicit diameter expression');
  });

  it('documents exact ellipse dimensions', () => {
    expect(HOVER_DOCS.ellipse).toContain('exact axis-aligned');
    expect(HOVER_DOCS.ellipse).toContain('@sketch.width');
    expect(HOVER_DOCS.ellipse).toContain('@sketch.height');
  });

  it('documents selector topology and cardinality', () => {
    expect(HOVER_DOCS.fill).toContain('exactly one');
    expect(HOVER_DOCS.fill).toContain('disconnected');
    expect(HOVER_DOCS.fillet).toContain('de-duplicated');
    expect(HOVER_DOCS.fillet).toContain('@body.(edge1, edge2)');
    expect(HOVER_DOCS.center).toContain('not for fill');
  });
});
