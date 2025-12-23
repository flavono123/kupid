/**
 * Resource utilities for real-time updates
 *
 * Provides helper functions for:
 * - Generating stable resource keys
 * - Batch processing of watch events
 */

// Types for resource events (will be imported from wailsjs once backend is ready)
export type ResourceEventType = 'ADDED' | 'MODIFIED' | 'DELETED';

export interface ResourceEvent {
  type: ResourceEventType;
  object: any;
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

/**
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
