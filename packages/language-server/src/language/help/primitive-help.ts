/**
 * @author Aidan Boissonneault
 * @file primitive-help.ts
 * @purpose Provides primitive help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageHelpEntry } from './types.js';

import { bottomPlacement, primitiveUnits } from './primitive-conventions.js';
const boxParameters = [
  {
    name: 'size',
    description:
      'Positive scalar for equal sides, or [X width, Y depth, Z height].',
  },
  {
    name: 'width, depth, height',
    description:
      'Named dimension alternatives when size is omitted; each defaults to 1.',
  },
];
const sphereParameters = [
  {
    name: 'r / radius',
    description: 'Positive radius; defaults to 1. Use the named form.',
  },
  {
    name: 'd / diameter',
    description:
      'Positive diameter, converted to radius; takes precedence over r/radius.',
  },
  {
    name: 'segments',
    description:
      'Meridian profile subdivisions, rounded to an integer with a minimum of 3; default 48.',
  },
];

export const primitiveHelp: Record<string, LanguageHelpEntry> = {
  cube: {
    summary:
      'Creates a direct 3D block without a sketch; a vector size also makes a rectangular cuboid.',
    signatures: [
      'obj name = cube(size, @placement);',
      'obj name = cube(width: x, depth: y, height: z);',
    ],
    parameters: boxParameters,
    behavior: [bottomPlacement, primitiveUnits],
    examples: ['obj block = cube([40, 20, 8]);', 'obj block = cube(12);'],
    related: ['cuboid', 'rect', 'extrude', 'roundedCuboid'],
  },
  cuboid: {
    summary:
      'Creates a rectangular solid with explicit X, Y, and Z dimensions and optional trailing placement.',
    signatures: [
      'obj name = cuboid([width, depth, height], @placement);',
      'obj name = cuboid(width: x, depth: y, height: z);',
    ],
    parameters: boxParameters,
    behavior: [bottomPlacement, primitiveUnits],
    examples: ['obj plate = cuboid(width: 60, depth: 40, height: 4);'],
    related: ['cube', 'roundedCuboid', 'extrude'],
  },
  sphere: {
    summary:
      'Creates a sphere-shaped solid centered on its authored origin using a revolved sampled meridian.',
    signatures: [
      'obj name = sphere(r: radius, segments: count, @placement);',
      'obj name = sphere(d: diameter);',
    ],
    parameters: sphereParameters,
    behavior: [
      'Use named r/d arguments: a single positional value does not set the radius in the current evaluator.',
      'The profile is sampled; increasing segments refines its meridian.',
      primitiveUnits,
    ],
    examples: ['obj ball = sphere(r: 10, segments: 64);'],
    related: ['ellipsoid', 'geodesicSphere', 'revolve'],
  },
  geodesicSphere: {
    summary:
      'Creates a sphere-shaped solid through the sphere primitive compatibility path.',
    signatures: ['obj name = geodesicSphere(r: radius, segments: count);'],
    parameters: sphereParameters,
    behavior: [
      'Current geometry uses the same revolved meridian as sphere; it does not construct an icosahedral geodesic mesh.',
      primitiveUnits,
    ],
    examples: ['obj ball = geodesicSphere(d: 20, segments: 48);'],
    related: ['sphere', 'polyhedron'],
  },
  ellipsoid: {
    summary:
      'Declares positive X/Y/Z radii for an ellipsoid; the current geometry supports rotationally symmetric spheroids.',
    signatures: [
      'obj name = ellipsoid(radius: [rx, ry, rz], segments: count);',
    ],
    parameters: [
      {
        name: 'radius',
        description:
          'Three positive half-extents, not full diameters; default [1, 1, 1].',
      },
      {
        name: 'segments',
        description: 'Meridian subdivision count; default 48.',
      },
    ],
    behavior: [
      'Current bridge revolves the X/Z profile and does not apply a distinct Y radius. Keep rx and ry equal for geometry that matches the declaration.',
      'Placement uses the center at the authored local origin.',
      primitiveUnits,
    ],
    examples: ['obj dome = ellipsoid(radius: [10, 10, 18], segments: 64);'],
    related: ['sphere', 'revolve'],
  },
  roundedCuboid: {
    summary:
      'Extrudes a rounded rectangular footprint into a block with rounded vertical corners.',
    signatures: [
      'obj name = roundedCuboid(size: [width, depth, height], r: radius, segments: count);',
    ],
    parameters: [
      ...boxParameters,
      {
        name: 'r / radius',
        description:
          'Footprint corner radius; defaults to 0 and clamps to half the smaller footprint dimension.',
      },
      {
        name: 'segments',
        description:
          'Controls polygon samples around footprint corners; default 48.',
      },
    ],
    behavior: [
      bottomPlacement,
      'Top and bottom rims are not filleted. Use fillet for selected 3D edges.',
      primitiveUnits,
    ],
    examples: ['obj case_body = roundedCuboid(size: [60, 40, 12], r: 4);'],
    related: ['roundrect', 'extrude', 'fillet'],
  },
  roundedCylinder: {
    summary:
      'Declares a cylinder with a rounding-radius parameter; current geometry remains a straight cylinder.',
    signatures: [
      'obj name = roundedCylinder(height: h, r: radius, roundingRadius: amount);',
    ],
    parameters: [
      {
        name: 'height / r',
        description:
          'Positive axial height and circular radius, as for cylinder.',
      },
      {
        name: 'roundingRadius',
        description:
          'Non-negative rounding amount, default 0; currently retained in IR but unused by the geometry builder.',
      },
    ],
    behavior: [
      bottomPlacement,
      'For actual rounded rims, create a cylinder and apply fillet to its top/bottom edges.',
      primitiveUnits,
    ],
    examples: [
      'obj pin = roundedCylinder(height: 20, r: 6, roundingRadius: 0);',
    ],
    related: ['cylinder', 'fillet'],
  },
  torus: {
    summary:
      'Creates a ring by revolving a circular tube profile around local Z.',
    signatures: [
      'obj name = torus(majorRadius: ringRadius, minorRadius: tubeRadius, minorSegments: count);',
    ],
    parameters: [
      {
        name: 'majorRadius',
        description:
          'Positive distance from the rotation axis to the tube center; default 10.',
      },
      {
        name: 'minorRadius',
        description:
          'Positive tube radius; default 2. Outer diameter is 2 * (majorRadius + minorRadius).',
      },
      {
        name: 'minorSegments',
        description: 'Tube profile subdivisions; minimum 8, default 16.',
      },
    ],
    behavior: [
      'Origin is the ring center. Choose majorRadius greater than minorRadius for a non-self-intersecting ring.',
      'The current evaluator does not consume majorSegments; minorSegments controls the sampled tube profile.',
      primitiveUnits,
    ],
    examples: [
      'obj ring = torus(majorRadius: 20, minorRadius: 3, minorSegments: 32);',
    ],
    related: ['revolve', 'circle'],
  },
  polyhedron: {
    summary:
      'Builds polygon faces from authored 3D vertices and zero-based vertex-index loops.',
    signatures: [
      'obj name = polyhedron(points: [[x, y, z], ...], faces: [[i, j, k], ...]);',
    ],
    parameters: [
      { name: 'points', description: 'List of [X, Y, Z] vertex coordinates.' },
      {
        name: 'faces',
        description:
          'Each face is an ordered loop of at least three vertex indices; triangles is an alias.',
      },
    ],
    behavior: [
      'Use planar non-degenerate loops with consistent outward winding and valid indices.',
      'Current bridge builds a compound of separate faces; it does not sew them into a closed solid.',
      'Placement preserves the authored local coordinate origin.',
      primitiveUnits,
    ],
    examples: [
      'obj tetra = polyhedron(points: [[0,0,0], [10,0,0], [0,10,0], [0,0,10]], faces: [[0,2,1], [0,1,3], [0,3,2], [1,2,3]]);',
    ],
    related: ['cube', 'loft'],
  },
};
