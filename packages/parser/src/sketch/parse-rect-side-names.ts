/**
 * @author Aidan Boissonneault
 * @file parse-rect-side-names.ts
 * @purpose Parses rect side names for the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type { Expr, RectSide, RectSideNames } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

const RECT_SIDES = ['bottom', 'right', 'top', 'left'] as const;

/**
 * Optional fields from Record<RectSide, Expr> used for rect side args.
 */
type RectSideArgs = Partial<Record<RectSide, Expr>>;

/**
 * Converts rectangle side arguments from parser expressions into name metadata.
 * Side aliases look like identifiers in source but name generated geometry;
 * storing them as strings prevents the resolver from treating them as variables.
 */
export function parseRectSideNames(
  p: Parser,
  args: RectSideArgs,
): RectSideNames | undefined {
  const sideNames: RectSideNames = {};
  for (const side of RECT_SIDES) {
    const value = args[side];
    if (!value) continue;
    if (value.kind !== 'identifier') {
      p.addError(
        `rect() argument '${side}' must be a bare identifier`,
        value.span,
      );
      continue;
    }
    sideNames[side] = value.name;
  }
  validateEffectiveSideNames(p, sideNames, args);
  return Object.keys(sideNames).length > 0 ? sideNames : undefined;
}

/** Ensures aliases do not collide with another alias or an unchanged side. */
function validateEffectiveSideNames(
  p: Parser,
  sideNames: RectSideNames,
  args: RectSideArgs,
): void {
  const owners = new Map<string, RectSide>();
  for (const side of RECT_SIDES) {
    const effectiveName = sideNames[side] ?? side;
    const previous = owners.get(effectiveName);
    if (previous) {
      p.addError(
        `rect() side names must be unique; '${effectiveName}' names both '${previous}' and '${side}'`,
        args[side]?.span ?? args[previous]?.span ?? p.peek().span,
      );
    } else {
      owners.set(effectiveName, side);
    }
  }
}
