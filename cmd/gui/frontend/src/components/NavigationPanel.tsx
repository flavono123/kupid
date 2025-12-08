import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { GetNodeTree } from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";
import { useFuzzySearch } from "@/hooks/useFuzzySearch";
import { HighlightedText } from "./HighlightedText";

interface NavigationPanelProps {
  selectedGVK: main.MultiClusterGVK;
  connectedContexts: string[];
  onFieldsSelected?: (fields: string[][]) => void;
}

interface TreeNode {
  name: string;
  type: string;
  fullPath: string[];
  level: number;
  children: TreeNode[];
}

interface TreeNodeItemProps {
  node: TreeNode;
  expandedPaths: Set<string>;
  selectedPaths: Set<string>;
  onToggleExpand: (path: string[]) => void;
  onToggleSelect: (path: string[]) => void;
  matchIndices?: number[] | null;
}

// Memoized TreeNode component to prevent unnecessary re-renders
const TreeNodeItem = memo(({
  node,
  expandedPaths,
  selectedPaths,
  onToggleExpand,
  onToggleSelect,
  matchIndices,
}: TreeNodeItemProps) => {
  const hasChildren = node.children && node.children.length > 0;
  const isArrayOrMap = node.type && (node.type.startsWith('[]') || node.type.startsWith('map['));
  const isLeaf = !hasChildren && !isArrayOrMap;
  const pathKey = node.fullPath.join('/');
  const expanded = expandedPaths.has(pathKey);
  const selected = selectedPaths.has(pathKey);

  const handleExpandClick = useCallback(() => {
    onToggleExpand(node.fullPath);
  }, [node.fullPath, onToggleExpand]);

  const handleSelectChange = useCallback(() => {
    onToggleSelect(node.fullPath);
  }, [node.fullPath, onToggleSelect]);

  return (
    <div>
      <div
        className="flex items-center hover:bg-accent py-1 px-2 rounded-sm"
        style={{ paddingLeft: `${node.level * 16 + 8}px` }}
      >
        {/* Expand/Collapse button */}
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0"
            onClick={handleExpandClick}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <span className="w-5" />
        )}

        {/* Selection checkbox (for leaf nodes only) */}
        {isLeaf && (
          <Checkbox
            checked={selected}
            onCheckedChange={handleSelectChange}
            className="ml-1 mr-2"
          />
        )}
        {!isLeaf && <span className="w-5 ml-1 mr-2" />}

        {/* Field name */}
        <span className="text-sm text-foreground">
          {matchIndices ? (
            <HighlightedText text={node.name} indices={matchIndices} />
          ) : (
            node.name
          )}
        </span>

        {/* Type */}
        {node.type && (
          <span className="text-xs text-muted-foreground ml-2">
            {`<${node.type}>`}
          </span>
        )}
      </div>

      {/* Children (if expanded) */}
      {expanded && (
        <div>
          {hasChildren ? (
            node.children.map((child, idx) => (
              <TreeNodeItem
                key={`${child.fullPath.join('/')}-${idx}`}
                node={child}
                expandedPaths={expandedPaths}
                selectedPaths={selectedPaths}
                onToggleExpand={onToggleExpand}
                onToggleSelect={onToggleSelect}
              />
            ))
          ) : (
            <div
              className="text-xs text-muted-foreground italic"
              style={{ paddingLeft: `${(node.level + 1) * 16 + 8}px` }}
            >
              (empty)
            </div>
          )}
        </div>
      )}
    </div>
  );
});

TreeNodeItem.displayName = 'TreeNodeItem';

export function NavigationPanel({
  selectedGVK,
  connectedContexts,
  onFieldsSelected,
}: NavigationPanelProps) {
  const [nodeTree, setNodeTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [searchVisible, setSearchVisible] = useState(false);

  // Fetch node tree
  useEffect(() => {
    if (!selectedGVK || connectedContexts.length === 0) {
      setNodeTree([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    GetNodeTree(selectedGVK, connectedContexts)
      .then((nodes) => {
        setNodeTree(nodes || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load node tree:", error);
        setNodeTree([]);
        setLoading(false);
      });
  }, [selectedGVK, connectedContexts]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+F / Ctrl+F: Toggle search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setSearchVisible((prev) => !prev);
        return;
      }

      // Esc: Close search
      if (e.key === 'Escape' && searchVisible) {
        setSearchVisible(false);
        setQuery('');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchVisible]);

  // Flatten tree for search - create a Map for O(1) lookup
  const flatNodesMap = useMemo(() => {
    const map = new Map<string, TreeNode>();
    const flatten = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        const pathKey = node.fullPath.join('/');
        map.set(pathKey, node);
        if (node.children && node.children.length > 0) {
          flatten(node.children);
        }
      }
    };
    flatten(nodeTree);
    return map;
  }, [nodeTree]);

  // Prepare searchable texts - use same order as Map
  const { searchableTexts, pathKeys } = useMemo(() => {
    const texts: string[] = [];
    const keys: string[] = [];
    flatNodesMap.forEach((node, pathKey) => {
      texts.push(`${node.name} ${node.type}`);
      keys.push(pathKey);
    });
    return { searchableTexts: texts, pathKeys: keys };
  }, [flatNodesMap]);

  const { query, setQuery, results } = useFuzzySearch(searchableTexts);

  // Create a Map of search results for O(1) lookup
  const searchResultsMap = useMemo(() => {
    const map = new Map<string, number[] | null>();
    results.forEach((result) => {
      const index = searchableTexts.indexOf(result.item);
      if (index !== -1) {
        const pathKey = pathKeys[index];
        map.set(pathKey, result.indices);
      }
    });
    return map;
  }, [results, searchableTexts, pathKeys]);

  // Memoized toggle functions
  const toggleExpand = useCallback((path: string[]) => {
    const pathKey = path.join('/');
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }
      return next;
    });
  }, []);

  const toggleSelect = useCallback((path: string[]) => {
    const pathKey = path.join('/');
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }

      // Notify parent
      if (onFieldsSelected) {
        const selectedFields = Array.from(next).map((p) => p.split('/'));
        onFieldsSelected(selectedFields);
      }

      return next;
    });
  }, [onFieldsSelected]);

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar (conditional) */}
      {searchVisible && (
        <div className="p-2 border-b border-border flex items-center gap-2">
          <Input
            placeholder="Search fields and types..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSearchVisible(false);
              setQuery('');
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Tree View */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Loading schema...</p>
          </div>
        ) : nodeTree.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">No schema available</p>
          </div>
        ) : (
          <div className="p-2" style={{ minWidth: 'max-content' }}>
            {nodeTree.map((node, idx) => (
              <TreeNodeItem
                key={`${node.fullPath.join('/')}-${idx}`}
                node={node}
                expandedPaths={expandedPaths}
                selectedPaths={selectedPaths}
                onToggleExpand={toggleExpand}
                onToggleSelect={toggleSelect}
                matchIndices={searchResultsMap.get(node.fullPath.join('/')) || null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
