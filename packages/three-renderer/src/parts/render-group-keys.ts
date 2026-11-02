/**
 * @author Aidan Boissonneault
 * @file render-group-keys.ts
 * @purpose Renders group keys for the parts in three renderer package.
 * @last-edited October 6, 2026
 */

/**
 * Builds the internal key for a body render group.
 * Body names are scoped by part in BushSCAD source, but the renderer used to
 * key them globally. Repeated names like `boss` in multiple parts must not
 * attach to the first part's explode wrapper.
 */
export function bodyRenderGroupKey(partName: string, bodyName: string): string {
  return `${partName}\u0000${bodyName}`;
}
