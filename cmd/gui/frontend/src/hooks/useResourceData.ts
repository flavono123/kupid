import { useState, useEffect, useCallback, useRef } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { StartWatch, StopWatch } from '../../wailsjs/go/main/App';
import type { main } from '../../wailsjs/go/models';
import { getResourceKey, type ResourceEvent, type CellChange } from '../lib/resource-utils';
import { useBatchProcessor } from './useBatchProcessor';

// Watch connection status
export type WatchStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseResourceDataOptions {
  /** Enable real-time updates via watch (default: true) */
  watch?: boolean;
  /** Batch interval in ms (default: 100) */
  batchInterval?: number;
}

export interface UseResourceDataResult {
  /** Resource data array */
  data: any[];
  /** Loading state for initial fetch */
  loading: boolean;
  /** Error from fetch or watch */
  error: Error | null;
  /** Manually refresh data (restarts watch) */
  refresh: () => void;
  /** Watch connection status */
  watchStatus: WatchStatus;
  /** Get stable row ID for TanStack Table */
  getRowId: (row: any) => string;
  /** Cells that changed in the most recent batch update */
  changedCells: CellChange[];
}

/**
 * Hook for fetching and managing Kubernetes resource data via watch
 *
 * Uses Kubernetes watch for both initial data (via ADDED events) and real-time updates.
 * This eliminates duplicate List API calls that occurred with separate GetResources + StartWatch.
 *
 * @param gvk The Group/Version/Kind to fetch
 * @param contexts Array of Kubernetes contexts to query
 * @param options Configuration options
 */
export function useResourceData(
  gvk: main.MultiClusterGVK | null,
  contexts: string[],
  options: UseResourceDataOptions = {}
): UseResourceDataResult {
  const { watch = true, batchInterval = 100 } = options;

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [watchStatus, setWatchStatus] = useState<WatchStatus>('disconnected');

  // Track watch generation to avoid stale operations
  const watchGenRef = useRef(0);

  // Pending events for batch processing
  const pendingEvents = useRef<ResourceEvent[]>([]);

  // Watch subscription - provides both initial data (ADDED events) and real-time updates
  useEffect(() => {
    if (!watch || !gvk || contexts.length === 0) {
      setData([]);
      setLoading(false);
      setError(null);
      setWatchStatus('disconnected');
      return;
    }

    const watchGen = ++watchGenRef.current;
    setLoading(true);
    setError(null);
    setData([]); // Clear previous data
    setWatchStatus('connecting');

    // Start watch - backend will emit ADDED events for all initial resources
    StartWatch(gvk, contexts)
      .then(() => {
        // Ignore if this watch was superseded
        if (watchGen !== watchGenRef.current) return;

        console.log(`useResourceData: watch connected for ${gvk.kind}`);
        setWatchStatus('connected');
        // Loading will be set to false by batch processor after initial events arrive
        // Use a small delay to ensure events have been processed
        setTimeout(() => {
          if (watchGen === watchGenRef.current) {
            setLoading(false);
          }
        }, 50);
      })
      .catch((err) => {
        // Ignore if this watch was superseded
        if (watchGen !== watchGenRef.current) return;

        console.error('useResourceData: failed to start watch:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setWatchStatus('error');
        setLoading(false);
      });

    // Subscribe to events from backend
    const unsubscribe = EventsOn('resource:update', (event: ResourceEvent) => {
      // Only process events for current watch generation
      if (watchGen === watchGenRef.current) {
        pendingEvents.current.push(event);
      }
    });

    // Cleanup: unsubscribe and stop watch
    return () => {
      unsubscribe();
      StopWatch()
        .then(() => {
          console.log('useResourceData: watch stopped');
        })
        .catch((err) => {
          console.error('useResourceData: failed to stop watch:', err);
        });
      setWatchStatus('disconnected');
    };
  }, [watch, gvk, contexts]);

  // Setup batch processor (processes ADDED for initial data, MODIFIED/DELETED for updates)
  const changedCells = useBatchProcessor(pendingEvents, setData, batchInterval);

  // Manual refresh - restarts the watch to get fresh data
  const refresh = useCallback(() => {
    if (!gvk || contexts.length === 0) return;

    const watchGen = ++watchGenRef.current;
    setLoading(true);
    setError(null);
    setData([]);

    // Stop and restart watch
    StopWatch()
      .then(() => StartWatch(gvk, contexts))
      .then(() => {
        if (watchGen !== watchGenRef.current) return;
        setWatchStatus('connected');
        setTimeout(() => {
          if (watchGen === watchGenRef.current) {
            setLoading(false);
          }
        }, 50);
      })
      .catch((err) => {
        if (watchGen !== watchGenRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });
  }, [gvk, contexts]);

  // Stable row ID function for TanStack Table
  const getRowId = useCallback((row: any) => {
    return getResourceKey(row);
  }, []);

  return {
    data,
    loading,
    error,
    refresh,
    watchStatus,
    getRowId,
    changedCells,
  };
}
