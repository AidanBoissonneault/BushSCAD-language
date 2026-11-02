/**
 * @author Aidan Boissonneault
 * @file scope.ts
 * @purpose Provides scope behavior for the core in resolver package.
 * @last-edited October 6, 2026
 */

import type { SymKind } from './types.js';

/**
 * Lexical symbol table used by the resolver.
 * Resolution needs nested lookup without mutating parent scopes when entering
 * component bodies, functions, loops, and conditional branches.
 */
export class Scope {
  private map = new Map<string, SymKind>();

  /**
   * Initializes the `Scope` instance with the values supplied by its caller.
   */
  constructor(private parent: Scope | null = null) {}

  /**
   * Handles define in the core flow.
   */
  define(name: string, kind: SymKind): void {
    this.map.set(name, kind);
  }

  /**
   * Looks up by its declared key.
   */
  lookup(name: string): SymKind | null {
    return this.map.get(name) ?? this.parent?.lookup(name) ?? null;
  }
}
