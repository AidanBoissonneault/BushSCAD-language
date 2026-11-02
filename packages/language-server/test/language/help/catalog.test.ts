/**
 * @author Aidan Boissonneault
 * @file catalog.test.ts
 * @purpose Tests catalog behavior in the language help in language server package.
 * @last-edited October 6, 2026
 */

import { parse } from '@bushscad/parser';
import { describe, expect, it } from 'vitest';
import {
  BUILTINS,
  KEYWORDS,
  SURFACE_REFS,
  UNITS,
} from '../../../src/language/languageFacts.js';
import * as syntax from '../../../src/language/syntaxFacts.js';
import {
  completionDocumentation,
  languageDocumentation,
  languageHelp,
  languageHover,
} from '../../../src/language/help/catalog.js';

const words = [
  ...new Set([
    ...KEYWORDS,
    ...BUILTINS,
    ...SURFACE_REFS,
    ...UNITS,
    ...syntax.BUSHSCAD_KEYWORDS,
    ...syntax.BUSHSCAD_BUILTINS,
    ...syntax.BUSHSCAD_SURFACE_REFS,
    ...syntax.BUSHSCAD_UNITS,
    ...syntax.BUSHSCAD_WORKPLANES,
    ...syntax.BUSHSCAD_BOOLEANS,
  ]),
];

describe('shared language reference catalog', () => {
  it('documents every advertised language token without a generic fallback', () => {
    expect(words.filter((word) => !Object.hasOwn(languageHelp, word))).toEqual(
      [],
    );
    for (const word of words) {
      expect(languageHelp[word].signatures.length, word).toBeGreaterThan(0);
      expect(languageHelp[word].examples.length, word).toBeGreaterThan(0);
      expect(languageDocumentation[word], word).not.toContain(
        'BushSCAD language construct',
      );
      expect(languageDocumentation[word], word).toContain('**Syntax**');
      expect(languageDocumentation[word], word).toContain('**Examples**');
    }
  });

  it.each(Object.entries(languageHelp))(
    'parses every complete %s example',
    (word, entry) => {
      for (const example of entry.examples)
        expect(parse(example, `<help:${word}>`).errors, example).toEqual([]);
    },
  );

  it('does not invent help for unknown words or prototype property names', () => {
    expect(languageHover('not_a_command')).toBeNull();
    expect(languageHover('constructor')).toBeNull();
    expect(completionDocumentation('toString')).toBeUndefined();
  });

  it('retains both meanings of overloaded tokens and compound completion labels', () => {
    expect(languageDocumentation.distance).toContain('constraint');
    expect(languageDocumentation.distance).toContain('assertion');
    expect(completionDocumentation('obj cube')).toContain('cube');
    expect(completionDocumentation('obj cube')).toContain('Arguments');
  });
});
