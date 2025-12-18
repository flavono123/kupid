import { main } from "../../wailsjs/go/models";

interface ResourceDisplayProps {
  selectedGVK: main.MultiClusterGVK | null;
  className?: string;
}

export function ResourceDisplay({ selectedGVK, className = "" }: ResourceDisplayProps) {
  if (!selectedGVK) {
    return (
      <div className={`text-xs text-muted-foreground italic truncate ${className}`}>
        Select a resource
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 min-w-0 overflow-hidden ${className}`}>
      <h3 className="text-sm font-medium text-foreground whitespace-nowrap">
        {selectedGVK.kind}
      </h3>
      {selectedGVK.group && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {selectedGVK.group}
        </span>
      )}
    </div>
  );
}
