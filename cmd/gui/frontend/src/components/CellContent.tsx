import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { HighlightedText } from './HighlightedText';

interface CellContentProps {
  value: any;
  highlightIndices?: [number, number][] | null;
}

export function CellContent({
  value,
  highlightIndices,
}: CellContentProps) {
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

  // Always render with popover for consistency
  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className="text-sm truncate cursor-pointer hover:bg-accent/50 -mx-4 px-4 -my-2 py-2 rounded"
          title={fullText}  // Native tooltip on hover
        >
          {content}
        </div>
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
