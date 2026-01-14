import { Button } from "./ui/button";
import { Search } from "lucide-react";
import { ResourceDisplay } from "./ResourceDisplay";
import { SelectionBadge } from "./SelectionBadge";
import { main } from "../../wailsjs/go/models";

interface NavHeaderProps {
  selectedGVK: main.MultiClusterGVK | null;
  selectedFieldCount: number;
  onClearAllFields: () => void;
  onSearch: () => void;
}

/**
 * NavHeader - GVK selector row (aligns with DIYTableToolbar)
 * Context display moved to ContextBar component
 */
export function NavHeader({
  selectedGVK,
  selectedFieldCount,
  onClearAllFields,
  onSearch,
}: NavHeaderProps) {
  return (
    <div className="h-10 px-3 border-b border-border flex items-center justify-between gap-2 shrink-0">
      {/* GVK Display */}
      <ResourceDisplay
        selectedGVK={selectedGVK}
        className="min-w-0"
      />
      {/* Selection Badge + Search */}
      <div className="flex items-center gap-1">
        <SelectionBadge
          count={selectedFieldCount}
          onClearAll={onClearAllFields}
        />
        {selectedGVK && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSearch}
            className="h-6 w-6"
            title="Search fields (⌘F)"
          >
            <Search className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
