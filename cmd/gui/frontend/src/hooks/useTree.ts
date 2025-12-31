import { useReducer, useEffect, useMemo, useCallback, useRef } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { GetNodeTree } from '../../wailsjs/go/main/App';
import { main } from '../../wailsjs/go/models';
import { useFuzzySearch } from './useFuzzySearch';
import type { ResourceEvent } from '../lib/resource-utils';

// Use null character as path delimiter to avoid conflicts with field names containing '/'
// (e.g., Kubernetes annotations like "karpenter.sh/node-hash-version")
export const PATH_DELIMITER = '\x00';

// Types
export interface TreeNode {
  name: string;
  type: string;
  fullPath: string[];
  level: number;
  children: TreeNode[];
}

// Focus trigger type to distinguish keyboard navigation from mouse hover
export type FocusTrigger = 'keyboard' | 'mouse' | 'search' | null;

interface TreeState {
  // Data
  nodeTree: TreeNode[];
  loading: boolean;

  // Search
  searchVisible: boolean;
  currentMatchIndex: number;
  debouncedQuery: string;

  // Expansion
  manualExpandedPaths: Set<string>;

  // Selection
  selectedPaths: Set<string>;

  // Keyboard navigation
  focusedPathKey: string | null;
  focusTrigger: FocusTrigger;
}

// Actions - includes future real-time update actions
type TreeAction =
  // Lifecycle
  | { type: 'RESET_FOR_GVK' }
  | { type: 'SET_NODE_TREE'; nodeTree: TreeNode[] }
  | { type: 'SET_LOADING'; loading: boolean }

  // Search
  | { type: 'TOGGLE_SEARCH' }
  | { type: 'CLOSE_SEARCH' }
  | { type: 'SET_DEBOUNCED_QUERY'; query: string }
  | { type: 'NAVIGATE_MATCH'; direction: 'next' | 'prev'; totalMatches: number }
  | { type: 'RESET_MATCH_INDEX' }

  // Expansion
  | { type: 'TOGGLE_EXPAND'; pathKey: string }
  | { type: 'EXPAND_PATHS'; pathKeys: string[] }

  // Selection
  | { type: 'TOGGLE_SELECT'; pathKey: string; parentPathKeys: string[] }
  | { type: 'TOGGLE_SELECT_WILDCARD'; wildcardPathKey: string; targetPathKeys: string[]; parentPathKeys: string[] }
  | { type: 'CLEAR_SELECTIONS' }
  | { type: 'SET_SELECTIONS'; paths: Set<string>; parentPathKeys: string[] }

  // Cleanup stale paths (from both selection and expansion)
  | { type: 'REMOVE_STALE_PATHS'; stalePaths: string[] }

  // Real-time tree structure updates (batched)
  // - additions: new array indices or map keys discovered from watch events
  // - removals: paths that no longer exist in any watched resource
  | { type: 'MERGE_TREE_NODES'; additions: { parentPathKey: string; node: TreeNode }[]; removals: string[] }

  // Keyboard navigation
  | { type: 'SET_FOCUSED_PATH'; pathKey: string | null; trigger: FocusTrigger };

// Initial state
const initialState: TreeState = {
  nodeTree: [],
  loading: true,
  searchVisible: false,
  currentMatchIndex: 0,
  debouncedQuery: '',
  manualExpandedPaths: new Set(),
  selectedPaths: new Set(),
  focusedPathKey: null,
  focusTrigger: null,
};

// Reducer
function treeReducer(state: TreeState, action: TreeAction): TreeState {
  switch (action.type) {
    case 'RESET_FOR_GVK':
      return {
        ...initialState,
        loading: true,
      };

    case 'SET_NODE_TREE':
      return {
        ...state,
        nodeTree: action.nodeTree,
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.loading,
      };

    case 'TOGGLE_SEARCH':
      return {
        ...state,
        searchVisible: !state.searchVisible,
      };

    case 'CLOSE_SEARCH':
      return {
        ...state,
        searchVisible: false,
        debouncedQuery: '',
        currentMatchIndex: 0,
      };

    case 'SET_DEBOUNCED_QUERY':
      return {
        ...state,
        debouncedQuery: action.query,
      };

    case 'NAVIGATE_MATCH': {
      if (action.totalMatches === 0) return state;
      const { currentMatchIndex } = state;
      let newIndex: number;
      if (action.direction === 'next') {
        newIndex = (currentMatchIndex + 1) % action.totalMatches;
      } else {
        newIndex = (currentMatchIndex - 1 + action.totalMatches) % action.totalMatches;
      }
      return {
        ...state,
        currentMatchIndex: newIndex,
      };
    }

    case 'RESET_MATCH_INDEX':
      return {
        ...state,
        currentMatchIndex: 0,
      };

    case 'TOGGLE_EXPAND': {
      const next = new Set(state.manualExpandedPaths);
      if (next.has(action.pathKey)) {
        next.delete(action.pathKey);
      } else {
        next.add(action.pathKey);
      }
      return {
        ...state,
        manualExpandedPaths: next,
      };
    }

    case 'EXPAND_PATHS': {
      const next = new Set(state.manualExpandedPaths);
      action.pathKeys.forEach((key) => next.add(key));
      return {
        ...state,
        manualExpandedPaths: next,
      };
    }

    case 'TOGGLE_SELECT': {
      const next = new Set(state.selectedPaths);
      const expanded = new Set(state.manualExpandedPaths);

      if (next.has(action.pathKey)) {
        next.delete(action.pathKey);
      } else {
        next.add(action.pathKey);
        // Auto-expand parent paths when selecting
        action.parentPathKeys.forEach((key) => expanded.add(key));
      }

      return {
        ...state,
        selectedPaths: next,
        manualExpandedPaths: expanded,
      };
    }

    case 'TOGGLE_SELECT_WILDCARD': {
      const next = new Set(state.selectedPaths);
      const expanded = new Set(state.manualExpandedPaths);

      // Check if all targets are selected
      const allSelected = action.targetPathKeys.every((key) => next.has(key));
      const toSelect = !allSelected;

      // Toggle all target paths
      action.targetPathKeys.forEach((key) => {
        if (toSelect) {
          next.add(key);
        } else {
          next.delete(key);
        }
      });

      // Toggle wildcard path for UI display
      if (toSelect) {
        next.add(action.wildcardPathKey);
        // Auto-expand parent paths
        action.parentPathKeys.forEach((key) => expanded.add(key));
      } else {
        next.delete(action.wildcardPathKey);
      }

      return {
        ...state,
        selectedPaths: next,
        manualExpandedPaths: expanded,
      };
    }

    case 'CLEAR_SELECTIONS':
      return {
        ...state,
        selectedPaths: new Set(),
      };

    case 'SET_SELECTIONS': {
      const expanded = new Set(state.manualExpandedPaths);
      action.parentPathKeys.forEach((key) => expanded.add(key));
      return {
        ...state,
        selectedPaths: action.paths,
        manualExpandedPaths: expanded,
      };
    }

    case 'REMOVE_STALE_PATHS': {
      if (action.stalePaths.length === 0) return state;

      const staleSet = new Set(action.stalePaths);

      // Helper to check if a path is stale or is a child of a stale path
      const isStaleOrChild = (pathKey: string): boolean => {
        if (staleSet.has(pathKey)) return true;
        // Check if any stale path is a prefix of this path
        for (const stalePath of action.stalePaths) {
          if (pathKey.startsWith(stalePath + PATH_DELIMITER)) return true;
        }
        return false;
      };

      // Clean up selectedPaths
      const newSelectedPaths = new Set<string>();
      state.selectedPaths.forEach((pathKey) => {
        // Skip wildcard paths (they're virtual) - they'll be handled separately
        if (pathKey.includes('*')) {
          // Keep wildcard if its base path still exists
          const basePath = pathKey.split(PATH_DELIMITER + '*')[0];
          if (!isStaleOrChild(basePath)) {
            newSelectedPaths.add(pathKey);
          }
        } else if (!isStaleOrChild(pathKey)) {
          newSelectedPaths.add(pathKey);
        }
      });

      // Clean up manualExpandedPaths
      const newExpandedPaths = new Set<string>();
      state.manualExpandedPaths.forEach((pathKey) => {
        if (!isStaleOrChild(pathKey)) {
          newExpandedPaths.add(pathKey);
        }
      });

      // Only return new state if something changed
      if (newSelectedPaths.size === state.selectedPaths.size &&
          newExpandedPaths.size === state.manualExpandedPaths.size) {
        return state;
      }

      return {
        ...state,
        selectedPaths: newSelectedPaths,
        manualExpandedPaths: newExpandedPaths,
      };
    }

    case 'MERGE_TREE_NODES': {
      // TODO: Implement tree merging when real-time updates feature is added
      // This action will:
      // 1. Add new nodes (array indices or map keys) to their parent nodes
      // 2. Remove nodes that no longer exist
      // 3. Clean up selectedPaths for removed nodes
      // 4. Clean up manualExpandedPaths for removed nodes
      //
      // For now, log and return unchanged state
      if (action.additions.length > 0 || action.removals.length > 0) {
        console.warn('MERGE_TREE_NODES: not yet implemented', {
          additions: action.additions.length,
          removals: action.removals.length,
        });
      }
      return state;
    }

    case 'SET_FOCUSED_PATH':
      return {
        ...state,
        focusedPathKey: action.pathKey,
        focusTrigger: action.trigger,
      };

    default:
      return state;
  }
}

// Helper: get parent path keys for a path
function getParentPathKeys(pathKey: string): string[] {
  const pathParts = pathKey.split(PATH_DELIMITER);
  const parents: string[] = [];
  for (let i = 1; i < pathParts.length; i++) {
    parents.push(pathParts.slice(0, i).join(PATH_DELIMITER));
  }
  return parents;
}

// Helper: flatten tree to Map
function flattenTree(nodes: TreeNode[]): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>();
  const flatten = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      const pathKey = node.fullPath.join(PATH_DELIMITER);
      map.set(pathKey, node);
      if (node.children && node.children.length > 0) {
        flatten(node.children);
      }
    }
  };
  flatten(nodes);
  return map;
}

// Searchable item type for fuzzy search
interface SearchableItem {
  text: string;
  pathKey: string;
  node: TreeNode;
  index: number;
}

// Hook interface
export interface UseTreeOptions {
  selectedGVK: main.MultiClusterGVK | null;
  connectedContexts: string[];
  onFieldsSelected?: (fields: string[][]) => void;
  onReady?: () => void;
  /** Enable real-time tree updates via watch events (default: false) */
  watch?: boolean;
  /** Debounce interval for tree refresh on watch events (default: 100ms) */
  watchDebounceMs?: number;
}

export function useTree({
  selectedGVK,
  connectedContexts,
  onFieldsSelected,
  onReady,
  watch = false,
  watchDebounceMs = 100,
}: UseTreeOptions) {
  const [state, dispatch] = useReducer(treeReducer, initialState);
  const {
    nodeTree,
    loading,
    searchVisible,
    currentMatchIndex,
    debouncedQuery,
    manualExpandedPaths,
    selectedPaths,
    focusedPathKey,
    focusTrigger,
  } = state;

  // Use ref for stable callback access
  const searchVisibleRef = useRef(searchVisible);
  searchVisibleRef.current = searchVisible;

  // Track last keyboard navigation time to ignore mouse hover during scroll
  const lastKeyboardNavTimeRef = useRef<number>(0);

  // Track previous flatNodesMap to detect actual tree changes (not selection changes)
  const prevFlatNodesMapRef = useRef<Map<string, TreeNode> | null>(null);

  // Store state refs for useEffect that only depends on flatNodesMap
  const selectedPathsRef = useRef(selectedPaths);
  selectedPathsRef.current = selectedPaths;
  const manualExpandedPathsRef = useRef(manualExpandedPaths);
  manualExpandedPathsRef.current = manualExpandedPaths;

  // Store callbacks in refs to avoid stale closures
  const onFieldsSelectedRef = useRef(onFieldsSelected);
  onFieldsSelectedRef.current = onFieldsSelected;

  // Reset state when GVK changes
  useEffect(() => {
    dispatch({ type: 'RESET_FOR_GVK' });
  }, [selectedGVK]);

  // Fetch node tree function (extracted for reuse)
  // silent: when true, skip loading state (for background watch refreshes)
  const fetchNodeTree = useCallback((silent = false) => {
    if (!selectedGVK || connectedContexts.length === 0) {
      dispatch({ type: 'SET_NODE_TREE', nodeTree: [] });
      if (!silent) dispatch({ type: 'SET_LOADING', loading: false });
      return;
    }

    if (!silent) dispatch({ type: 'SET_LOADING', loading: true });
    GetNodeTree(selectedGVK, connectedContexts)
      .then((nodes) => {
        dispatch({ type: 'SET_NODE_TREE', nodeTree: nodes || [] });
        if (!silent) dispatch({ type: 'SET_LOADING', loading: false });
      })
      .catch((error) => {
        console.error('Failed to load node tree:', error);
        dispatch({ type: 'SET_NODE_TREE', nodeTree: [] });
        if (!silent) dispatch({ type: 'SET_LOADING', loading: false });
      });
  }, [selectedGVK, connectedContexts]);

  // Initial fetch
  useEffect(() => {
    fetchNodeTree();
  }, [fetchNodeTree]);

  // Watch subscription for real-time tree updates
  useEffect(() => {
    if (!watch || !selectedGVK || connectedContexts.length === 0) {
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingRefresh = false;

    const handleEvent = (_event: ResourceEvent) => {
      // Refresh tree on any event type:
      // - ADDED/MODIFIED: may add new keys/indices to tree
      // - DELETED: may remove nodes if field only existed in deleted resource
      pendingRefresh = true;

      // Debounce: wait for events to settle before refreshing
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        if (pendingRefresh) {
          console.log('useTree: refreshing tree due to watch events');
          fetchNodeTree(true);  // silent refresh - no loading indicator
          pendingRefresh = false;
        }
      }, watchDebounceMs);
    };

    const unsubscribe = EventsOn('resource:update', handleEvent);

    return () => {
      unsubscribe();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [watch, selectedGVK, connectedContexts, watchDebounceMs, fetchNodeTree]);

  // Notify parent when loading completes
  useEffect(() => {
    if (!loading && nodeTree.length > 0 && onReady) {
      onReady();
    }
  }, [loading, nodeTree.length, onReady]);

  // Flatten tree for search - create a Map for O(1) lookup
  const flatNodesMap = useMemo(() => flattenTree(nodeTree), [nodeTree]);

  // Prepare searchable items with index tracking
  const searchableItems = useMemo(() => {
    const items: SearchableItem[] = [];
    let index = 0;
    flatNodesMap.forEach((node, pathKey) => {
      items.push({
        text: `${node.name} ${node.type}`,
        pathKey,
        node,
        index: index++,
      });
    });
    return items;
  }, [flatNodesMap]);

  // Use fuzzy search hook
  const { query, setQuery, results: allSearchResults } = useFuzzySearch<SearchableItem>(
    searchableItems,
    (item) => item.text,
    0.3
  );

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({ type: 'SET_DEBOUNCED_QUERY', query });
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  // Limit search results to prevent performance issues
  const MAX_RESULTS = 200;
  const searchResults = useMemo(() => {
    if (!debouncedQuery) {
      return allSearchResults;
    }
    return allSearchResults.slice(0, MAX_RESULTS);
  }, [allSearchResults, debouncedQuery]);

  const hasMoreResults = Boolean(debouncedQuery) && allSearchResults.length > MAX_RESULTS;

  // Get all matched paths sorted by tree order
  const matchedPaths = useMemo(() => {
    return [...searchResults]
      .sort((a, b) => a.item.index - b.item.index)
      .map((result) => result.item.pathKey);
  }, [searchResults]);

  // Create a Map of search results for O(1) lookup (for highlighting)
  const searchResultsMap = useMemo(() => {
    const map = new Map<string, readonly [number, number][] | null>();
    searchResults.forEach((result) => {
      const nameLength = result.item.node.name.length;
      const filteredIndices = result.indices
        .filter(([start]) => start < nameLength)
        .map(([start, end]): [number, number] => [start, Math.min(end, nameLength - 1)]);
      map.set(result.item.pathKey, filteredIndices.length > 0 ? filteredIndices : null);
    });
    return map;
  }, [searchResults]);

  // Reset match index when search results change
  useEffect(() => {
    dispatch({ type: 'RESET_MATCH_INDEX' });
  }, [matchedPaths.length]);

  // Compute parent paths of selected fields (to auto-expand)
  const selectedParentPaths = useMemo(() => {
    const paths = new Set<string>();
    selectedPaths.forEach((pathKey) => {
      getParentPathKeys(pathKey).forEach((p) => paths.add(p));
    });
    return paths;
  }, [selectedPaths]);

  // Compute paths to expand based on search results
  const searchExpandedPaths = useMemo(() => {
    if (!debouncedQuery || matchedPaths.length === 0) {
      return new Set<string>();
    }
    const paths = new Set<string>();
    matchedPaths.forEach((pathKey) => {
      getParentPathKeys(pathKey).forEach((p) => paths.add(p));
    });
    return paths;
  }, [debouncedQuery, matchedPaths]);

  // Final expanded paths = manual + search + selected parents
  const expandedPaths = useMemo(() => {
    const paths = new Set<string>(manualExpandedPaths);
    if (debouncedQuery) {
      searchExpandedPaths.forEach((path) => paths.add(path));
    }
    selectedParentPaths.forEach((path) => paths.add(path));
    return paths;
  }, [manualExpandedPaths, debouncedQuery, searchExpandedPaths, selectedParentPaths]);

  // Filter tree to only show matched nodes and their parents when searching
  const filteredNodeTree = useMemo(() => {
    if (!debouncedQuery || matchedPaths.length === 0) {
      return nodeTree;
    }

    const pathsToShow = new Set<string>();
    matchedPaths.forEach((pathKey) => {
      const pathParts = pathKey.split(PATH_DELIMITER);
      for (let i = 1; i <= pathParts.length; i++) {
        pathsToShow.add(pathParts.slice(0, i).join(PATH_DELIMITER));
      }
    });

    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .filter((node) => pathsToShow.has(node.fullPath.join(PATH_DELIMITER)))
        .map((node) => ({
          ...node,
          children: node.children ? filterNodes(node.children) : [],
        }));
    };

    return filterNodes(nodeTree);
  }, [debouncedQuery, matchedPaths, nodeTree]);

  // Actions
  const toggleExpand = useCallback((path: string[]) => {
    dispatch({ type: 'TOGGLE_EXPAND', pathKey: path.join(PATH_DELIMITER) });
  }, []);

  const toggleSelect = useCallback((path: string[]) => {
    const pathKey = path.join(PATH_DELIMITER);
    const wildcardIndex = path.findIndex((p) => p === '*');

    if (wildcardIndex === -1) {
      // No wildcard, handle normally
      dispatch({
        type: 'TOGGLE_SELECT',
        pathKey,
        parentPathKeys: getParentPathKeys(pathKey),
      });
      // Parent is notified via the onFieldsSelected useEffect (line 681)
    } else {
      // Wildcard found - toggle all index nodes
      const arrayPath = path.slice(0, wildcardIndex);
      const pathAfterWildcard = path.slice(wildcardIndex + 1);
      const arrayPathKey = arrayPath.join(PATH_DELIMITER);
      const arrayNode = flatNodesMap.get(arrayPathKey);

      if (!arrayNode || !arrayNode.children) {
        return;
      }

      // Find all index nodes (numeric children)
      const indexNodes = arrayNode.children.filter((child) => {
        return child.name !== '*' && !isNaN(Number(child.name));
      });

      const targetPathKeys = indexNodes.map((indexNode) => {
        const targetPath = [...arrayPath, indexNode.name, ...pathAfterWildcard];
        return targetPath.join(PATH_DELIMITER);
      });

      // Collect all parent paths for expansion
      const parentPathKeys: string[] = [];
      targetPathKeys.forEach((key) => {
        getParentPathKeys(key).forEach((p) => {
          if (!parentPathKeys.includes(p)) {
            parentPathKeys.push(p);
          }
        });
      });

      dispatch({
        type: 'TOGGLE_SELECT_WILDCARD',
        wildcardPathKey: pathKey,
        targetPathKeys,
        parentPathKeys,
      });
    }
  }, [flatNodesMap]);

  // Effect to notify parent when selections change
  useEffect(() => {
    if (onFieldsSelectedRef.current) {
      const selectedFields = Array.from(selectedPaths)
        .filter((p) => !p.includes('*'))
        .map((p) => p.split(PATH_DELIMITER));
      onFieldsSelectedRef.current(selectedFields);
    }
  }, [selectedPaths]);

  // Cleanup stale paths when tree changes (e.g., field removed from all resources)
  // This handles both selectedPaths and manualExpandedPaths
  // IMPORTANT: Only run when flatNodesMap actually changes (tree refresh), not on selection changes
  useEffect(() => {
    // Skip if tree hasn't actually changed (prevents removing just-selected paths)
    if (prevFlatNodesMapRef.current === flatNodesMap) {
      return;
    }
    prevFlatNodesMapRef.current = flatNodesMap;

    // Use refs to get current values without triggering on their changes
    const currentSelectedPaths = selectedPathsRef.current;
    const currentExpandedPaths = manualExpandedPathsRef.current;

    if (flatNodesMap.size === 0) return;
    if (currentSelectedPaths.size === 0 && currentExpandedPaths.size === 0) return;

    const stalePaths: string[] = [];

    // Check selectedPaths for stale entries
    currentSelectedPaths.forEach((pathKey) => {
      // Skip wildcard paths (they're virtual)
      if (pathKey.includes('*')) return;
      if (!flatNodesMap.has(pathKey)) {
        stalePaths.push(pathKey);
      }
    });

    // Check manualExpandedPaths for stale entries
    currentExpandedPaths.forEach((pathKey) => {
      if (!flatNodesMap.has(pathKey) && !stalePaths.includes(pathKey)) {
        stalePaths.push(pathKey);
      }
    });

    if (stalePaths.length > 0) {
      console.log('useTree: removing stale paths:', stalePaths);
      dispatch({ type: 'REMOVE_STALE_PATHS', stalePaths });
    }
  }, [flatNodesMap]);

  const clearAllSelections = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTIONS' });
  }, []);

  const setSelectionsFromPaths = useCallback((paths: Set<string>) => {
    const parentPathKeys: string[] = [];
    paths.forEach((pathKey) => {
      getParentPathKeys(pathKey).forEach((p) => {
        if (!parentPathKeys.includes(p)) {
          parentPathKeys.push(p);
        }
      });
    });
    dispatch({ type: 'SET_SELECTIONS', paths, parentPathKeys });
  }, []);

  // Get visible nodes in display order (considering expansion)
  const getVisibleNodes = useCallback((): string[] => {
    const visible: string[] = [];
    const traverse = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        const pathKey = node.fullPath.join(PATH_DELIMITER);
        visible.push(pathKey);
        // Only traverse children if this node is expanded
        if (node.children && node.children.length > 0 && expandedPaths.has(pathKey)) {
          traverse(node.children);
        }
      }
    };
    traverse(filteredNodeTree);
    return visible;
  }, [filteredNodeTree, expandedPaths]);

  // Keyboard navigation
  // Note: setFocusedPath with 'mouse' trigger won't cause auto-scroll
  // Also ignores mouse hover shortly after keyboard navigation to prevent scroll interference
  const setFocusedPath = useCallback((pathKey: string | null) => {
    // Ignore mouse hover within 300ms of keyboard navigation
    // This prevents scrollIntoView from triggering unwanted focus changes
    const timeSinceKeyboardNav = Date.now() - lastKeyboardNavTimeRef.current;
    if (timeSinceKeyboardNav < 300) {
      return;
    }
    dispatch({ type: 'SET_FOCUSED_PATH', pathKey, trigger: 'mouse' });
  }, []);

  const navigateFocus = useCallback((direction: 'up' | 'down') => {
    const visibleNodes = getVisibleNodes();
    if (visibleNodes.length === 0) return;

    const currentIndex = focusedPathKey ? visibleNodes.indexOf(focusedPathKey) : -1;
    let newIndex: number;

    if (direction === 'down') {
      newIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, visibleNodes.length - 1);
    } else {
      newIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
    }

    // Record keyboard navigation time to ignore mouse hover during scroll
    lastKeyboardNavTimeRef.current = Date.now();

    // Use 'keyboard' trigger to enable auto-scroll
    dispatch({ type: 'SET_FOCUSED_PATH', pathKey: visibleNodes[newIndex], trigger: 'keyboard' });
  }, [focusedPathKey, getVisibleNodes]);

  const toggleFocused = useCallback(() => {
    if (!focusedPathKey) return;

    const node = flatNodesMap.get(focusedPathKey);
    if (!node) return;

    const hasChildren = node.children && node.children.length > 0;
    const isArrayOrMap = node.type && (node.type.startsWith('[]') || node.type.startsWith('map['));
    const isLeaf = !hasChildren && !isArrayOrMap;

    if (isLeaf) {
      // Toggle selection for leaf nodes
      toggleSelect(node.fullPath);
    } else {
      // Toggle expansion for parent nodes
      toggleExpand(node.fullPath);
    }
  }, [focusedPathKey, flatNodesMap, toggleSelect, toggleExpand]);

  const toggleSearch = useCallback(() => {
    if (searchVisibleRef.current) {
      dispatch({ type: 'CLOSE_SEARCH' });
      setQuery('');
    } else {
      dispatch({ type: 'TOGGLE_SEARCH' });
    }
  }, [setQuery]);

  const closeSearch = useCallback(() => {
    dispatch({ type: 'CLOSE_SEARCH' });
    setQuery('');
  }, [setQuery]);

  const navigateMatches = useCallback((direction: 'next' | 'prev') => {
    dispatch({ type: 'NAVIGATE_MATCH', direction, totalMatches: matchedPaths.length });
  }, [matchedPaths.length]);

  // Keyboard shortcuts (when search is visible)
  // Note: Cmd+F is handled by MainView.tsx for panel-aware focus
  useEffect(() => {
    if (!searchVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc: Close search
      if (e.key === 'Escape') {
        closeSearch();
        return;
      }

      // Enter: Next match, Shift+Enter: Previous match
      if (e.key === 'Enter' && query) {
        e.preventDefault();
        navigateMatches(e.shiftKey ? 'prev' : 'next');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchVisible, query, navigateMatches, closeSearch]);

  // Ensure currentMatchIndex is always valid (handles race between matchedPaths shrinking and RESET_MATCH_INDEX effect)
  const boundedMatchIndex = matchedPaths.length > 0
    ? Math.min(currentMatchIndex, matchedPaths.length - 1)
    : 0;

  return {
    // State
    nodeTree,
    loading,
    flatNodesMap,

    // Search
    query,
    setQuery,
    searchVisible,
    toggleSearch,
    closeSearch,
    matchedPaths,
    searchResultsMap,
    currentMatchIndex: boundedMatchIndex,
    navigateMatches,
    hasMoreResults,
    debouncedQuery,

    // Expansion
    expandedPaths,
    toggleExpand,

    // Selection
    selectedPaths,
    toggleSelect,
    clearAllSelections,
    setSelectionsFromPaths,

    // Keyboard navigation
    focusedPathKey,
    focusTrigger,
    setFocusedPath,
    navigateFocus,
    toggleFocused,

    // Filtered view
    filteredNodeTree,
  };
}
