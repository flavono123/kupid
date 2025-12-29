import { useState, useEffect } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

interface SelectionBadgeProps {
  count: number;
  onClearAll: () => void;
}

export function SelectionBadge({ count, onClearAll }: SelectionBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Reset hover state when count changes
  useEffect(() => {
    setIsHovered(false);
  }, [count]);

  if (count === 0) {
    return null;
  }

  return (
    <div
      className="h-6 flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered ? (
        <Button
          variant="destructive"
          size="sm"
          className="h-6 px-2 text-xs rounded-full"
          onClick={onClearAll}
        >
          Clear all
        </Button>
      ) : (
        <Badge variant="secondary">
          {count} selected
        </Badge>
      )}
    </div>
  );
}
