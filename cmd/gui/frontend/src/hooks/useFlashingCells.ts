import { useState, useEffect, useCallback, useRef } from 'react';
import type { CellChange } from '../lib/resource-utils';

/**
 * Duration of flash effect in milliseconds
 * TODO: [CONFIG] Move to YAML config. Must sync with tailwind.config.js cell-flash animation duration
 */
const FLASH_DURATION_MS = 1000;

/**
 * Hook to manage flashing cell state for real-time update visualization
 *
 * Tracks which cells are currently in a "flashing" state and automatically
 * removes them after FLASH_DURATION_MS.
 *
 * @param changedCells Array of cell changes from the most recent batch
 * @returns Object with isFlashing function to check if a cell should flash
 */
export function useFlashingCells(changedCells: CellChange[]) {
  const [flashingCells, setFlashingCells] = useState<Set<string>>(new Set());

  // Track timers per cell key to avoid clearing all timers on rerender
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Add new changes to flashing set and schedule removal
  useEffect(() => {
    if (changedCells.length === 0) return;

    const newKeys = changedCells.map((c) => `${c.rowId}:${c.columnId}`);

    // Add all new keys to flashing set
    setFlashingCells((prev) => {
      const next = new Set(prev);
      newKeys.forEach((k) => next.add(k));
      return next;
    });

    // Schedule removal for each key (cancel existing timer if present)
    for (const key of newKeys) {
      // Clear existing timer for this key if it exists
      const existingTimer = timersRef.current.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new timer for this key
      const timer = setTimeout(() => {
        setFlashingCells((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        timersRef.current.delete(key);
      }, FLASH_DURATION_MS);

      timersRef.current.set(key, timer);
    }

    // No cleanup needed - timers should complete naturally
    // Only cleanup on unmount (handled by separate effect)
  }, [changedCells]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  // Check if a specific cell is currently flashing
  const isFlashing = useCallback(
    (rowId: string, columnId: string) => {
      return flashingCells.has(`${rowId}:${columnId}`);
    },
    [flashingCells]
  );

  return { isFlashing, flashingCells };
}
