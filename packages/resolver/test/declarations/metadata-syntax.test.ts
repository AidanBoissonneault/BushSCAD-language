/**
 * @author Aidan Boissonneault
 * @file metadata-syntax.test.ts
 * @purpose Tests metadata syntax behavior in the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors } from '../core/test-support.js';

describe('metadata assignment resolution', () => {
  it('accepts direct part metadata and object overrides in part bodies', () => {
    const errors = resolveErrors(`
part p {
  var finish = 'PLA';
  var accent = #88ccff;
  part.material = finish;
  part.color = accent;
  sketch s = rect(1, 1);
  obj base = extrude(s, 1);
  base.material = 'PETG';
  base.color = #111111;
}
`);
    expect(errors).toHaveLength(0);
  });

  it('resolves variable-backed color expressions and undefined names', () => {
    expect(
      resolveErrors(`
part p {
  var accent = #88ccff;
  part.color = accent;
}
`),
    ).toHaveLength(0);

    expect(
      resolveErrors(`
part p {
  part.color = missing_color;
}
`),
    ).toEqual(expect.arrayContaining(["Undefined variable 'missing_color'"]));
  });

  it('accepts direct part metadata in ref bodies', () => {
    const errors = resolveErrors(`
ref marker {
  part.material = 'PLA';
  sketch s = rect(1, 1);
  obj base = extrude(s, 1);
}
`);
    expect(errors).toHaveLength(0);
  });

  it('rejects part metadata outside direct part or ref bodies', () => {
    const errors = resolveErrors(`
fn make() {
  part.color = #88ccff;
  return {}
}
`);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('part.color is only valid'),
      ]),
    );
  });

  it('rejects object metadata for unknown objects and non-hex color strings', () => {
    const errors = resolveErrors(`
part p {
  sketch s = rect(1, 1);
  missing.material = 'PLA';
  obj base = extrude(s, 1);
  base.color = #123;
}
`);
    expect(errors).toEqual(
      expect.arrayContaining([
        "Undefined object 'missing' in missing.material",
        'color metadata expects a #rrggbb hex color string',
      ]),
    );
  });
});
