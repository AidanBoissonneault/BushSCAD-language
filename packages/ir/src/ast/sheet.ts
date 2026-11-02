/**
 * @author Aidan Boissonneault
 * @file sheet.ts
 * @purpose Provides sheet behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from './sourceSpan.js';
import type { Expr } from './expressions.js';
import type { SketchDecl, VarDecl } from './declarations.js';

/**
 * Sheet-metal foundation AST (M33).
 *
 * A `sheet` block declares a flat base panel plus straight flanges with real
 * bends. It lowers to a thin extrude (the base panel) plus flange ops.
 */
export type SheetDecl = {
  kind: 'sheet';
  name: string;
  nameSpan?: ASTSourceSpan;
  thickness: Expr;
  material: Expr | null;
  bendRadius: Expr | null;
  kFactor: Expr | null;
  body: SheetStatement[];
  span: ASTSourceSpan;
};

/**
 * Sheet statement accepts SketchDecl, VarDecl, SheetObjDecl, FlangeStmt, and
 * FlatPatternExportStmt.
 */
export type SheetStatement =
  | SketchDecl
  | VarDecl
  | SheetObjDecl
  | FlangeStmt
  | FlatPatternExportStmt;

/** `obj <name> = sheet_base(<sketch>)` — the flat base panel of a sheet block. */
export type SheetObjDecl = {
  kind: 'sheetObj';
  name: string;
  nameSpan?: ASTSourceSpan;
  sketch: string;
  span: ASTSourceSpan;
};

/**
 * Accepted values for flange direction are 'up' and 'down'.
 */
export type FlangeDirection = 'up' | 'down';

/** `flange <obj>.edge(<name>) length: .. angle: .. radius: .. direction: ..` */
export type FlangeStmt = {
  kind: 'flange';
  edgeObj: string;
  edgeName: string;
  length: Expr;
  angle: Expr;
  radius: Expr | null;
  direction: FlangeDirection;
  span: ASTSourceSpan;
};

/** `export flat_pattern dxf '<path>'` inside a sheet block. */
export type FlatPatternExportStmt = {
  kind: 'flatPatternExport';
  format: 'dxf';
  path: string;
  span: ASTSourceSpan;
};
