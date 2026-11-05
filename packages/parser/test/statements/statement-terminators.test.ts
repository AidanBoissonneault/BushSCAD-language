/**
 * @file statement-terminators.test.ts
 * @purpose Tests required semicolon handling in the parser package.
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';

function parseMessages(source: string): string[] {
  return parse(source, 'statement-terminators.test.bscd').errors.map(
    ({ message }) => message,
  );
}

describe('statement terminators', () => {
  it('requires semicolons on top-level and nested value statements', () => {
    expect(parseMessages('var width = 10')).toContain(
      "Expected ';' after statement",
    );
    expect(
      parseMessages(`
part plate {
  sketch profile = rect(10, 8);
  obj body = extrude(profile, 2)
  var thickness = 2;
}`),
    ).toContain("Expected ';' after statement");
  });

  it('keeps braces and return-entry commas as their terminators', () => {
    expect(
      parseMessages(`
ref hidden {
  obj body = cube([4, 4, 2]);
}
part assembly {
  var width = 10;
  if width > 0 {
    var local = width;
  }
}
fn dimensions() {
  return { var width = 10, var height = 4 };
}
`),
    ).toEqual([]);
  });

  it('rejects semicolons between return entries', () => {
    expect(parseMessages('fn values() { return { var x = 1; var y = 2 }; }')).toContain(
      "Expected ',' between return entries; semicolons are not allowed inside return blocks",
    );
  });
});
