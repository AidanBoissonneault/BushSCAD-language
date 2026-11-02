/**
 * @author Aidan Boissonneault
 * @file scheduler-resource-locks.ts
 * @purpose Provides scheduler resource locks behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompilationGraphNode } from '@bushscad/ir';

/** Enforces many-readers-or-one-writer access for currently running tasks. */
export class SchedulerResourceLocks {
  private readonly readers = new Map<string, Set<string>>();
  private readonly writers = new Map<string, string>();

  /**
   * Checks whether the current state allows acquire.
   */
  canAcquire(node: CompilationGraphNode): boolean {
    return (
      node.reads.every((resource) => !this.writers.has(resource)) &&
      node.writes.every((resource) => this.writeAvailable(resource))
    );
  }

  /**
   * Handles acquire in the pipeline parallel compilation flow.
   */
  acquire(node: CompilationGraphNode): void {
    if (!this.canAcquire(node))
      throw new Error(`Resources for '${node.id}' are not available.`);
    for (const resource of node.reads) {
      const readers = this.readers.get(resource) ?? new Set<string>();
      readers.add(node.id);
      this.readers.set(resource, readers);
    }
    for (const resource of node.writes) this.writers.set(resource, node.id);
  }

  /**
   * Handles release in the pipeline parallel compilation flow.
   */
  release(node: CompilationGraphNode): void {
    for (const resource of node.reads) {
      const readers = this.readers.get(resource);
      readers?.delete(node.id);
      if (readers?.size === 0) this.readers.delete(resource);
    }
    for (const resource of node.writes) {
      if (this.writers.get(resource) === node.id) this.writers.delete(resource);
    }
  }

  /**
   * Writes available to the configured destination.
   */
  private writeAvailable(resource: string): boolean {
    return (
      !this.writers.has(resource) &&
      (this.readers.get(resource)?.size ?? 0) === 0
    );
  }
}
