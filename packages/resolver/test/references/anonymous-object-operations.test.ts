import { describe, expect, it } from 'vitest';
import { resolveErrors, resolveOk } from '../core/test-support.js';

describe('anonymous object operation resolution', () => {
  it('resolves inline operations in modifiers and placements', () => {
    resolveOk(`
part pin { cube(1); }
part assembly {
  cube(4);
  fillet(@cube(10).top, 2);
  place(pin, @cube(8).top);
}
`);
  });

  it('keeps inline profile names separate from named object profile maps', () => {
    resolveOk(`
part assembly {
  sketch operation = path(
    a = line((0,0), (20,0)),
    lip = arc((20,0), (20,8), 8, cw),
    back = line((20,8), (0,8)),
    close = line((20,8), (0,0))
  );
  obj operation = revolve(operation, 360deg around y);
  fillet(@revolve(operation, 360deg around y).lip.edges, 0.5);
  fillet(@operation.lip.edges, 0.5);
}
`);
  });

  it('resolves operation inputs and keeps anonymous roots unbound', () => {
    expect(
      resolveErrors(`
part assembly {
  fillet(@extrude(missing_profile, 2).top, 1);
}
`),
    ).toContain("Undefined sketch 'missing_profile' in extrude");
    expect(
      resolveErrors(`
part assembly {
  cube(4);
  fillet(@operation.top, 1);
}
`),
    ).toContain("Undefined reference 'operation'");
  });

  it('reports an invalid named face without exposing its internal selector key', () => {
    expect(
      resolveErrors(`
part assembly {
  fillet(@cube(10).missing.edges, 1);
}
`),
    ).toContain("Unknown named face 'missing' on inline object operation");
  });
});
