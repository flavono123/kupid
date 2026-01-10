/**
 * Resource utilities for real-time updates
 *
 * Provides helper functions for:
 * - Generating stable resource keys
 * - Batch processing of watch events
 */

// Types for resource events
export type ResourceEventType = 'ADDED' | 'MODIFIED' | 'DELETED';

// Pull Model: lightweight event with only type and key (no full object)
export interface ResourceEventMeta {
  type: ResourceEventType;
  /** Unique key: "context/namespace/name" */
  key: string;
}

/**
 * @deprecated Legacy Push Model type. Use ResourceEventMeta instead.
 * Scheduled for removal in v0.3.0.
 */
export interface ResourceEvent {
  type: ResourceEventType;
  /** Kubernetes context name (optional, also in object._context) */
  context?: string;
  /** Resource namespace (optional, also in object.metadata.namespace) */
  namespace?: string;
  /** Resource name (optional, also in object.metadata.name) */
  name?: string;
  /** Full resource object */
  object: Record<string, unknown>;
}

/**
 * Generate a unique key for a Kubernetes resource
 * Format: {context}/{namespace}/{name}
 *
 * This key is stable across updates and can be used for:
 * - TanStack Table row identity
 * - Map-based lookups for batch updates
 */
export function getResourceKey(resource: any): string {
  const context = resource._context || '';
  const namespace = resource.metadata?.namespace || '';
  const name = resource.metadata?.name || '';
  return `${context}/${namespace}/${name}`;
}

// Types for cell change tracking
export interface CellChange {
  rowId: string;      // resource key (context/namespace/name)
  columnId: string;   // field path (e.g., "status.phase")
  timestamp: number;  // when the change was detected
}

/**
 * Compare two objects and return the paths of changed leaf values
 *
 * @param prev Previous object state
 * @param next New object state
 * @param path Current path (used for recursion)
 * @returns Array of dot-separated paths where values differ
 */
export function diffFields(prev: any, next: any, path: string[] = []): string[] {
  const changes: string[] = [];

  // Handle null/undefined cases
  if (prev === next) return changes;
  if (prev == null && next == null) return changes;
  if (prev == null || next == null) {
    // One is null, the other isn't - this path changed
    if (path.length > 0) {
      return [path.join('.')];
    }
    return changes;
  }

  // Handle non-object types (leaf values)
  if (typeof prev !== 'object' || typeof next !== 'object') {
    if (prev !== next && path.length > 0) {
      return [path.join('.')];
    }
    return changes;
  }

  // Handle arrays
  if (Array.isArray(prev) || Array.isArray(next)) {
    // For arrays, compare stringified versions for simplicity
    // (we don't track individual array element changes)
    if (JSON.stringify(prev) !== JSON.stringify(next) && path.length > 0) {
      return [path.join('.')];
    }
    return changes;
  }

  // Handle objects - recurse into properties
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of allKeys) {
    const prevVal = prev[key];
    const nextVal = next[key];
    const currentPath = [...path, key];

    changes.push(...diffFields(prevVal, nextVal, currentPath));
  }

  return changes;
}

/**
 * @deprecated Legacy Push Model function. No longer used by useResourceData.
 * Scheduled for removal in v0.3.0.
 *
 * Apply a batch of resource events to the current data array
 *
 * Uses Map for O(1) lookups, making it efficient for large datasets:
 * - ADDED: Insert new resource
 * - MODIFIED: Update existing resource
 * - DELETED: Remove resource
 *
 * @param data Current resource data array
 * @param events Array of resource events to apply
 * @returns New data array with events applied
 */
export function applyBatchEvents(data: any[], events: ResourceEvent[]): any[] {
  if (events.length === 0) {
    return data;
  }

  // Convert to Map for O(1) lookups
  const dataMap = new Map(
    data.map((item) => [getResourceKey(item), item])
  );

  // Apply all events
  for (const event of events) {
    const key = getResourceKey(event.object);

    switch (event.type) {
      case 'ADDED':
      case 'MODIFIED':
        dataMap.set(key, event.object);
        break;
      case 'DELETED':
        dataMap.delete(key);
        break;
    }
  }

  return Array.from(dataMap.values());
}

/**
 * @deprecated Legacy Push Model type. Scheduled for removal in v0.3.0.
 * Result of applying batch events with change tracking
 */
export interface BatchResult {
  data: any[];
  changes: CellChange[];
}

/**
 * @deprecated Legacy Push Model function. No longer used by useResourceData.
 * Scheduled for removal in v0.3.0.
 *
 * Apply batch events and track which cells changed
 *
 * @param data Current resource data array
 * @param events Array of resource events to apply
 * @returns New data array and list of changed cells
 */
export function applyBatchEventsWithChanges(
  data: any[],
  events: ResourceEvent[]
): BatchResult {
  if (events.length === 0) {
    return { data, changes: [] };
  }

  const now = Date.now();
  const changes: CellChange[] = [];

  // Convert to Map for O(1) lookups
  const dataMap = new Map(
    data.map((item) => [getResourceKey(item), item])
  );

  // Apply all events and track changes
  for (const event of events) {
    const rowId = getResourceKey(event.object);

    switch (event.type) {
      case 'MODIFIED': {
        const prev = dataMap.get(rowId);
        if (prev) {
          // Find which fields changed
          const changedPaths = diffFields(prev, event.object);
          for (const columnId of changedPaths) {
            changes.push({ rowId, columnId, timestamp: now });
          }
        }
        dataMap.set(rowId, event.object);
        break;
      }
      case 'ADDED':
        dataMap.set(rowId, event.object);
        break;
      case 'DELETED':
        dataMap.delete(rowId);
        break;
    }
  }

  return {
    data: Array.from(dataMap.values()),
    changes,
  };
}
