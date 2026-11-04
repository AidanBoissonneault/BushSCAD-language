import type { Expr, FaceRef } from '@bushscad/ir';

/** Mutable slots collected while parsing the shared pattern() call syntax. */
export type PatternCallArgs = {
  target: string | null;
  mode: 'linear' | 'radial';
  modeProvided: boolean;
  supplied: Set<string>;
  countX: Expr | null;
  countY: Expr | null;
  spacingX: Expr | null;
  spacingY: Expr | null;
  count: Expr | null;
  around: FaceRef | null;
};
