/**
 * @file object-name-collisions.test.ts
 * @purpose Covers same-scope collisions between object-producing declarations.
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors, resolveOk } from '../core/test-support.js';

describe('object name collisions', () => {
  it('allows a sketch to become an object under the same name', () => {
    resolveOk(`
part housing {
  sketch body = rect(20, 10);
  obj body = extrude(body, 5);
  fillet(@body.top.edges, 0.5);
}
`);
  });

  it('rejects duplicate inline object declarations in one scope', () => {
    const errors = resolveErrors(`
obj body = cube([20, 10, 5]);
obj body = sphere(4);
`);

    expect(errors).toContain("Duplicate object name 'body'");
  });

  it('rejects duplicate function-call object declarations', () => {
    const errors = resolveErrors(`
fn make_pin() {
  sketch profile = circle(2);
  obj pin = extrude(profile, 5);
}
obj pin = make_pin();
obj pin = make_pin();
`);

    expect(errors).toContain("Duplicate object name 'pin'");
  });

  it('rejects duplicate object names inside a component body', () => {
    const errors = resolveErrors(`
part assembly {
  obj body = cube([20, 10, 5]);
  obj body = sphere(4);
}
`);

    expect(errors).toContain("Duplicate object name 'body'");
  });

  it('checks function-call object declarations inside function bodies', () => {
    const errors = resolveErrors(`
fn make_piece() {
  obj body = cube([20, 10, 5]);
}
fn make_assembly() {
  obj body = cube([20, 10, 5]);
  obj body = make_piece();
}
`);

    expect(errors).toContain("Duplicate object name 'body'");
  });

  it('keeps same names independent across conditional branches', () => {
    resolveOk(`
var enabled = true;
part assembly {
  if enabled {
    obj body = cube([20, 10, 5]);
  } else {
    obj body = sphere(4);
  }
}
`);
  });

  it('rejects duplicate names between object declarations and place aliases', () => {
    const errors = resolveErrors(`
ref peg { obj shaft = cylinder(5, d: 2); }
obj peg_instance = cube([2, 2, 2]);
place(peg) as peg_instance;
`);

    expect(errors).toContain("Duplicate object name 'peg_instance'");
  });

  it('allows editing the existing object with a modifier', () => {
    resolveOk(`
obj body = cube([20, 10, 5]);
fillet(@body.top.edges, 0.5);
`);
  });
});
