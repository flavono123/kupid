import { useEffect, useState, type MutableRefObject, type Dispatch, type SetStateAction } from 'react';
import {
  applyBatchEventsWithChanges,
  type ResourceEvent,
  type CellChange,
} from '../lib/resource-utils';

/**
 * @deprecated This hook is no longer used by useResourceData as of v0.2.0.
 * The Push Model (full objects via EventsEmit) has been replaced by Pull Model
 * (key emit + GetResourcesByKeys fetch) to fix WebView memory leaks caused by
 * Wails EventsEmit using eval() internally.
 *
 * This hook is kept for one release cycle for backward compatibility.
 * Scheduled for removal in v0.3.0.
 *
 * See: planning/memory-leak-investigation.md section 2.5 for Pull Model design.
 *
 * ---
 *
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
 * @returns Array of cell changes from the most recent batch
 */
export function useBatchProcessor(
  pendingEvents: MutableRefObject<ResourceEvent[]>,
  setData: Dispatch<SetStateAction<any[]>>,
  // TODO: [CONFIG] Move to YAML config. Must sync with useResourceData.ts batchInterval default
  intervalMs: number = 100
): CellChange[] {
  const [changedCells, setChangedCells] = useState<CellChange[]>([]);

  useEffect(() => {
    const flush = () => {
      const events = pendingEvents.current;
      if (events.length === 0) return;

      // Clear pending events
      pendingEvents.current = [];

      // Apply all events and track changes
      setData((prev) => {
        const result = applyBatchEventsWithChanges(prev, events);
        // Update changed cells (done inside setState to ensure we have correct prev)
        setChangedCells(result.changes);
        return result.data;
      });
    };

    const timer = setInterval(flush, intervalMs);
    return () => clearInterval(timer);
  }, [pendingEvents, setData, intervalMs]);

  return changedCells;
}
