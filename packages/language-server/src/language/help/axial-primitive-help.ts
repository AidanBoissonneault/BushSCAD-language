/**
 * @author Aidan Boissonneault
 * @file axial-primitive-help.ts
 * @purpose Provides axial primitive help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';
import { bottomPlacement, primitiveUnits } from './primitive-conventions.js';

export const axialPrimitiveHelp: Record<string, LanguageHelpEntry> = {
  cylinder: {
    summary:
      'Creates a circular cylinder, or a tapered cylinder when different end radii are provided.',
    signatures: [
      'obj name = cylinder(height, radius, @placement);',
      'obj name = cylinder(h: height, d: diameter);',
      'obj name = cylinder(height, r1: bottomRadius, r2: topRadius);',
    ],
    parameters: [
      {
        name: 'height / h',
        description:
          'Positive axial length; first positional argument, default 1.',
      },
      {
        name: 'r / radius / d / diameter',
        description:
          'Circular section size; radius is the second positional argument, default 1.',
      },
      {
        name: 'r1, r2 / d1, d2',
        description:
          'Optional bottom and top radius/diameter overrides for taper.',
      },
    ],
    behavior: [bottomPlacement, primitiveUnits],
    examples: [
      'obj base = cube([30, 30, 4]);\nobj pin = cylinder(12, d: 6, @base.top.center);',
    ],
    related: ['cone', 'frustum', 'cylinderElliptic'],
  },
  cylinderElliptic: {
    summary:
      'Creates an elliptical cylinder or elliptical taper from positive pairs of end radii.',
    signatures: [
      'obj name = cylinderElliptic(height: h, radius: [rx, ry]);',
      'obj name = cylinderElliptic(height: h, startRadius: [rx, ry], endRadius: [rx, ry]);',
    ],
    parameters: [
      { name: 'height', description: 'Positive axial length; default 1.' },
      {
        name: 'radius',
        description: 'Default X/Y half-extents for both ends; default [1, 1].',
      },
      {
        name: 'startRadius / endRadius',
        description:
          'Override the bottom/top pair; every component must be positive.',
      },
      {
        name: 'segments',
        description:
          'Polygon subdivision count; geometry uses at least 12 sections.',
      },
    ],
    behavior: [
      bottomPlacement,
      'Current geometry is a compound of polygon faces, not a sewn analytic solid; boolean and solid-export use has this limitation.',
      primitiveUnits,
    ],
    examples: [
      'obj oval = cylinderElliptic(height: 20, radius: [10, 6], segments: 48);',
    ],
    related: ['ellipse', 'extrude', 'loft', 'cylinder'],
  },
  cone: {
    summary:
      'Creates a circular cone whose positive base radius tapers to a zero-radius tip.',
    signatures: [
      'obj name = cone(height, radius, @placement);',
      'obj name = cone(height: h, d: diameter);',
    ],
    parameters: [
      {
        name: 'height / h',
        description: 'Positive height along local Z; default 1.',
      },
      {
        name: 'r / radius / d / diameter',
        description:
          'Base section size; radius is the second positional argument, default 1.',
      },
    ],
    behavior: [bottomPlacement, primitiveUnits],
    examples: ['obj tip = cone(height: 20, r: 8);'],
    related: ['frustum', 'cylinder'],
  },
  frustum: {
    summary:
      'Creates a truncated circular cone with independently sized bottom and top ends.',
    signatures: [
      'obj name = frustum(height, bottomRadius, topRadius);',
      'obj name = frustum(height: h, r1: bottom, r2: top);',
    ],
    parameters: [
      { name: 'height', description: 'Positive axial length; default 1.' },
      {
        name: 'r1 / radiusBottom',
        description:
          'Positive bottom radius; default 1. d1/diameterBottom supplies a diameter.',
      },
      {
        name: 'r2 / radiusTop',
        description:
          'Non-negative top radius; default 0.5. Zero produces a cone. d2/diameterTop supplies a diameter.',
      },
    ],
    behavior: [bottomPlacement, primitiveUnits],
    examples: ['obj reducer = frustum(height: 25, r1: 12, r2: 6);'],
    related: ['cone', 'cylinder', 'loft'],
  },
};
