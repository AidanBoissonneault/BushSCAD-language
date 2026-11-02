/**
 * @author Aidan Boissonneault
 * @file radial-stations.ts
 * @purpose Provides radial stations behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRRadialCurve, IRRadialDirection } from '@bushscad/ir';
import { autoRadialStationCount, remapRadialCurve } from './radial-curve.js';

/**
 * Radial station, including rot deg, axial mm, and hard break.
 */
type RadialStation = {
  rotDeg: number;
  axialMm: number;
  hardBreak?: boolean;
};

const MIN_STEP_TRANSITION_DEG = 2;
const STEP_TRANSITION_FRACTION = 0.08;
const STEP_PLATEAU_SLOPE = 0.12;
const PRE_CAP_FRACTION = 0.985;

/**
 * Generates distinct section poses for radial extrudes and cuts.
 * Rotation must advance with raw sweep progress while the selected curve remaps
 * axial travel. If both axes use the eased value, smooth curve types produce
 * the same geometric path and only change section density.
 */
export function buildRadialStations(options: {
  angleDeg: number;
  lengthMm: number;
  curve: IRRadialCurve;
  direction: IRRadialDirection;
  startDeg: number;
  sections: number | null;
}): RadialStation[] {
  const n =
    options.sections ??
    autoRadialStationCount(options.curve, Math.abs(options.angleDeg));
  const sign = options.direction === 'ccw' ? 1 : -1;
  const uValues = stationParameters(n, options.curve, options.angleDeg);
  const stations: RadialStation[] = [];

  for (const u of uValues) {
    const station = {
      rotDeg: options.startDeg + sign * u * options.angleDeg,
      axialMm:
        geometrySafeCurveValue(u, options.curve, options.angleDeg) *
        options.lengthMm,
      hardBreak: isHardBreakParameter(u, options.curve, options.angleDeg),
    };
    const last = stations[stations.length - 1];
    if (!last || stationsDiffer(last, station)) {
      stations.push(station);
    }
  }

  return stations;
}

/**
 * Creates the sweep parameters passed to OCCT section lofting.
 * Step curves need explicit transition boundary samples. Eased and bezier
 * curves need a near-end pre-cap sample so the final cap is not the first place
 * where the curve's endpoint behavior is represented.
 */
function stationParameters(
  sections: number,
  curve: IRRadialCurve,
  angleDeg: number,
): number[] {
  const n = Math.max(1, sections);
  const values: number[] = [];
  for (let i = 0; i <= n; i++) values.push(i / n);

  if (curve.kind === 'step-start') {
    values.push(stepTransitionU(angleDeg));
  } else if (curve.kind === 'step-end') {
    values.push(1 - stepTransitionU(angleDeg));
  } else if (curve.kind !== 'natural' && curve.kind !== 'linear') {
    values.push(PRE_CAP_FRACTION);
  }

  return [...new Set(values)]
    .filter((u) => u >= 0 && u <= 1)
    .sort((a, b) => a - b);
}

/**
 * Handles geometry safe curve value in the operations flow.
 */
function geometrySafeCurveValue(
  u: number,
  curve: IRRadialCurve,
  angleDeg: number,
): number {
  if (curve.kind === 'step-start') {
    const transition = stepTransitionU(angleDeg);
    if (u < transition) return (1 - STEP_PLATEAU_SLOPE) * (u / transition);
    return (
      1 -
      STEP_PLATEAU_SLOPE +
      STEP_PLATEAU_SLOPE * ((u - transition) / (1 - transition))
    );
  }
  if (curve.kind === 'step-end') {
    const transition = stepTransitionU(angleDeg);
    const breakU = 1 - transition;
    if (u <= breakU) return STEP_PLATEAU_SLOPE * (u / breakU);
    return (
      STEP_PLATEAU_SLOPE +
      (1 - STEP_PLATEAU_SLOPE) * ((u - breakU) / transition)
    );
  }
  return remapRadialCurve(u, curve);
}

/**
 * Handles step transition u in the operations flow.
 */
function stepTransitionU(angleDeg: number): number {
  const absAngle = Math.max(Math.abs(angleDeg), 1);
  return Math.min(
    0.25,
    Math.max(STEP_TRANSITION_FRACTION, MIN_STEP_TRANSITION_DEG / absAngle),
  );
}

/**
 * Returns whether the input meets the `hard break parameter` condition.
 */
function isHardBreakParameter(
  u: number,
  curve: IRRadialCurve,
  angleDeg: number,
): boolean {
  if (curve.kind === 'step-start') {
    return Math.abs(u - stepTransitionU(angleDeg)) < 1e-9;
  }
  if (curve.kind === 'step-end') {
    return Math.abs(u - (1 - stepTransitionU(angleDeg))) < 1e-9;
  }
  return false;
}

/**
 * Handles stations differ in the operations flow.
 */
function stationsDiffer(a: RadialStation, b: RadialStation): boolean {
  return (
    Math.abs(a.rotDeg - b.rotDeg) > 1e-9 ||
    Math.abs(a.axialMm - b.axialMm) > 1e-9
  );
}
