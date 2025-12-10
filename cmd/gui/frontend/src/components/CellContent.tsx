import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { HighlightedText } from './HighlightedText';
import { CLIPBOARD_CURSOR } from '../lib/clipboard-cursor';

interface CellContentProps {
  value: any;
  highlightIndices?: [number, number][] | null;
}

export function CellContent({
  value,
  highlightIndices,
}: CellContentProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);

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
    <Popover open={isHovered} onOpenChange={setIsHovered}>
      <PopoverTrigger asChild>
        <div
          className="text-sm truncate hover:underline hover:bg-accent/50 -mx-4 px-4 -my-2 py-2 rounded"
          style={{ cursor: CLIPBOARD_CURSOR }}
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
          {copied && (
            <span className="ml-2 text-xs text-green-600 font-medium">
              Copied
            </span>
          )}
        </pre>
      </PopoverContent>
    </Popover>
  );
}
