import { useState, useCallback, useEffect, useMemo } from "react";
import { main } from "../../wailsjs/go/models";
import {
  ListFavoriteViews,
  SaveFavoriteView,
  DeleteFavoriteView,
  RenameFavoriteView,
} from "../../wailsjs/go/main/App";

interface GVK {
  group: string;
  version: string;
  kind: string;
}

function gvkMatches(a: GVK, b: GVK): boolean {
  return a.group === b.group && a.version === b.version && a.kind === b.kind;
}

function pathsEqual(a: string[][], b: string[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return false;
  }
  return true;
}

export interface UseFavoriteViewsOptions {
  currentGVK: GVK | null;
  selectedPaths: Set<string>;
}

export interface UseFavoriteViewsReturn {
  // Data
  allFavorites: main.FavoriteViewResponse[];
  currentGVKFavorites: main.FavoriteViewResponse[];
  activeFavorite: main.FavoriteViewResponse | null;

  // State
  isLoading: boolean;

  // Actions
  saveFavorite: (name: string) => Promise<main.FavoriteViewResponse>;
  applyFavorite: (id: string) => string[][] | null;
  clearFavorite: () => void;
  deleteFavorite: (id: string) => Promise<void>;
  renameFavorite: (id: string, newName: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFavoriteViews({
  currentGVK,
  selectedPaths,
}: UseFavoriteViewsOptions): UseFavoriteViewsReturn {
  const [allFavorites, setAllFavorites] = useState<main.FavoriteViewResponse[]>(
    []
  );
  const [activeFavoriteId, setActiveFavoriteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Convert selectedPaths to array of arrays
  const selectedPathsArray = useMemo(() => {
    return Array.from(selectedPaths).map((p) => JSON.parse(p) as string[]);
  }, [selectedPaths]);

  // Filter favorites for current GVK
  const currentGVKFavorites = useMemo(() => {
    if (!currentGVK) return [];
    return allFavorites.filter((f) =>
      gvkMatches(f.gvk, {
        group: currentGVK.group,
        version: currentGVK.version,
        kind: currentGVK.kind,
      })
    );
  }, [allFavorites, currentGVK]);

  // Determine active favorite based on current selection
  const activeFavorite = useMemo(() => {
    if (!currentGVK || selectedPathsArray.length === 0) return null;

    // First check if manually set active favorite still matches
    if (activeFavoriteId) {
      const manualActive = currentGVKFavorites.find(
        (f) => f.id === activeFavoriteId
      );
      if (manualActive && pathsEqual(manualActive.fields, selectedPathsArray)) {
        return manualActive;
      }
    }

    // Otherwise, find any matching favorite
    return (
      currentGVKFavorites.find((f) =>
        pathsEqual(f.fields, selectedPathsArray)
      ) || null
    );
  }, [currentGVKFavorites, selectedPathsArray, activeFavoriteId, currentGVK]);

  // Load all favorites on mount
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const views = await ListFavoriteViews();
      setAllFavorites(views || []);
    } catch (err) {
      console.error("Failed to load favorites:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Clear active favorite when GVK changes
  useEffect(() => {
    setActiveFavoriteId(null);
  }, [currentGVK?.group, currentGVK?.version, currentGVK?.kind]);

  // Save current selection as favorite
  const saveFavorite = useCallback(
    async (name: string) => {
      if (!currentGVK) {
        throw new Error("No GVK selected");
      }
      if (selectedPathsArray.length === 0) {
        throw new Error("No fields selected");
      }

      const view = await SaveFavoriteView(
        name,
        currentGVK.group,
        currentGVK.version,
        currentGVK.kind,
        selectedPathsArray
      );

      setAllFavorites((prev) => [...prev, view]);
      setActiveFavoriteId(view.id);
      return view;
    },
    [currentGVK, selectedPathsArray]
  );

  // Returns fields to apply (caller handles actual selection)
  const applyFavorite = useCallback(
    (id: string): string[][] | null => {
      const favorite = allFavorites.find((f) => f.id === id);
      if (!favorite) return null;

      setActiveFavoriteId(id);
      return favorite.fields;
    },
    [allFavorites]
  );

  const clearFavorite = useCallback(() => {
    setActiveFavoriteId(null);
  }, []);

  const deleteFavorite = useCallback(
    async (id: string) => {
      await DeleteFavoriteView(id);
      setAllFavorites((prev) => prev.filter((f) => f.id !== id));
      if (activeFavoriteId === id) {
        setActiveFavoriteId(null);
      }
    },
    [activeFavoriteId]
  );

  const renameFavorite = useCallback(async (id: string, newName: string) => {
    const updated = await RenameFavoriteView(id, newName);
    setAllFavorites((prev) => prev.map((f) => (f.id === id ? updated : f)));
  }, []);

  return {
    allFavorites,
    currentGVKFavorites,
    activeFavorite,
    isLoading,
    saveFavorite,
    applyFavorite,
    clearFavorite,
    deleteFavorite,
    renameFavorite,
    refresh,
  };
}
