/**
 * @author Aidan Boissonneault
 * @file collect.ts
 * @purpose Collects the result for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type {
  ComponentBody,
  ComponentStatement,
  Program,
  TopLevelStatement,
} from '@bushscad/ir';
import type { State } from '../core/types.js';
import type { Scope } from '../core/scope.js';
import { sketchPrimitiveSegmentNames } from '../sketch/sketch-segment-names.js';

/**
 * Collects top-level symbols before the resolver validates references.
 * BushSCAD allows references to declarations that appear later in a file, so
 * name collection must run before reference validation.
 */
export function collectTopLevel(
  ast: Program,
  scope: Scope,
  state: State,
): void {
  for (const stmt of ast.statements) collectStmt(stmt, scope, state);
}

/** Adds the anchor names declared directly by an `obj` or `@` statement. */
function addLeafAnchors(
  stmt: TopLevelStatement | ComponentStatement,
  anchors: Set<string>,
): void {
  if (stmt.kind === 'obj') {
    for (const anchor of stmt.anchors) anchors.add(anchor.name);
  } else if (stmt.kind === 'anchor') {
    anchors.add(stmt.name);
  }
}

/**
 * Collects anchor names reachable from top-level and nested component bodies.
 */
export function collectGlobalAnchors(ast: Program, anchors: Set<string>): void {
  /**
   * Handles visit body in the declarations flow.
   */
  const visitBody = (body: ComponentBody): void => {
    for (const stmt of body.statements) {
      addLeafAnchors(stmt, anchors);
      if (stmt.kind === 'fn' || stmt.kind === 'return') {
        visitBody(stmt.body);
      } else if (stmt.kind === 'for') {
        visitBody(stmt.body);
      } else if (stmt.kind === 'if') {
        visitBody(stmt.then);
        if (stmt.else) visitBody(stmt.else);
      }
    }
  };

  for (const stmt of ast.statements) {
    addLeafAnchors(stmt, anchors);
    if (stmt.kind === 'part' || stmt.kind === 'fn') {
      visitBody(stmt.body);
    } else if (stmt.kind === 'export') {
      collectGlobalAnchors(
        {
          kind: 'program',
          baseUnit: null,
          workplane: null,
          statements: [stmt.statement],
          span: stmt.span,
        },
        anchors,
      );
    }
  }
}

/**
 * Adds a single top-level declaration to the current scope.
 */
function collectStmt(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  TOP_LEVEL_COLLECTORS[stmt.kind]?.(stmt, scope, state);
}

/**
 * Defines the `TopLevelCollector` callback contract used by the declarations layer.
 */
type TopLevelCollector = (
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
) => void;

const TOP_LEVEL_COLLECTORS: Partial<
  Record<TopLevelStatement['kind'], TopLevelCollector>
> = {
  var: (stmt, scope) =>
    scope.define(
      (stmt as Extract<TopLevelStatement, { kind: 'var' }>).name,
      'var',
    ),
  env: (stmt, scope) =>
    scope.define(
      (stmt as Extract<TopLevelStatement, { kind: 'env' }>).name,
      'env',
    ),
  fontImport: (stmt, scope) =>
    scope.define(
      (stmt as Extract<TopLevelStatement, { kind: 'fontImport' }>).name,
      'font',
    ),
  shapeImport: (stmt, scope) =>
    scope.define(
      (stmt as Extract<TopLevelStatement, { kind: 'shapeImport' }>).name,
      'shape',
    ),
  path: (stmt, scope) =>
    scope.define(
      (stmt as Extract<TopLevelStatement, { kind: 'path' }>).name,
      'path',
    ),
  sketch: collectSketch,
  surface: (stmt, scope) =>
    scope.define(
      (stmt as Extract<TopLevelStatement, { kind: 'surface' }>).name,
      'surface',
    ),
  obj: collectObj,
  objCall: (stmt, scope) =>
    scope.define(
      (stmt as Extract<TopLevelStatement, { kind: 'objCall' }>).name,
      'obj',
    ),
  anchor: collectAnchor,
  refPart: collectRefPart,
  refObj: (stmt, scope) =>
    scope.define(
      (stmt as Extract<TopLevelStatement, { kind: 'refObj' }>).name,
      'obj',
    ),
  place: collectPlace,
  fn: (stmt, scope) =>
    scope.define(
      (stmt as Extract<TopLevelStatement, { kind: 'fn' }>).name,
      'fn',
    ),
  part: collectPart,
  export: (stmt, scope, state) =>
    collectStmt(
      (stmt as Extract<TopLevelStatement, { kind: 'export' }>).statement,
      scope,
      state,
    ),
  fit: (stmt, scope) =>
    scope.define(
      (stmt as Extract<TopLevelStatement, { kind: 'fit' }>).fitName,
      'fit',
    ),
  sheet: (stmt, scope) =>
    scope.define(
      (stmt as Extract<TopLevelStatement, { kind: 'sheet' }>).name,
      'sheet',
    ),
};

/**
 * Collects sketch from the supplied values.
 */
function collectSketch(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const sketch = stmt as Extract<TopLevelStatement, { kind: 'sketch' }>;
  scope.define(sketch.name, 'sketch');
  collectSketchSegmentNames(sketch, state);
}

/**
 * Collects sketch segment names from the supplied values.
 */
function collectSketchSegmentNames(
  sketch: Extract<TopLevelStatement, { kind: 'sketch' }>,
  state: State,
): void {
  const names = sketchPrimitiveSegmentNames(sketch.primitive);
  if (names.size > 0) state.profileSketchSegments.set(sketch.name, names);
}

/**
 * Collects obj from the supplied values.
 */
function collectObj(stmt: TopLevelStatement, scope: Scope, state: State): void {
  const obj = stmt as Extract<TopLevelStatement, { kind: 'obj' }>;
  scope.define(obj.name, 'obj');
  for (const anchor of obj.anchors) {
    scope.define(anchor.name, 'anchor');
    state.globalAnchors.add(anchor.name);
  }
}

/**
 * Collects anchor from the supplied values.
 */
function collectAnchor(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const anchor = stmt as Extract<TopLevelStatement, { kind: 'anchor' }>;
  scope.define(anchor.name, 'anchor');
  state.globalAnchors.add(anchor.name);
}

/**
 * Collects ref part from the supplied values.
 */
function collectRefPart(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const refPart = stmt as Extract<TopLevelStatement, { kind: 'refPart' }>;
  scope.define(refPart.name, 'component');
  state.globalParts.add(refPart.name);
}

/**
 * Collects place from the supplied values.
 */
function collectPlace(stmt: TopLevelStatement, scope: Scope): void {
  const place = stmt as Extract<TopLevelStatement, { kind: 'place' }>;
  if (place.as) scope.define(place.as, 'obj');
}

/**
 * Collects part from the supplied values.
 */
function collectPart(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const part = stmt as Extract<TopLevelStatement, { kind: 'part' }>;
  scope.define(part.name, 'part');
  state.globalParts.add(part.name);
}
