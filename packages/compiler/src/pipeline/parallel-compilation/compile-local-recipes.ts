/**
 * @author Aidan Boissonneault
 * @file compile-local-recipes.ts
 * @purpose Provides compile local recipes behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { CanonicalRecipe } from './recipe-canonicalization.js';

/**
 * Type used for compile local recipe identity.
 */
export type CompileLocalRecipeIdentity = Readonly<{
  key: string;
  cacheHit: boolean;
  collision: boolean;
}>;

/**
 * Type used for registered recipe.
 */
type RegisteredRecipe = Readonly<{
  canonical: string;
  key: string;
}>;

/**
 * Interns canonical recipes while verifying every non-cryptographic digest hit.
 * Recipe digests are compact scheduling keys rather than identity proofs.
 * Comparing canonical inputs prevents an accidental hash collision from sharing
 * geometry, while a deterministic collision suffix keeps both recipes usable.
 */
export class CompileLocalRecipeRegistry {
  private readonly buckets = new Map<string, RegisteredRecipe[]>();

  /**
   * Handles intern in the pipeline parallel compilation flow.
   */
  intern(recipe: CanonicalRecipe): CompileLocalRecipeIdentity {
    const bucket = this.buckets.get(recipe.digest) ?? [];
    const existing = bucket.find(
      (registered) => registered.canonical === recipe.canonical,
    );
    if (existing) {
      return {
        key: existing.key,
        cacheHit: true,
        collision: bucket.length > 1,
      };
    }

    const collision = bucket.length > 0;
    const key = collision
      ? `${recipe.digest}:collision:${bucket.length}`
      : recipe.digest;
    bucket.push({ canonical: recipe.canonical, key });
    this.buckets.set(recipe.digest, bucket);
    return { key, cacheHit: false, collision };
  }
}
