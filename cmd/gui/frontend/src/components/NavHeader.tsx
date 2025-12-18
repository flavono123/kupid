import { Button } from "./ui/button";
import { PanelLeftClose } from "lucide-react";
import { ContextDisplay } from "./ContextDisplay";
import { ResourceDisplay } from "./ResourceDisplay";
import { main } from "../../wailsjs/go/models";

interface NavHeaderProps {
  selectedContexts: string[];
  connectedContexts: string[];
  selectedGVK: main.MultiClusterGVK | null;
  onCollapse: () => void;
}

export function NavHeader({
  selectedContexts,
  connectedContexts,
  selectedGVK,
  onCollapse,
}: NavHeaderProps) {
  return (
    <div className="p-4 border-b border-border relative">
      {/* Collapse Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onCollapse}
        className="absolute top-4 right-4"
      >
        <PanelLeftClose className="w-4 h-4" />
      </Button>

      <div className="pr-10 overflow-hidden">
        <div className="flex flex-col gap-2">
          <ContextDisplay
            selectedContexts={selectedContexts}
            connectedContexts={connectedContexts}
          />
          <ResourceDisplay
            selectedGVK={selectedGVK}
            className="px-3"
          />
        </div>
      </div>
    </div>
  );
}
