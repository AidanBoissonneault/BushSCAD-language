/**
 * @author Aidan Boissonneault
 * @file radial-curve-help.ts
 * @purpose Provides radial curve help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

/** Documents one radial curve value with an executable example of its owning call. */
function curveEntry(
  name: string,
  summary: string,
  behavior: string,
): LanguageHelpEntry {
  return {
    summary,
    signatures: [
      `radial_extrude(profile, axis: z, angle: a, length: h, curve: ${name})`,
    ],
    behavior: [behavior],
    examples: [
      `sketch section = rect(3, 2);\nobj rib = radial_extrude(section, axis: z, angle: 90, length: 20, radius: 12, curve: ${name});`,
    ],
    related: ['curve', 'radial_extrude', 'radial_cut'],
  };
}

export const radialCurveHelp: Record<string, LanguageHelpEntry> = {
  natural: curveEntry(
    'natural',
    'Advances radial axial travel uniformly with angular progress; this is the default curve.',
    'natural and linear currently use the same progress function.',
  ),
  ease: curveEntry(
    'ease',
    'Uses a CSS-style ease curve to vary axial progress along a radial sweep.',
    'Equivalent to cubic-bezier(0.25, 0.1, 0.25, 1).',
  ),
  'ease-in': curveEntry(
    'ease-in',
    'Starts axial travel slowly and accelerates it during a radial sweep.',
    'Equivalent to cubic-bezier(0.42, 0, 1, 1).',
  ),
  'ease-out': curveEntry(
    'ease-out',
    'Starts axial travel quickly and slows it near the radial sweep end.',
    'Equivalent to cubic-bezier(0, 0, 0.58, 1).',
  ),
  'ease-in-out': curveEntry(
    'ease-in-out',
    'Slows axial travel at both ends of a radial sweep while progressing faster in the middle.',
    'Equivalent to cubic-bezier(0.42, 0, 0.58, 1).',
  ),
  'step-start': curveEntry(
    'step-start',
    'Concentrates radial axial travel near the beginning of the sweep.',
    'Geometry uses a finite transition and a shallow plateau slope to avoid a degenerate discontinuous solid.',
  ),
  'step-end': curveEntry(
    'step-end',
    'Concentrates radial axial travel near the end of the sweep.',
    'Geometry uses a finite transition and a shallow plateau slope to avoid a degenerate discontinuous solid.',
  ),
  'cubic-bezier': {
    ...curveEntry(
      'cubic-bezier(0.42, 0, 0.58, 1)',
      'Defines a custom cubic Bézier remapping of axial progress during radial rotation.',
      'Endpoints are fixed at (0,0) and (1,1); x1 and x2 must lie in [0,1].',
    ),
    parameters: [
      {
        name: 'x1, y1, x2, y2',
        description:
          'Dimensionless control points. X controls must be in [0,1]; Y controls can produce overshoot.',
      },
    ],
  },
};
