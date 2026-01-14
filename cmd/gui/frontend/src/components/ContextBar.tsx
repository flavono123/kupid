import { Button } from "./ui/button";
import { PanelLeftClose } from "lucide-react";
import { ContextDisplay } from "./ContextDisplay";

interface ContextBarProps {
  selectedContexts: string[];
  connectedContexts: string[];
  onBackToContexts: () => void;
  onCollapse: () => void;
  sidebarWidthPercent: number; // Sidebar width as percentage (0-100)
}

export function ContextBar({
  selectedContexts,
  connectedContexts,
  onBackToContexts,
  onCollapse,
  sidebarWidthPercent,
}: ContextBarProps) {
  return (
    <div className="h-9 border-b border-border flex bg-background shrink-0">
      {/* Left section - matches sidebar width */}
      <div
        className="flex items-center justify-between gap-2 px-3 shrink-0"
        style={{ width: `${sidebarWidthPercent}%` }}
      >
        <ContextDisplay
          selectedContexts={selectedContexts}
          connectedContexts={connectedContexts}
          onBackToContexts={onBackToContexts}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onCollapse}
          className="shrink-0 h-6 w-6"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>
      {/* Right section - empty, just for visual balance */}
      <div className="flex-1" />
    </div>
  );
}
