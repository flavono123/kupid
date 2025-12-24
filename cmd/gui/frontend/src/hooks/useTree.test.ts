import { describe, it, expect } from 'vitest';
import { PATH_DELIMITER } from './useTree';

// Extract and test the reducer logic
// We'll import the types and create a minimal reducer test

interface TreeState {
  nodeTree: TreeNode[];
  loading: boolean;
  searchVisible: boolean;
  currentMatchIndex: number;
  debouncedQuery: string;
  manualExpandedPaths: Set<string>;
  selectedPaths: Set<string>;
}

interface TreeNode {
  name: string;
  type: string;
  fullPath: string[];
  level: number;
  children: TreeNode[];
}

type TreeAction =
  | { type: 'RESET_FOR_GVK' }
  | { type: 'SET_NODE_TREE'; nodeTree: TreeNode[] }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'TOGGLE_SEARCH' }
  | { type: 'CLOSE_SEARCH' }
  | { type: 'SET_DEBOUNCED_QUERY'; query: string }
  | { type: 'NAVIGATE_MATCH'; direction: 'next' | 'prev'; totalMatches: number }
  | { type: 'RESET_MATCH_INDEX' }
  | { type: 'TOGGLE_EXPAND'; pathKey: string }
  | { type: 'EXPAND_PATHS'; pathKeys: string[] }
  | { type: 'TOGGLE_SELECT'; pathKey: string; parentPathKeys: string[] }
  | { type: 'TOGGLE_SELECT_WILDCARD'; wildcardPathKey: string; targetPathKeys: string[]; parentPathKeys: string[] }
  | { type: 'CLEAR_SELECTIONS' }
  | { type: 'SET_SELECTIONS'; paths: Set<string>; parentPathKeys: string[] }
  | { type: 'REMOVE_STALE_PATHS'; stalePaths: string[] }
  | { type: 'MERGE_TREE_NODES'; additions: { parentPathKey: string; node: TreeNode }[]; removals: string[] };

const initialState: TreeState = {
  nodeTree: [],
  loading: true,
  searchVisible: false,
  currentMatchIndex: 0,
  debouncedQuery: '',
  manualExpandedPaths: new Set(),
  selectedPaths: new Set(),
};

// Replicate the reducer logic for testing
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

      const allSelected = action.targetPathKeys.every((key) => next.has(key));
      const toSelect = !allSelected;

      action.targetPathKeys.forEach((key) => {
        if (toSelect) {
          next.add(key);
        } else {
          next.delete(key);
        }
      });

      if (toSelect) {
        next.add(action.wildcardPathKey);
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
      // For now, return unchanged state (placeholder)
      return state;
    }

    default:
      return state;
  }
}

describe('useTree reducer', () => {
  describe('RESET_FOR_GVK', () => {
    it('should reset all state to initial values', () => {
      const state: TreeState = {
        nodeTree: [{ name: 'test', type: 'string', fullPath: ['test'], level: 0, children: [] }],
        loading: false,
        searchVisible: true,
        currentMatchIndex: 5,
        debouncedQuery: 'test',
        manualExpandedPaths: new Set(['path1', 'path2']),
        selectedPaths: new Set(['selected1']),
      };

      const result = treeReducer(state, { type: 'RESET_FOR_GVK' });

      expect(result.nodeTree).toEqual([]);
      expect(result.loading).toBe(true);
      expect(result.searchVisible).toBe(false);
      expect(result.currentMatchIndex).toBe(0);
      expect(result.debouncedQuery).toBe('');
      expect(result.manualExpandedPaths.size).toBe(0);
      expect(result.selectedPaths.size).toBe(0);
    });
  });

  describe('Search actions', () => {
    it('TOGGLE_SEARCH should toggle searchVisible', () => {
      let state = { ...initialState, searchVisible: false };
      state = treeReducer(state, { type: 'TOGGLE_SEARCH' });
      expect(state.searchVisible).toBe(true);

      state = treeReducer(state, { type: 'TOGGLE_SEARCH' });
      expect(state.searchVisible).toBe(false);
    });

    it('CLOSE_SEARCH should close search and reset related state', () => {
      const state: TreeState = {
        ...initialState,
        searchVisible: true,
        debouncedQuery: 'test',
        currentMatchIndex: 3,
      };

      const result = treeReducer(state, { type: 'CLOSE_SEARCH' });

      expect(result.searchVisible).toBe(false);
      expect(result.debouncedQuery).toBe('');
      expect(result.currentMatchIndex).toBe(0);
    });

    it('NAVIGATE_MATCH should cycle through matches (next)', () => {
      const state = { ...initialState, currentMatchIndex: 0 };

      let result = treeReducer(state, { type: 'NAVIGATE_MATCH', direction: 'next', totalMatches: 5 });
      expect(result.currentMatchIndex).toBe(1);

      result = treeReducer({ ...state, currentMatchIndex: 4 }, { type: 'NAVIGATE_MATCH', direction: 'next', totalMatches: 5 });
      expect(result.currentMatchIndex).toBe(0); // Wraps around
    });

    it('NAVIGATE_MATCH should cycle through matches (prev)', () => {
      const state = { ...initialState, currentMatchIndex: 2 };

      let result = treeReducer(state, { type: 'NAVIGATE_MATCH', direction: 'prev', totalMatches: 5 });
      expect(result.currentMatchIndex).toBe(1);

      result = treeReducer({ ...state, currentMatchIndex: 0 }, { type: 'NAVIGATE_MATCH', direction: 'prev', totalMatches: 5 });
      expect(result.currentMatchIndex).toBe(4); // Wraps around
    });

    it('NAVIGATE_MATCH should do nothing when totalMatches is 0', () => {
      const state = { ...initialState, currentMatchIndex: 0 };
      const result = treeReducer(state, { type: 'NAVIGATE_MATCH', direction: 'next', totalMatches: 0 });
      expect(result).toBe(state); // Same reference, no change
    });
  });

  describe('Expansion actions', () => {
    it('TOGGLE_EXPAND should add path when not expanded', () => {
      const state = { ...initialState, manualExpandedPaths: new Set<string>() };
      const pathKey = ['metadata'].join(PATH_DELIMITER);

      const result = treeReducer(state, { type: 'TOGGLE_EXPAND', pathKey });

      expect(result.manualExpandedPaths.has(pathKey)).toBe(true);
    });

    it('TOGGLE_EXPAND should remove path when already expanded', () => {
      const pathKey = ['metadata'].join(PATH_DELIMITER);
      const state = { ...initialState, manualExpandedPaths: new Set([pathKey]) };

      const result = treeReducer(state, { type: 'TOGGLE_EXPAND', pathKey });

      expect(result.manualExpandedPaths.has(pathKey)).toBe(false);
    });

    it('EXPAND_PATHS should add multiple paths', () => {
      const state = { ...initialState, manualExpandedPaths: new Set(['existing']) };
      const pathKeys = ['path1', 'path2', 'path3'];

      const result = treeReducer(state, { type: 'EXPAND_PATHS', pathKeys });

      expect(result.manualExpandedPaths.has('existing')).toBe(true);
      expect(result.manualExpandedPaths.has('path1')).toBe(true);
      expect(result.manualExpandedPaths.has('path2')).toBe(true);
      expect(result.manualExpandedPaths.has('path3')).toBe(true);
    });
  });

  describe('Selection actions', () => {
    it('TOGGLE_SELECT should add selection and expand parents', () => {
      const state = { ...initialState };
      const pathKey = ['metadata', 'name'].join(PATH_DELIMITER);
      const parentPathKeys = [['metadata'].join(PATH_DELIMITER)];

      const result = treeReducer(state, { type: 'TOGGLE_SELECT', pathKey, parentPathKeys });

      expect(result.selectedPaths.has(pathKey)).toBe(true);
      expect(result.manualExpandedPaths.has(parentPathKeys[0])).toBe(true);
    });

    it('TOGGLE_SELECT should remove selection (not collapse parents)', () => {
      const pathKey = ['metadata', 'name'].join(PATH_DELIMITER);
      const parentPathKey = ['metadata'].join(PATH_DELIMITER);
      const state = {
        ...initialState,
        selectedPaths: new Set([pathKey]),
        manualExpandedPaths: new Set([parentPathKey]),
      };

      const result = treeReducer(state, { type: 'TOGGLE_SELECT', pathKey, parentPathKeys: [parentPathKey] });

      expect(result.selectedPaths.has(pathKey)).toBe(false);
      // Parents should remain expanded
      expect(result.manualExpandedPaths.has(parentPathKey)).toBe(true);
    });

    it('TOGGLE_SELECT_WILDCARD should select all target paths when none selected', () => {
      const state = { ...initialState };
      const wildcardPathKey = ['spec', 'containers', '*', 'name'].join(PATH_DELIMITER);
      const targetPathKeys = [
        ['spec', 'containers', '0', 'name'].join(PATH_DELIMITER),
        ['spec', 'containers', '1', 'name'].join(PATH_DELIMITER),
      ];
      const parentPathKeys = [
        ['spec'].join(PATH_DELIMITER),
        ['spec', 'containers'].join(PATH_DELIMITER),
        ['spec', 'containers', '0'].join(PATH_DELIMITER),
        ['spec', 'containers', '1'].join(PATH_DELIMITER),
      ];

      const result = treeReducer(state, {
        type: 'TOGGLE_SELECT_WILDCARD',
        wildcardPathKey,
        targetPathKeys,
        parentPathKeys,
      });

      // All targets should be selected
      expect(result.selectedPaths.has(targetPathKeys[0])).toBe(true);
      expect(result.selectedPaths.has(targetPathKeys[1])).toBe(true);
      // Wildcard path should also be selected (for UI display)
      expect(result.selectedPaths.has(wildcardPathKey)).toBe(true);
      // Parents should be expanded
      parentPathKeys.forEach((key) => {
        expect(result.manualExpandedPaths.has(key)).toBe(true);
      });
    });

    it('TOGGLE_SELECT_WILDCARD should deselect all when all are selected', () => {
      const wildcardPathKey = ['spec', 'containers', '*', 'name'].join(PATH_DELIMITER);
      const targetPathKeys = [
        ['spec', 'containers', '0', 'name'].join(PATH_DELIMITER),
        ['spec', 'containers', '1', 'name'].join(PATH_DELIMITER),
      ];
      const state = {
        ...initialState,
        selectedPaths: new Set([...targetPathKeys, wildcardPathKey]),
      };

      const result = treeReducer(state, {
        type: 'TOGGLE_SELECT_WILDCARD',
        wildcardPathKey,
        targetPathKeys,
        parentPathKeys: [],
      });

      // All should be deselected
      expect(result.selectedPaths.has(targetPathKeys[0])).toBe(false);
      expect(result.selectedPaths.has(targetPathKeys[1])).toBe(false);
      expect(result.selectedPaths.has(wildcardPathKey)).toBe(false);
    });

    it('TOGGLE_SELECT_WILDCARD should select all when only some are selected', () => {
      const wildcardPathKey = ['spec', 'containers', '*', 'name'].join(PATH_DELIMITER);
      const targetPathKeys = [
        ['spec', 'containers', '0', 'name'].join(PATH_DELIMITER),
        ['spec', 'containers', '1', 'name'].join(PATH_DELIMITER),
      ];
      // Only first target is selected
      const state = {
        ...initialState,
        selectedPaths: new Set([targetPathKeys[0]]),
      };

      const result = treeReducer(state, {
        type: 'TOGGLE_SELECT_WILDCARD',
        wildcardPathKey,
        targetPathKeys,
        parentPathKeys: [],
      });

      // All should be selected now
      expect(result.selectedPaths.has(targetPathKeys[0])).toBe(true);
      expect(result.selectedPaths.has(targetPathKeys[1])).toBe(true);
      expect(result.selectedPaths.has(wildcardPathKey)).toBe(true);
    });

    it('CLEAR_SELECTIONS should remove all selections', () => {
      const state = {
        ...initialState,
        selectedPaths: new Set(['path1', 'path2', 'path3']),
      };

      const result = treeReducer(state, { type: 'CLEAR_SELECTIONS' });

      expect(result.selectedPaths.size).toBe(0);
    });

    it('SET_SELECTIONS should replace selections and expand parents', () => {
      const state = {
        ...initialState,
        selectedPaths: new Set(['old1', 'old2']),
      };
      const newPaths = new Set(['new1', 'new2']);
      const parentPathKeys = ['parent1', 'parent2'];

      const result = treeReducer(state, { type: 'SET_SELECTIONS', paths: newPaths, parentPathKeys });

      expect(result.selectedPaths).toBe(newPaths);
      expect(result.selectedPaths.has('old1')).toBe(false);
      expect(result.selectedPaths.has('new1')).toBe(true);
      expect(result.manualExpandedPaths.has('parent1')).toBe(true);
      expect(result.manualExpandedPaths.has('parent2')).toBe(true);
    });
  });

  describe('REMOVE_STALE_PATHS (edge case handling)', () => {
    it('should remove stale paths from selectedPaths', () => {
      const state = {
        ...initialState,
        selectedPaths: new Set([
          ['metadata', 'name'].join(PATH_DELIMITER),
          ['metadata', 'labels', 'app'].join(PATH_DELIMITER),  // will be stale
          ['spec', 'replicas'].join(PATH_DELIMITER),
        ]),
      };

      const result = treeReducer(state, {
        type: 'REMOVE_STALE_PATHS',
        stalePaths: [['metadata', 'labels', 'app'].join(PATH_DELIMITER)],
      });

      expect(result.selectedPaths.has(['metadata', 'name'].join(PATH_DELIMITER))).toBe(true);
      expect(result.selectedPaths.has(['metadata', 'labels', 'app'].join(PATH_DELIMITER))).toBe(false);
      expect(result.selectedPaths.has(['spec', 'replicas'].join(PATH_DELIMITER))).toBe(true);
    });

    it('should remove stale paths from manualExpandedPaths', () => {
      const state = {
        ...initialState,
        manualExpandedPaths: new Set([
          ['metadata'].join(PATH_DELIMITER),
          ['metadata', 'labels'].join(PATH_DELIMITER),  // will be stale
          ['spec'].join(PATH_DELIMITER),
        ]),
      };

      const result = treeReducer(state, {
        type: 'REMOVE_STALE_PATHS',
        stalePaths: [['metadata', 'labels'].join(PATH_DELIMITER)],
      });

      expect(result.manualExpandedPaths.has(['metadata'].join(PATH_DELIMITER))).toBe(true);
      expect(result.manualExpandedPaths.has(['metadata', 'labels'].join(PATH_DELIMITER))).toBe(false);
      expect(result.manualExpandedPaths.has(['spec'].join(PATH_DELIMITER))).toBe(true);
    });

    it('should also remove child paths when parent is stale', () => {
      const state = {
        ...initialState,
        selectedPaths: new Set([
          ['metadata', 'labels'].join(PATH_DELIMITER),
          ['metadata', 'labels', 'app'].join(PATH_DELIMITER),  // child of stale
          ['metadata', 'labels', 'env'].join(PATH_DELIMITER),  // child of stale
        ]),
        manualExpandedPaths: new Set([
          ['metadata'].join(PATH_DELIMITER),
          ['metadata', 'labels'].join(PATH_DELIMITER),
        ]),
      };

      const result = treeReducer(state, {
        type: 'REMOVE_STALE_PATHS',
        stalePaths: [['metadata', 'labels'].join(PATH_DELIMITER)],
      });

      // Parent removed
      expect(result.selectedPaths.has(['metadata', 'labels'].join(PATH_DELIMITER))).toBe(false);
      // Children also removed
      expect(result.selectedPaths.has(['metadata', 'labels', 'app'].join(PATH_DELIMITER))).toBe(false);
      expect(result.selectedPaths.has(['metadata', 'labels', 'env'].join(PATH_DELIMITER))).toBe(false);
      // Expanded paths cleaned up too
      expect(result.manualExpandedPaths.has(['metadata', 'labels'].join(PATH_DELIMITER))).toBe(false);
      // Parent of stale path should remain
      expect(result.manualExpandedPaths.has(['metadata'].join(PATH_DELIMITER))).toBe(true);
    });

    it('should handle wildcard paths correctly', () => {
      const state = {
        ...initialState,
        selectedPaths: new Set([
          ['spec', 'containers', '*', 'name'].join(PATH_DELIMITER),  // wildcard path
          ['spec', 'containers', '0', 'name'].join(PATH_DELIMITER),
          ['spec', 'containers', '1', 'name'].join(PATH_DELIMITER),
        ]),
      };

      // Remove spec.containers (base of the wildcard)
      const result = treeReducer(state, {
        type: 'REMOVE_STALE_PATHS',
        stalePaths: [['spec', 'containers'].join(PATH_DELIMITER)],
      });

      // Wildcard path should be removed because its base is stale
      expect(result.selectedPaths.has(['spec', 'containers', '*', 'name'].join(PATH_DELIMITER))).toBe(false);
      // Children are also removed
      expect(result.selectedPaths.has(['spec', 'containers', '0', 'name'].join(PATH_DELIMITER))).toBe(false);
      expect(result.selectedPaths.has(['spec', 'containers', '1', 'name'].join(PATH_DELIMITER))).toBe(false);
    });

    it('should return same state reference when no paths are stale', () => {
      const state = {
        ...initialState,
        selectedPaths: new Set([['metadata', 'name'].join(PATH_DELIMITER)]),
        manualExpandedPaths: new Set([['metadata'].join(PATH_DELIMITER)]),
      };

      const result = treeReducer(state, {
        type: 'REMOVE_STALE_PATHS',
        stalePaths: [['nonexistent', 'path'].join(PATH_DELIMITER)],
      });

      // Same state reference when nothing changed
      expect(result).toBe(state);
    });

    it('should return same state reference when stalePaths is empty', () => {
      const state = {
        ...initialState,
        selectedPaths: new Set([['metadata', 'name'].join(PATH_DELIMITER)]),
      };

      const result = treeReducer(state, {
        type: 'REMOVE_STALE_PATHS',
        stalePaths: [],
      });

      expect(result).toBe(state);
    });

    it('should clean up both selectedPaths and manualExpandedPaths atomically', () => {
      const state = {
        ...initialState,
        selectedPaths: new Set([
          ['metadata', 'labels', 'app'].join(PATH_DELIMITER),
        ]),
        manualExpandedPaths: new Set([
          ['metadata'].join(PATH_DELIMITER),
          ['metadata', 'labels'].join(PATH_DELIMITER),
        ]),
      };

      const result = treeReducer(state, {
        type: 'REMOVE_STALE_PATHS',
        stalePaths: [['metadata', 'labels'].join(PATH_DELIMITER)],
      });

      // Both should be cleaned up in the same result
      expect(result.selectedPaths.has(['metadata', 'labels', 'app'].join(PATH_DELIMITER))).toBe(false);
      expect(result.manualExpandedPaths.has(['metadata', 'labels'].join(PATH_DELIMITER))).toBe(false);
      // Parent should remain
      expect(result.manualExpandedPaths.has(['metadata'].join(PATH_DELIMITER))).toBe(true);
    });
  });

  describe('MERGE_TREE_NODES (placeholder for real-time updates)', () => {
    it('should be a no-op until implemented', () => {
      const state = {
        ...initialState,
        nodeTree: [{ name: 'metadata', type: 'ObjectMeta', fullPath: ['metadata'], level: 0, children: [] }],
      };

      const result = treeReducer(state, {
        type: 'MERGE_TREE_NODES',
        additions: [{ parentPathKey: 'metadata', node: { name: 'newKey', type: 'string', fullPath: ['metadata', 'newKey'], level: 1, children: [] } }],
        removals: ['metadata\x00oldKey'],
      });

      // Currently returns unchanged state (placeholder)
      expect(result).toBe(state);
    });

    // TODO: Add these tests when MERGE_TREE_NODES is implemented:
    // - should add new nodes to parent
    // - should remove nodes and clean up selectedPaths
    // - should remove nodes and clean up manualExpandedPaths
    // - should handle batch additions and removals atomically
  });

  describe('Atomic state updates', () => {
    it('should update selectedPaths and expandedPaths atomically in TOGGLE_SELECT', () => {
      // This test verifies that both state changes happen in a single reducer call
      // which is important for real-time updates to avoid intermediate renders
      const state = { ...initialState };
      const pathKey = ['spec', 'containers', '0', 'name'].join(PATH_DELIMITER);
      const parentPathKeys = [
        ['spec'].join(PATH_DELIMITER),
        ['spec', 'containers'].join(PATH_DELIMITER),
        ['spec', 'containers', '0'].join(PATH_DELIMITER),
      ];

      const result = treeReducer(state, { type: 'TOGGLE_SELECT', pathKey, parentPathKeys });

      // Both changes should be in the same result object
      expect(result.selectedPaths.has(pathKey)).toBe(true);
      expect(result.manualExpandedPaths.has(parentPathKeys[0])).toBe(true);
      expect(result.manualExpandedPaths.has(parentPathKeys[1])).toBe(true);
      expect(result.manualExpandedPaths.has(parentPathKeys[2])).toBe(true);

      // Original state should be unchanged (immutability check)
      expect(state.selectedPaths.size).toBe(0);
      expect(state.manualExpandedPaths.size).toBe(0);
    });
  });
});

describe('PATH_DELIMITER', () => {
  it('should use null character to avoid conflicts with field names containing slashes', () => {
    // Kubernetes annotation names often contain slashes like "karpenter.sh/node-hash-version"
    expect(PATH_DELIMITER).toBe('\x00');

    // Verify it doesn't conflict with typical Kubernetes names
    const annotationName = 'karpenter.sh/node-hash-version';
    const path = ['metadata', 'annotations', annotationName];
    const pathKey = path.join(PATH_DELIMITER);

    // Should be able to split back correctly
    const splitPath = pathKey.split(PATH_DELIMITER);
    expect(splitPath).toEqual(path);
    expect(splitPath[2]).toBe(annotationName);
  });
});

describe('boundedMatchIndex helper', () => {
  // Test the bounding logic used in useTree return value
  const computeBoundedIndex = (currentMatchIndex: number, matchedPathsLength: number) => {
    return matchedPathsLength > 0
      ? Math.min(currentMatchIndex, matchedPathsLength - 1)
      : 0;
  };

  it('should return 0 when matchedPaths is empty', () => {
    expect(computeBoundedIndex(5, 0)).toBe(0);
    expect(computeBoundedIndex(0, 0)).toBe(0);
  });

  it('should return currentMatchIndex when within bounds', () => {
    expect(computeBoundedIndex(0, 5)).toBe(0);
    expect(computeBoundedIndex(2, 5)).toBe(2);
    expect(computeBoundedIndex(4, 5)).toBe(4);
  });

  it('should clamp to last index when currentMatchIndex exceeds bounds', () => {
    // This happens when matchedPaths shrinks but currentMatchIndex hasn't been reset yet
    expect(computeBoundedIndex(10, 5)).toBe(4);  // max index for length 5 is 4
    expect(computeBoundedIndex(5, 3)).toBe(2);   // max index for length 3 is 2
  });

  it('should handle single-item list correctly', () => {
    expect(computeBoundedIndex(0, 1)).toBe(0);
    expect(computeBoundedIndex(5, 1)).toBe(0);  // clamped to 0
  });
});
