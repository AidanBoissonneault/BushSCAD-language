/**
 * @author Aidan Boissonneault
 * @file part-solid-transform.ts
 * @purpose Provides part solid transform behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { GroupBuildState, OC } from '../bridge/bridge-types.js';

/**
 * Defines the `RegisterAlias` callback contract used by the operations layer.
 */
type RegisterAlias = (state: GroupBuildState, alias: string, shape: OC) => void;

/**
 * Replaces one deferred component and refreshes every alias that targets it.
 * Transform operations consume their input OCCT handle. Explicit parts retain
 * components separately until fusion, so stale alias-region handles must be
 * replaced before face-label registration reads them again.
 */
export function replaceDeferredPartComponent(
  state: GroupBuildState,
  name: string,
  shape: OC,
  registerAlias: RegisterAlias,
): boolean {
  if (!state.partSolidOwner) return false;
  const component = state.partSolidAliasComponents.get(name);
  if (!component) return false;

  state.partSolidComponents.set(component, shape);
  for (const [alias, aliasComponent] of state.partSolidAliasComponents) {
    if (aliasComponent !== component) continue;
    state.partSolidAliasShapes.set(alias, shape);
    registerAlias(state, alias, shape);
  }
  state.bodyShapes.set(state.partSolidOwner, shape);
  return true;
}
