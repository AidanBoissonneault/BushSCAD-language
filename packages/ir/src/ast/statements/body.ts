/**
 * AST contracts for statement bodies and their supported statement forms.
 */
import type { ASTSourceSpan } from '../sourceSpan.js';
import type { SurfaceDecl } from '../surface.js';
import type { DetailStatement } from '../details.js';
import type {
  AnchorDecl,
  MetadataAssignment,
  MirrorStmt,
  PatternLinearStmt,
  PatternRadialStmt,
  PlaceStatement,
  PlaneDecl,
  RotateStatement,
  TransformStmt,
} from '../placement.js';
import type {
  AssertStatement,
  DefeatureDecl,
  EnvDecl,
  FitDecl,
  HealDecl,
  JointDecl,
  ObjDecl,
  ObjFromCallDecl,
  PathDecl,
  RefObjDecl,
  RefPartDecl,
  SketchDecl,
  UseDecl,
  VarDecl,
} from '../declarations.js';
import type { CallStatement } from './call.js';
import type { FnDecl } from './fn.js';
import type { ForStatement } from './for.js';
import type { IfStatement } from './if.js';
import type { ReturnStatement } from './return.js';

/** Statements and source range owned by a block body. */
export type ComponentBody = {
  statements: ComponentStatement[];
  span: ASTSourceSpan;
};

/** Statements allowed inside components, parts, functions, and return bodies. */
export type ComponentStatement =
  | VarDecl
  | EnvDecl
  | HealDecl
  | DefeatureDecl
  | UseDecl
  | SketchDecl
  | SurfaceDecl
  | PathDecl
  | ObjDecl
  | ObjFromCallDecl
  | RefPartDecl
  | RefObjDecl
  | FnDecl
  | CallStatement
  | ReturnStatement
  | ForStatement
  | IfStatement
  | PlaceStatement
  | RotateStatement
  | PatternLinearStmt
  | PatternRadialStmt
  | MirrorStmt
  | TransformStmt
  | DetailStatement
  | PlaneDecl
  | AnchorDecl
  | MetadataAssignment
  | AssertStatement
  | FitDecl
  | JointDecl;
