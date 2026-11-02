/**
 * @author Aidan Boissonneault
 * @file loft-operations.ts
 * @purpose Provides loft operations behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { SourceSpan } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import { isOcctError, occtError } from '../core/occt-errors.js';

/**
 * Builds a solid loft from ordered section wires.
 * Unguided, guided, and inline solid-cut lofts should share the same OCCT
 * builder setup and error wrapping so source diagnostics stay consistent.
 */
export function buildThruSectionsLoft(
  oc: OC,
  wires: OC[],
  failureMessage: string,
  span: SourceSpan,
): OC {
  let loft: OC | null = null;
  try {
    loft = createThruSectionsBuilder(oc);
    wires.forEach((wire) => addSectionWire(oc, loft as OC, wire));
    loft.Build();
    if (loft.IsDone && !loft.IsDone()) throw occtError(failureMessage, span);
    return loft.Shape();
  } catch (err) {
    if (isOcctError(err)) throw err;
    throw occtError(
      `${failureMessage}: ${err instanceof Error ? err.message : String(err)}`,
      span,
    );
  } finally {
    loft?.delete?.();
  }
}

/**
 * Creates thru sections builder with the supplied values.
 */
function createThruSectionsBuilder(oc: OC): OC {
  const builder = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);
  builder.CheckCompatibility?.(false);
  return builder;
}

/**
 * Adds section wire to its owning collection.
 */
function addSectionWire(oc: OC, builder: OC, wire: OC): void {
  builder.AddWire(oc.TopoDS.Wire_1(wire));
}
