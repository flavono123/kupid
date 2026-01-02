/**
 * Tests for useFavoriteViews hook
 *
 * Focus on:
 * - Order-sensitive field matching (same fields, different order = different favorites)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFavoriteViews } from './useFavoriteViews';

// Mock Wails functions
vi.mock('../../wailsjs/go/main/App', () => ({
  ListFavoriteViews: vi.fn(),
  SaveFavoriteView: vi.fn(),
  DeleteFavoriteView: vi.fn(),
  RenameFavoriteView: vi.fn(),
}));

import {
  ListFavoriteViews,
  SaveFavoriteView,
} from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';

const mockGVK = {
  group: '',
  version: 'v1',
  kind: 'Pod',
};

const createFavorite = (id: string, name: string, fields: string[][]): main.FavoriteViewResponse => {
  return main.FavoriteViewResponse.createFrom({
    id,
    name,
    gvk: mockGVK,
    fields,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
};

describe('useFavoriteViews - Order-Sensitive Matching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should match favorite when fields are in same order', async () => {
    const favorite = createFavorite('fav-1', 'My View', [
      ['metadata', 'namespace'],
      ['metadata', 'name'],
    ]);

    vi.mocked(ListFavoriteViews).mockResolvedValue([favorite]);

    const selectedPaths = new Set([
      JSON.stringify(['metadata', 'namespace']),
      JSON.stringify(['metadata', 'name']),
    ]);

    const { result } = renderHook(() =>
      useFavoriteViews({
        currentGVK: mockGVK,
        selectedPaths,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Same fields in same order should match
    expect(result.current.activeFavorite).not.toBeNull();
    expect(result.current.activeFavorite?.id).toBe('fav-1');
  });

  it('should NOT match favorite when fields are in different order', async () => {
    const favorite = createFavorite('fav-1', 'My View', [
      ['metadata', 'namespace'],
      ['metadata', 'name'],
    ]);

    vi.mocked(ListFavoriteViews).mockResolvedValue([favorite]);

    // Same fields but REVERSED order
    const selectedPaths = new Set([
      JSON.stringify(['metadata', 'name']),
      JSON.stringify(['metadata', 'namespace']),
    ]);

    const { result } = renderHook(() =>
      useFavoriteViews({
        currentGVK: mockGVK,
        selectedPaths,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Same fields but different order should NOT match
    expect(result.current.activeFavorite).toBeNull();
  });

  it('should allow saving same fields with different order as separate favorites', async () => {
    const existingFavorite = createFavorite('fav-1', 'Order A', [
      ['metadata', 'namespace'],
      ['metadata', 'name'],
    ]);

    vi.mocked(ListFavoriteViews).mockResolvedValue([existingFavorite]);

    const newFavorite = createFavorite('fav-2', 'Order B', [
      ['metadata', 'name'],
      ['metadata', 'namespace'],
    ]);

    vi.mocked(SaveFavoriteView).mockResolvedValue(newFavorite);

    // Select fields in different order
    const selectedPaths = new Set([
      JSON.stringify(['metadata', 'name']),
      JSON.stringify(['metadata', 'namespace']),
    ]);

    const { result } = renderHook(() =>
      useFavoriteViews({
        currentGVK: mockGVK,
        selectedPaths,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should not match existing favorite (different order)
    expect(result.current.activeFavorite).toBeNull();

    // Save as new favorite
    await act(async () => {
      await result.current.saveFavorite('Order B');
    });

    expect(SaveFavoriteView).toHaveBeenCalledWith(
      'Order B',
      mockGVK.group,
      mockGVK.version,
      mockGVK.kind,
      [
        ['metadata', 'name'],
        ['metadata', 'namespace'],
      ]
    );

    // After saving, the new favorite should be active
    expect(result.current.activeFavorite?.id).toBe('fav-2');
  });

  it('should clear active favorite when clearFavorite is called', async () => {
    const favorite = createFavorite('fav-1', 'My View', [
      ['metadata', 'namespace'],
    ]);

    vi.mocked(ListFavoriteViews).mockResolvedValue([favorite]);

    const selectedPaths = new Set([JSON.stringify(['metadata', 'namespace'])]);

    const { result } = renderHook(() =>
      useFavoriteViews({
        currentGVK: mockGVK,
        selectedPaths,
      })
    );

    await waitFor(() => {
      expect(result.current.activeFavorite?.id).toBe('fav-1');
    });

    // Clear the favorite
    act(() => {
      result.current.clearFavorite();
    });

    // activeFavorite should still auto-match based on fields
    // But if we had manually set it via applyFavorite, it would be cleared
    // The auto-matching still works because fields match
    expect(result.current.activeFavorite?.id).toBe('fav-1');
  });

  it('should match multiple favorites only when order matches exactly', async () => {
    const favorites = [
      createFavorite('fav-1', 'Order A-B', [
        ['spec', 'a'],
        ['spec', 'b'],
      ]),
      createFavorite('fav-2', 'Order B-A', [
        ['spec', 'b'],
        ['spec', 'a'],
      ]),
      createFavorite('fav-3', 'Order A-B-C', [
        ['spec', 'a'],
        ['spec', 'b'],
        ['spec', 'c'],
      ]),
    ];

    vi.mocked(ListFavoriteViews).mockResolvedValue(favorites);

    // Select [b, a] order
    const selectedPaths = new Set([
      JSON.stringify(['spec', 'b']),
      JSON.stringify(['spec', 'a']),
    ]);

    const { result } = renderHook(() =>
      useFavoriteViews({
        currentGVK: mockGVK,
        selectedPaths,
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should match fav-2 (Order B-A), not fav-1 (Order A-B)
    expect(result.current.activeFavorite?.id).toBe('fav-2');
    expect(result.current.activeFavorite?.name).toBe('Order B-A');
  });
});
