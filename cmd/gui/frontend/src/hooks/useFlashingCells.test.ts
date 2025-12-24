import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFlashingCells } from './useFlashingCells';
import type { CellChange } from '../lib/resource-utils';

describe('useFlashingCells', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return isFlashing as false initially', () => {
    const { result } = renderHook(() => useFlashingCells([]));

    expect(result.current.isFlashing('row1', 'col1')).toBe(false);
  });

  it('should mark cell as flashing when change is received', () => {
    const changes: CellChange[] = [
      { rowId: 'row1', columnId: 'status.phase', timestamp: Date.now() },
    ];

    const { result } = renderHook(() => useFlashingCells(changes));

    expect(result.current.isFlashing('row1', 'status.phase')).toBe(true);
  });

  it('should not mark unrelated cells as flashing', () => {
    const changes: CellChange[] = [
      { rowId: 'row1', columnId: 'status.phase', timestamp: Date.now() },
    ];

    const { result } = renderHook(() => useFlashingCells(changes));

    expect(result.current.isFlashing('row1', 'status.phase')).toBe(true);
    expect(result.current.isFlashing('row1', 'other.field')).toBe(false);
    expect(result.current.isFlashing('row2', 'status.phase')).toBe(false);
  });

  it('should remove flashing state after 1000ms', () => {
    const changes: CellChange[] = [
      { rowId: 'row1', columnId: 'status.phase', timestamp: Date.now() },
    ];

    const { result } = renderHook(() => useFlashingCells(changes));

    expect(result.current.isFlashing('row1', 'status.phase')).toBe(true);

    // Advance time by 1000ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isFlashing('row1', 'status.phase')).toBe(false);
  });

  it('should handle multiple cells flashing simultaneously', () => {
    const changes: CellChange[] = [
      { rowId: 'row1', columnId: 'col1', timestamp: Date.now() },
      { rowId: 'row1', columnId: 'col2', timestamp: Date.now() },
      { rowId: 'row2', columnId: 'col1', timestamp: Date.now() },
    ];

    const { result } = renderHook(() => useFlashingCells(changes));

    expect(result.current.isFlashing('row1', 'col1')).toBe(true);
    expect(result.current.isFlashing('row1', 'col2')).toBe(true);
    expect(result.current.isFlashing('row2', 'col1')).toBe(true);
  });

  it('should remove all cells after flash duration', () => {
    const changes: CellChange[] = [
      { rowId: 'row1', columnId: 'col1', timestamp: Date.now() },
      { rowId: 'row1', columnId: 'col2', timestamp: Date.now() },
    ];

    const { result } = renderHook(() => useFlashingCells(changes));

    expect(result.current.flashingCells.size).toBe(2);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.flashingCells.size).toBe(0);
  });

  it('should handle new changes while others are still flashing', () => {
    const initialChanges: CellChange[] = [
      { rowId: 'row1', columnId: 'col1', timestamp: Date.now() },
    ];

    const { result, rerender } = renderHook(
      ({ changes }) => useFlashingCells(changes),
      { initialProps: { changes: initialChanges } }
    );

    expect(result.current.isFlashing('row1', 'col1')).toBe(true);

    // After 500ms, add a new change
    act(() => {
      vi.advanceTimersByTime(500);
    });

    const newChanges: CellChange[] = [
      { rowId: 'row2', columnId: 'col2', timestamp: Date.now() },
    ];

    rerender({ changes: newChanges });

    // Both should be flashing
    expect(result.current.isFlashing('row1', 'col1')).toBe(true);
    expect(result.current.isFlashing('row2', 'col2')).toBe(true);

    // After another 500ms (1000ms total from first), first should stop
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isFlashing('row1', 'col1')).toBe(false);
    expect(result.current.isFlashing('row2', 'col2')).toBe(true);

    // After another 500ms, second should stop
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isFlashing('row2', 'col2')).toBe(false);
  });

  it('should restart flash timer if same cell changes again', () => {
    const changes1: CellChange[] = [
      { rowId: 'row1', columnId: 'col1', timestamp: Date.now() },
    ];

    const { result, rerender } = renderHook(
      ({ changes }) => useFlashingCells(changes),
      { initialProps: { changes: changes1 } }
    );

    expect(result.current.isFlashing('row1', 'col1')).toBe(true);

    // After 700ms, same cell changes again
    act(() => {
      vi.advanceTimersByTime(700);
    });

    const changes2: CellChange[] = [
      { rowId: 'row1', columnId: 'col1', timestamp: Date.now() },
    ];

    rerender({ changes: changes2 });

    // Still flashing
    expect(result.current.isFlashing('row1', 'col1')).toBe(true);

    // 300ms more (1000ms from first change) - first timer would fire
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // But cell was re-added, so still flashing (700ms left on second timer)
    // Note: With current implementation, first timer removes, but we're still in the set from second addition
    // This test verifies the behavior - let's check what actually happens
    expect(result.current.isFlashing('row1', 'col1')).toBe(true);
  });

  it('should not flash when changedCells is empty array', () => {
    const { result, rerender } = renderHook(
      ({ changes }) => useFlashingCells(changes),
      { initialProps: { changes: [] as CellChange[] } }
    );

    expect(result.current.flashingCells.size).toBe(0);

    rerender({ changes: [] });

    expect(result.current.flashingCells.size).toBe(0);
  });

  it('should cleanup timer on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const changes: CellChange[] = [
      { rowId: 'row1', columnId: 'col1', timestamp: Date.now() },
    ];

    const { unmount } = renderHook(() => useFlashingCells(changes));

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
