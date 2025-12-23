import { useState, useEffect, useCallback, useRef } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { GetResources, StartWatch, StopWatch } from '../../wailsjs/go/main/App';
import type { main } from '../../wailsjs/go/models';
import { getResourceKey, type ResourceEvent } from '../lib/resource-utils';
import { useBatchProcessor } from './useBatchProcessor';

// Watch connection status
export type WatchStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface UseResourceDataOptions {
  /** Enable real-time updates via watch (default: false) */
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
  /** Manually refresh data */
  refresh: () => void;
  /** Watch connection status */
  watchStatus: WatchStatus;
  /** Get stable row ID for TanStack Table */
  getRowId: (row: any) => string;
}

/**
 * Hook for fetching and managing Kubernetes resource data
 *
 * Extracts data fetching logic from ResultTable for:
 * - Cleaner component code
 * - Testability
 * - Future watch subscription support
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
  const { watch = false, batchInterval = 100 } = options;

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [watchStatus, setWatchStatus] = useState<WatchStatus>('disconnected');

  // Ref to track current fetch to avoid race conditions
  const fetchIdRef = useRef(0);

  // Pending events for batch processing (used when watch is enabled)
  const pendingEvents = useRef<ResourceEvent[]>([]);

  // Initial fetch
  useEffect(() => {
    if (!gvk || contexts.length === 0) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    GetResources(gvk, contexts)
      .then((resources) => {
        // Ignore stale responses
        if (fetchId !== fetchIdRef.current) return;

        setData(resources || []);
        setLoading(false);
      })
      .catch((err) => {
        // Ignore stale errors
        if (fetchId !== fetchIdRef.current) return;

        console.error('Failed to load resources:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setData([]);
        setLoading(false);
      });
  }, [gvk, contexts]);

  // Watch subscription (when enabled)
  useEffect(() => {
    if (!watch || !gvk || contexts.length === 0) {
      setWatchStatus('disconnected');
      return;
    }

    setWatchStatus('connecting');

    // Start watch on backend
    StartWatch(gvk, contexts)
      .then(() => {
        console.log(`useResourceData: watch connected for ${gvk.kind}`);
        setWatchStatus('connected');
      })
      .catch((err) => {
        console.error('useResourceData: failed to start watch:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setWatchStatus('error');
      });

    // Subscribe to events from backend
    const unsubscribe = EventsOn('resource:update', (event: ResourceEvent) => {
      pendingEvents.current.push(event);
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

  // Setup batch processor (only processes when events are pending)
  useBatchProcessor(pendingEvents, setData, batchInterval);

  // Manual refresh
  const refresh = useCallback(() => {
    if (!gvk || contexts.length === 0) return;

    const fetchId = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    GetResources(gvk, contexts)
      .then((resources) => {
        if (fetchId !== fetchIdRef.current) return;
        setData(resources || []);
        setLoading(false);
      })
      .catch((err) => {
        if (fetchId !== fetchIdRef.current) return;
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
  };
}
