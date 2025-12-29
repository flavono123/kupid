import { Button } from "./ui/button";
import { PanelLeftClose, Search } from "lucide-react";
import { ContextDisplay } from "./ContextDisplay";
import { ResourceDisplay } from "./ResourceDisplay";
import { SelectionBadge } from "./SelectionBadge";
import { main } from "../../wailsjs/go/models";

interface NavHeaderProps {
  selectedContexts: string[];
  connectedContexts: string[];
  selectedGVK: main.MultiClusterGVK | null;
  selectedFieldCount: number;
  onCollapse: () => void;
  onBackToContexts: () => void;
  onClearAllFields: () => void;
  onSearch: () => void;
}

export function NavHeader({
  selectedContexts,
  connectedContexts,
  selectedGVK,
  selectedFieldCount,
  onCollapse,
  onBackToContexts,
  onClearAllFields,
  onSearch,
}: NavHeaderProps) {
  return (
    <div className="p-4 border-b border-border flex flex-col gap-2">
      {/* Row 1: ContextDisplay / Collapse Button */}
      <div className="flex items-center justify-between gap-2">
        <ContextDisplay
          selectedContexts={selectedContexts}
          connectedContexts={connectedContexts}
          onBackToContexts={onBackToContexts}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onCollapse}
          className="shrink-0"
        >
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>

      {/* Row 2: ResourceDisplay / SelectionBadge + Search */}
      <div className="flex items-center justify-between gap-2 px-3 h-6">
        <ResourceDisplay
          selectedGVK={selectedGVK}
          className="min-w-0"
        />
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
    </div>
  );
}
