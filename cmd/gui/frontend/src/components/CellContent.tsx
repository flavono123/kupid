import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { HighlightedText } from './HighlightedText';

interface CellContentProps {
  value: any;
  maxLength?: number;  // Maximum character length before truncation
  highlightIndices?: [number, number][] | null;
}

export function CellContent({
  value,
  maxLength = 50,  // Default to 50 characters
  highlightIndices,
}: CellContentProps) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  // Detect value type
  const isObject = typeof value === 'object' && value !== null;
  const isArray = Array.isArray(value);

  // Convert to full text (original)
  const fullText = isObject
    ? JSON.stringify(value, null, 2)  // Pretty-printed JSON
    : String(value);

  // Create truncated version
  const isTruncated = fullText.length > maxLength;
  const displayText = isTruncated
    ? isObject
      ? isArray
        ? '[...]'  // Array indicator
        : '{...}'  // Object indicator
      : fullText.slice(0, maxLength) + '...'  // String truncation
    : fullText;

  // If not truncated, render inline
  if (!isTruncated) {
    return (
      <span className="text-sm">
        {highlightIndices ? (
          <HighlightedText text={fullText} indices={highlightIndices} />
        ) : (
          fullText
        )}
      </span>
    );
  }

  // If truncated, render with popover
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-left hover:underline cursor-pointer text-sm">
          {highlightIndices ? (
            <HighlightedText
              text={displayText}
              indices={highlightIndices.filter(([start]) => start < maxLength)}
            />
          ) : (
            displayText
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-96 overflow-auto" align="start">
        <pre className="text-xs whitespace-pre-wrap font-mono">
          {highlightIndices ? (
            <HighlightedText text={fullText} indices={highlightIndices} />
          ) : (
            fullText
          )}
        </pre>
      </PopoverContent>
    </Popover>
  );
}
