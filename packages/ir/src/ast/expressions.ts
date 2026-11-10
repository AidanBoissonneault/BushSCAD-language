/**
 * @author Aidan Boissonneault
 * @file expressions.ts
 * @purpose Provides expressions behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from './sourceSpan.js';
import type { ObjectOperation } from './operations/object-operation.js';

/** Expression nodes accepted by the resolver and evaluator. */
export type Expr =
  | NumberLiteral
  | StringLiteral
  | TemplateStringExpr
  | BoolLiteral
  | ListLiteral
  | TupleLiteral
  | Identifier
  | BinaryExpr
  | UnaryExpr
  | TernaryExpr
  | ThisExpr
  | FaceRef
  | FaceRefList
  | PosRef
  | UnitExpr
  | FnCallExpr
  | AutoExpr;

/** Literal expressions that can be used where a direct fallback value is needed. */
export type Literal = NumberLiteral | StringLiteral | BoolLiteral | ListLiteral;

/**
 * Number literal, including operation kind, display value, and span.
 */
export type NumberLiteral = {
  kind: 'number';
  value: number;
  span: ASTSourceSpan;
};

/**
 * String literal, including operation kind, display value, and span.
 */
export type StringLiteral = {
  kind: 'string';
  value: string;
  span: ASTSourceSpan;
};

/** A TypeScript-style template string with ordered text and substitutions. */
export type TemplateStringExpr = {
  kind: 'template';
  parts: TemplateStringPart[];
  span: ASTSourceSpan;
};

/**
 * Template string part is tagged by kind: 'text' carries display value and 'expression' carries
 * expression.
 */
export type TemplateStringPart =
  | { kind: 'text'; value: string; span: ASTSourceSpan }
  | { kind: 'expression'; expression: Expr; span: ASTSourceSpan };

/**
 * Bool literal, including operation kind, display value, and span.
 */
export type BoolLiteral = {
  kind: 'bool';
  value: boolean;
  span: ASTSourceSpan;
};

/**
 * List literal, including operation kind, items, and span.
 */
export type ListLiteral = {
  kind: 'list';
  items: Expr[];
  span: ASTSourceSpan;
};

/**
 * Tuple literal, including operation kind, x, y, and span.
 */
export type TupleLiteral = {
  kind: 'tuple';
  x: Expr;
  y: Expr;
  span: ASTSourceSpan;
};

/**
 * Identifier, including operation kind, name, and span.
 */
export type Identifier = {
  kind: 'identifier';
  name: string;
  span: ASTSourceSpan;
};

/**
 * Binary expr, including operation kind, op, left, right, and span.
 */
export type BinaryExpr = {
  kind: 'binary';
  op:
    | '+'
    | '-'
    | '*'
    | '/'
    | '%'
    | '=='
    | '!='
    | '<'
    | '>'
    | '<='
    | '>='
    | '&&'
    | '||';
  left: Expr;
  right: Expr;
  span: ASTSourceSpan;
};

/**
 * Unary expr, including operation kind, op, operand, and span.
 */
export type UnaryExpr = {
  kind: 'unary';
  op: '-' | '!';
  operand: Expr;
  span: ASTSourceSpan;
};

/**
 * Ternary expr, including operation kind, condition, then, else, and span.
 */
export type TernaryExpr = {
  kind: 'ternary';
  condition: Expr;
  then: Expr;
  else: Expr;
  span: ASTSourceSpan;
};

/**
 * This expr, including operation kind, property, and span.
 */
export type ThisExpr = {
  kind: 'this';
  property: 'width' | 'height' | 'center' | 'area' | 'normal';
  span: ASTSourceSpan;
};

/**
 * Reference to a face or nested face feature such as base.top.center.
 * Geometry features are resolved later after object construction, so the parser
 * stores the textual chain rather than binding it immediately.
 */
export type FaceRef = {
  kind: 'faceRef';
  chain: FaceRefSegment[];
  /** Inline operation that supplies the selector's temporary root object. */
  inlineOperation?: ObjectOperation;
  surfaceAngle?: Expr;
  wrap?: boolean;
  span: ASTSourceSpan;
};

/**
 * Face ref segment source, including span and expanded from.
 */
type FaceRefSegmentSource = {
  span: ASTSourceSpan;
  /** Whole group/wildcard/variable span that expanded into this segment. */
  expandedFrom?: ASTSourceSpan;
};

/**
 * Face ref segment accepts (FaceRefSegmentSource & { kind: 'name'; value: str,
 * (FaceRefSegmentSource & { kind: 'edgeIntersection', { kind: 'call'; name: string; arg: string;
 * namedAr, (FaceRefSegmentSource & { kind: 'group'; options: , (FaceRefSegmentSource & { kind:
 * 'wildcard' }), and (FaceRefSegmentSource & { kind: 'index'; value: nu.
 */
export type FaceRefSegment =
  | (FaceRefSegmentSource & { kind: 'name'; value: string })
  | (FaceRefSegmentSource & {
      kind: 'edgeIntersection';
      edges: readonly [string, string];
      memberSpans: readonly [ASTSourceSpan, ASTSourceSpan];
      delimiterSpan: ASTSourceSpan;
      index?: number;
      indexSpan?: ASTSourceSpan;
    })
  | {
      kind: 'call';
      name: string;
      arg: string;
      namedArgs?: { name: string; value: string }[];
      span: ASTSourceSpan;
      expandedFrom?: ASTSourceSpan;
    }
  | (FaceRefSegmentSource & {
      kind: 'group';
      options: string[];
      memberSpans: ASTSourceSpan[];
      delimiterSpan: ASTSourceSpan;
    })
  | (FaceRefSegmentSource & { kind: 'wildcard' })
  | (FaceRefSegmentSource & { kind: 'index'; value: number });

/**
 * Explicit list of selectable face references with an optional shared suffix.
 * `[@a, @b].top` is not a normal value-list expression. It is a source-level
 * selector list that must expand into repeated existing geometry operations.
 */
export type FaceRefList = {
  kind: 'faceRefList';
  items: FaceRef[];
  suffix: FaceRefSegment[];
  span: ASTSourceSpan;
};

/**
 * Repeatable face ref accepts FaceRef and FaceRefList.
 */
export type RepeatableFaceRef = FaceRef | FaceRefList;

/** Position reference, either from a face anchor or an explicit coordinate. */
export type PosRef = {
  kind: 'pos';
  anchor: FaceRef | [Expr, Expr, Expr];
  x?: Expr;
  y?: Expr;
  radius?: Expr;
  angle?: Expr;
  offset?: Expr;
  span: ASTSourceSpan;
};

/**
 * Spatial ref accepts FaceRef and PosRef.
 */
export type SpatialRef = FaceRef | PosRef;

/**
 * Repeatable spatial ref accepts RepeatableFaceRef and PosRef.
 */
export type RepeatableSpatialRef = RepeatableFaceRef | PosRef;

/**
 * Unit expr, including operation kind, display value, unit, and span.
 */
export type UnitExpr = {
  kind: 'unit';
  value: Expr;
  unit: 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'deg';
  span: ASTSourceSpan;
};

/**
 * Fn call expr, including operation kind, name, args, named args, and span.
 */
export type FnCallExpr = {
  kind: 'call';
  name: string;
  args: Expr[];
  namedArgs: { name: string; value: Expr }[];
  span: ASTSourceSpan;
};

/**
 * The `auto` keyword — a placeholder value resolved from surrounding context.
 *
 * Inside a `within`-annotated for loop it resolves to the iteration's evenly
 * distributed position along the loop axis; in a parent-face context it
 * resolves to the remaining face dimension (analogous to `inset`).
 */
export type AutoExpr = {
  kind: 'auto';
  span: ASTSourceSpan;
};
