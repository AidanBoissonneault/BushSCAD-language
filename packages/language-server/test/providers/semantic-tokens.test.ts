/**
 * @author Aidan Boissonneault
 * @file semantic-tokens.test.ts
 * @purpose Tests semantic tokens behavior in the providers in language server package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { collectSemanticTokens } from '../../src/providers/semanticTokens.js';

describe('drawing semantic tokens', () => {
  it('classifies drawing declarations and statements as language keywords', () => {
    const source = [
      'drawing plate_sheet {',
      '  view main.top scale: 1;',
      '  dimension main.width;',
      "  export svg './plate.svg';",
      '}',
    ].join('\n');
    const keywordTexts = collectSemanticTokens(source)
      .filter((token) => token.type === 'keyword')
      .map((token) =>
        source
          .split('\n')
          [token.line - 1].slice(token.col - 1, token.col - 1 + token.length),
      );

    expect(keywordTexts).toEqual([
      'drawing',
      'view',
      'scale',
      'dimension',
      'export',
      'svg',
    ]);
  });

  it('does not classify language words inside strings or comments', () => {
    const tokens = collectSemanticTokens(
      "// drawing view\nexport svg './drawing.svg'; /* dimension */",
    );
    expect(tokens.map((token) => token.type)).toEqual(['keyword', 'keyword']);
  });

  it('classifies substitutions but ignores template string text', () => {
    const source = 'var label = `drawing ${range + 1} view`;';
    const tokenTexts = collectSemanticTokens(source).map((token) =>
      source.slice(token.col - 1, token.col - 1 + token.length),
    );

    expect(tokenTexts).toEqual(['var', 'range']);
  });

  it('classifies joint declarations and properties as language keywords', () => {
    const source =
      'slider drawer_slide(@drawer.front, @case.front) { range = 0mm..80mm; default = 0mm; }';
    const keywordTexts = collectSemanticTokens(source)
      .filter((token) => token.type === 'keyword')
      .map((token) =>
        source.slice(token.col - 1, token.col - 1 + token.length),
      );

    expect(keywordTexts).toEqual(['slider', 'range', 'default']);
  });
});
