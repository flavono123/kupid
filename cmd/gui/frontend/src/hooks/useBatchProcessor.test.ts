import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef, useState } from 'react';
import { useBatchProcessor } from './useBatchProcessor';
import type { ResourceEvent } from '../lib/resource-utils';

// Helper hook to test useBatchProcessor
function useTestBatchProcessor(intervalMs: number = 100) {
  const [data, setData] = useState<any[]>([]);
  const pendingEvents = useRef<ResourceEvent[]>([]);

  useBatchProcessor(pendingEvents, setData, intervalMs);

  return {
    data,
    setData,
    pendingEvents,
    pushEvent: (event: ResourceEvent) => {
      pendingEvents.current.push(event);
    },
    pushEvents: (events: ResourceEvent[]) => {
      pendingEvents.current.push(...events);
    },
  };
}

describe('useBatchProcessor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not process when no events are pending', () => {
    const { result } = renderHook(() => useTestBatchProcessor(100));

    expect(result.current.data).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.data).toEqual([]);
  });

  it('should process pending events at interval', () => {
    const { result } = renderHook(() => useTestBatchProcessor(100));

    // Add initial data
    act(() => {
      result.current.setData([
        { _context: 'c1', metadata: { namespace: 'ns', name: 'pod-1' } },
      ]);
    });

    // Push an ADDED event
    act(() => {
      result.current.pushEvent({
        type: 'ADDED',
        object: { _context: 'c1', metadata: { namespace: 'ns', name: 'pod-2' } },
      });
    });

    // Before interval passes, data should be unchanged
    expect(result.current.data).toHaveLength(1);

    // Advance timer to trigger flush
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Now data should include the new pod
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data.find(r => r.metadata.name === 'pod-2')).toBeDefined();
  });

  it('should batch multiple events into single update', () => {
    const { result } = renderHook(() => useTestBatchProcessor(100));

    // Track render count via setter
    let updateCount = 0;
    const originalSetData = result.current.setData;

    // Push multiple events
    act(() => {
      result.current.pushEvents([
        { type: 'ADDED', object: { _context: 'c1', metadata: { namespace: 'ns', name: 'pod-1' } } },
        { type: 'ADDED', object: { _context: 'c1', metadata: { namespace: 'ns', name: 'pod-2' } } },
        { type: 'ADDED', object: { _context: 'c1', metadata: { namespace: 'ns', name: 'pod-3' } } },
      ]);
    });

    expect(result.current.data).toHaveLength(0);

    // Single flush should process all events
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.data).toHaveLength(3);
  });

  it('should clear pending events after flush', () => {
    const { result } = renderHook(() => useTestBatchProcessor(100));

    act(() => {
      result.current.pushEvent({
        type: 'ADDED',
        object: { _context: 'c1', metadata: { namespace: 'ns', name: 'pod-1' } },
      });
    });

    // Check pending events before flush
    expect(result.current.pendingEvents.current).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Pending events should be cleared
    expect(result.current.pendingEvents.current).toHaveLength(0);
  });

  it('should respect custom interval', () => {
    const { result } = renderHook(() => useTestBatchProcessor(200));

    act(() => {
      result.current.pushEvent({
        type: 'ADDED',
        object: { _context: 'c1', metadata: { namespace: 'ns', name: 'pod-1' } },
      });
    });

    // At 100ms, should not have flushed yet
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.data).toHaveLength(0);

    // At 200ms, should have flushed
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.data).toHaveLength(1);
  });

  it('should continue processing at intervals', () => {
    const { result } = renderHook(() => useTestBatchProcessor(100));

    // First batch
    act(() => {
      result.current.pushEvent({
        type: 'ADDED',
        object: { _context: 'c1', metadata: { namespace: 'ns', name: 'pod-1' } },
      });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.data).toHaveLength(1);

    // Second batch
    act(() => {
      result.current.pushEvent({
        type: 'ADDED',
        object: { _context: 'c1', metadata: { namespace: 'ns', name: 'pod-2' } },
      });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.data).toHaveLength(2);

    // Third batch - delete
    act(() => {
      result.current.pushEvent({
        type: 'DELETED',
        object: { _context: 'c1', metadata: { namespace: 'ns', name: 'pod-1' } },
      });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].metadata.name).toBe('pod-2');
  });

  it('should cleanup interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() => useTestBatchProcessor(100));

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should handle rapid event accumulation', () => {
    const { result } = renderHook(() => useTestBatchProcessor(100));

    // Simulate rapid watch events (50 events in 50ms)
    for (let i = 0; i < 50; i++) {
      act(() => {
        result.current.pushEvent({
          type: 'ADDED',
          object: { _context: 'c1', metadata: { namespace: 'ns', name: `pod-${i}` } },
        });
        vi.advanceTimersByTime(1);
      });
    }

    // After 50ms, should not have flushed yet
    expect(result.current.data).toHaveLength(0);
    expect(result.current.pendingEvents.current.length).toBe(50);

    // At 100ms, all should be flushed at once
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current.data).toHaveLength(50);
    expect(result.current.pendingEvents.current.length).toBe(0);
  });
});
