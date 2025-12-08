import { useState, useEffect, useMemo } from "react";
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

  // Flatten tree for search
  const flattenTree = (nodes: TreeNode[], acc: TreeNode[] = []): TreeNode[] => {
    for (const node of nodes) {
      acc.push(node);
      if (node.children && node.children.length > 0) {
        flattenTree(node.children, acc);
      }
    }
    return acc;
  };

  const flatNodes = useMemo(() => flattenTree(nodeTree), [nodeTree]);

  // Prepare searchable texts
  const searchableTexts = useMemo(() => {
    return flatNodes.map((node) => {
      // Search by name + type
      return `${node.name} ${node.type}`;
    });
  }, [flatNodes]);

  const { query, setQuery, results } = useFuzzySearch(searchableTexts);

  // Toggle expand
  const toggleExpand = (path: string[]) => {
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
  };

  // Toggle select
  const toggleSelect = (path: string[]) => {
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
  };

  // Check if path is expanded
  const isExpanded = (path: string[]) => {
    return expandedPaths.has(path.join('/'));
  };

  // Check if path is selected
  const isSelected = (path: string[]) => {
    return selectedPaths.has(path.join('/'));
  };

  // Render tree recursively
  const renderNode = (node: TreeNode, index: number): JSX.Element => {
    const hasChildren = node.children && node.children.length > 0;
    // Arrays and maps are never leaf nodes, even if empty
    const isArrayOrMap = node.type && (node.type.startsWith('[]') || node.type.startsWith('map['));
    const isLeaf = !hasChildren && !isArrayOrMap;
    const expanded = isExpanded(node.fullPath);
    const selected = isSelected(node.fullPath);

    // Check if this node matches search
    const nodeIndex = flatNodes.indexOf(node);
    const matchResult = results.find((r) => searchableTexts.indexOf(r.item) === nodeIndex);

    return (
      <div key={`${node.fullPath.join('/')}-${index}`}>
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
              onClick={() => toggleExpand(node.fullPath)}
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
              onCheckedChange={() => toggleSelect(node.fullPath)}
              className="ml-1 mr-2"
            />
          )}
          {!isLeaf && <span className="w-5 ml-1 mr-2" />}

          {/* Field name */}
          <span className="text-sm text-foreground">
            {matchResult ? (
              <HighlightedText text={node.name} indices={matchResult.indices} />
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
              node.children.map((child, idx) => renderNode(child, idx))
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
  };

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
            {nodeTree.map((node, idx) => renderNode(node, idx))}
          </div>
        )}
      </div>
    </div>
  );
}
