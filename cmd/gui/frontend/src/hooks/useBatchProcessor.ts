import { useEffect, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import { applyBatchEvents, type ResourceEvent } from '../lib/resource-utils';

/**
 * Batch processor hook for resource watch events
 *
 * Accumulates events in pendingEvents ref and flushes them at intervals,
 * applying all changes in a single setState call to minimize re-renders.
 *
 * Performance comparison (100 events in 1 second):
 * - Without batching: 100 renders
 * - With batching (100ms): ~10 renders
 *
 * @param pendingEvents Ref to array accumulating incoming events
 * @param setData Setter function for resource data state
 * @param intervalMs Flush interval in milliseconds (default: 100)
 */
export function useBatchProcessor(
  pendingEvents: MutableRefObject<ResourceEvent[]>,
  setData: Dispatch<SetStateAction<any[]>>,
  intervalMs: number = 100
): void {
  useEffect(() => {
    const flush = () => {
      const events = pendingEvents.current;
      if (events.length === 0) return;

      // Clear pending events
      pendingEvents.current = [];

      // Apply all events in single setState
      setData((prev) => applyBatchEvents(prev, events));
    };

    const timer = setInterval(flush, intervalMs);
    return () => clearInterval(timer);
  }, [pendingEvents, setData, intervalMs]);
}
