import { Button } from "./ui/button";

interface SelectionBadgeProps {
  count: number;
  onClearAll: () => void;
}

export function SelectionBadge({ count, onClearAll }: SelectionBadgeProps) {
  if (count === 0) {
    return null;
  }

  return (
    <div className="
      p-2 flex items-center gap-2
      border-b border-border
      md:absolute md:top-2 md:left-2 md:z-10
      md:w-auto md:border md:rounded-md md:shadow-lg
      md:bg-background/95 md:backdrop-blur-sm
      md:p-1.5
    ">
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {count} selected
      </span>
      <Button
        variant="destructive"
        size="sm"
        onClick={onClearAll}
        className="h-7 text-xs"
      >
        Clear all
      </Button>
    </div>
  );
}
