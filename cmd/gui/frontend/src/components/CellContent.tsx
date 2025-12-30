import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { HighlightedText } from './HighlightedText';
import { cn } from '@/lib/utils';

interface CellContentProps {
  value: any;
  highlightIndices?: [number, number][] | null;
  /** Whether this cell is focused via keyboard navigation */
  isFocused?: boolean;
  /** Whether to show "Copied" feedback (controlled by parent) */
  showCopied?: boolean;
}

export function CellContent({
  value,
  highlightIndices,
  isFocused = false,
  showCopied = false,
}: CellContentProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  // Show popover when hovered OR focused
  const isOpen = isHovered || isFocused;
  // Show "Copied" when clicked (hover) OR space pressed (focus)
  const displayCopied = copied || showCopied;

  // Handle null/undefined
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  // Detect value type
  const isObject = typeof value === 'object' && value !== null;

  // Convert to full text (original)
  const fullText = isObject
    ? JSON.stringify(value, null, 2)  // Pretty-printed JSON
    : String(value);

  // Render with highlighting if available
  const content = highlightIndices ? (
    <HighlightedText text={fullText} indices={highlightIndices} />
  ) : (
    fullText
  );

  // Handle click to copy
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // Always render with popover for consistency
  return (
    <Popover open={isOpen} onOpenChange={setIsHovered}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "text-sm overflow-hidden whitespace-nowrap rounded cursor-pointer",
            "hover:underline hover:bg-accent/50",
            isFocused && "underline bg-accent/50"
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleClick}
        >
          {content}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 max-h-96 overflow-auto"
        align="start"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <pre className="text-xs whitespace-pre-wrap font-mono inline">
          {highlightIndices ? (
            <HighlightedText text={fullText} indices={highlightIndices} />
          ) : (
            fullText
          )}
          {displayCopied && (
            <span className="ml-2 text-xs text-primary font-medium">
              Copied
            </span>
          )}
        </pre>
      </PopoverContent>
    </Popover>
  );
}
