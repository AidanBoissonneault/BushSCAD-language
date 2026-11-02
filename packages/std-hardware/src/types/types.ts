/**
 * @author Aidan Boissonneault
 * @file types.ts
 * @purpose Defines the hardware hole and insert specifications used by standard hardware features.
 * @last-edited October 6, 2026
 */

/**
 * Accepted values for hardware spec kind are 'clearance', 'tap', 'counterbore', 'countersink',
 * 'heatset_insert', and 'pilot'.
 */

export type HardwareSpecKind =
  | 'clearance'
  | 'tap'
  | 'counterbore'
  | 'countersink'
  | 'heatset_insert'
  | 'pilot';

/**
 * Clearance hole spec, including operation kind and diameter.
 */
export type ClearanceHoleSpec = { kind: 'clearance'; diameter: number };
/**
 * Tap hole spec, including operation kind, diameter, and pitch.
 */
export type TapHoleSpec = { kind: 'tap'; diameter: number; pitch: number };
/**
 * Counterbore spec, including operation kind, clearance diameter, bore diameter, and bore depth.
 */
export type CounterboreSpec = {
  kind: 'counterbore';
  clearanceDiameter: number;
  boreDiameter: number;
  boreDepth: number;
};
/**
 * Countersink spec, including operation kind, clearance diameter, sink diameter, and angle.
 */
export type CountersinkSpec = {
  kind: 'countersink';
  clearanceDiameter: number;
  sinkDiameter: number;
  angle: number;
};
/**
 * Heatset insert spec, including operation kind, outer diameter, and default depth.
 */
export type HeatsetInsertSpec = {
  kind: 'heatset_insert';
  outerDiameter: number;
  defaultDepth: number;
};
/**
 * Pilot hole spec, including operation kind and diameter.
 */
export type PilotHoleSpec = { kind: 'pilot'; diameter: number };

/**
 * Hole spec accepts ClearanceHoleSpec, TapHoleSpec, CounterboreSpec, CountersinkSpec,
 * HeatsetInsertSpec, and PilotHoleSpec.
 */
export type HoleSpec =
  | ClearanceHoleSpec
  | TapHoleSpec
  | CounterboreSpec
  | CountersinkSpec
  | HeatsetInsertSpec
  | PilotHoleSpec;

/**
 * Entry in hardware size, including clearance, tap, counterbore, countersink, and
 * heatset_insert.
 */
export type HardwareSizeEntry = {
  clearance: ClearanceHoleSpec;
  tap: TapHoleSpec;
  counterbore: CounterboreSpec;
  countersink: CountersinkSpec;
  heatset_insert: HeatsetInsertSpec;
  pilot: PilotHoleSpec;
};
