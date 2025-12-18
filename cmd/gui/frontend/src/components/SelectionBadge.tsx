import { useState } from "react";

interface SelectionBadgeProps {
  count: number;
  onClearAll: () => void;
}

export function SelectionBadge({ count, onClearAll }: SelectionBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (count === 0) {
    return null;
  }

  return (
    <button
      className={`
        px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap
        ${isHovered
          ? "bg-destructive text-destructive-foreground cursor-pointer"
          : "bg-primary/10 text-primary"
        }
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={isHovered ? onClearAll : undefined}
    >
      {isHovered ? "Clear all" : `${count} selected`}
    </button>
  );
}
