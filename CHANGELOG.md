# Changelog

Notable changes to the BushSCAD language and its public packages are recorded
here. The canonical language reference remains the detailed compatibility
source.

## 0.5.0 — 2026-11-09

### Added

- Allow solid-producing operations to emit geometry without an `obj` binding,
  such as `cube(10);`.
- Allow an inline solid-producing operation to serve as an `@` selector root,
  such as `fillet(@cube(10).top, 2);` or
  `place(pin, @cube(10).top);`.
- Repeat `place(...)` for every concrete target from wildcard and other
  repeatable placement selectors. For example,
  `place(bracket(), @body.*.center);` places one instance at each face center.
- Resolve inline-operation selectors through parsing, resolution, evaluation,
  geometry queries, and language help while keeping their temporary object
  names private.

### Documentation

- Publish the canonical language reference and generated documentation at
  compatibility version 0.5.0.
