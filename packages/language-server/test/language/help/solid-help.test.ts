/**
 * @author Aidan Boissonneault
 * @file solid-help.test.ts
 * @purpose Tests solid help behavior in the language help in language server package.
 * @last-edited October 6, 2026
 */

import { evaluate } from '@bushscad/evaluator';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import { describe, expect, it } from 'vitest';
import { solidHelp } from '../../../src/language/help/solid-help.js';

const diagnosticOnly = new Set(['project', 'trim', 'extend']);

describe('solid language-help examples', () => {
  for (const [name, entry] of Object.entries(solidHelp)) {
    for (const [index, source] of entry.examples.entries()) {
      it(`parses ${name} example ${index + 1}`, () => {
        const parsed = parse(source, 'help.bscd');
        expect(parsed.errors).toEqual([]);
        if (name === 'shape') return; // The example intentionally needs a user CAD asset.
        const resolved = resolve(parsed.ast, 'help.bscd', () => null);
        expect(resolved.errors).toEqual([]);
        const evaluated = evaluate(resolved.ast);
        const messages = evaluated.errors.map((error) => error.message);
        if (diagnosticOnly.has(name)) {
          expect(messages).toContain(
            `${name}(...) is recognized but has no exact sketch geometry implementation yet.`,
          );
        } else {
          expect(messages).toEqual([]);
        }
      });
    }
  }
});
