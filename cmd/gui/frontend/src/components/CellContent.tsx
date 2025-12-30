import { useState } from 'react';  // For copied state
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { HighlightedText } from './HighlightedText';
import { cn } from '@/lib/utils';

interface CellContentProps {
  value: any;
  highlightIndices?: [number, number][] | null;
  /** Whether this cell is focused (keyboard or mouse) */
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
  const [copied, setCopied] = useState(false);

  // Show "Copied" when clicked OR space pressed
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
    <Popover open={isFocused}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "text-sm overflow-hidden whitespace-nowrap rounded cursor-pointer",
            // Same style for both keyboard and mouse focus
            isFocused && "underline bg-accent/50"
          )}
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
