import { ReactNode } from "react";

interface HighlightedTextProps {
  text: string;
  indices?: readonly [number, number][]; // fuzzysort match indices
  highlightClassName?: string; // Customizable highlight style
}

export function HighlightedText({
  text,
  indices = [],
  highlightClassName = "bg-yellow-200 text-foreground"
}: HighlightedTextProps) {
  if (indices.length === 0) return <>{text}</>;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;

  indices.forEach(([start, end]) => {
    // Non-matched part
    if (start > lastIndex) {
      parts.push(
        <span key={`text-${keyCounter++}`}>
          {text.substring(lastIndex, start)}
        </span>
      );
    }
    // Matched part (highlighted)
    parts.push(
      <mark key={`mark-${keyCounter++}`} className={highlightClassName}>
        {text.substring(start, end + 1)}
      </mark>
    );
    lastIndex = end + 1;
  });

  // Remaining part
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${keyCounter++}`}>
        {text.substring(lastIndex)}
      </span>
    );
  }

  return <>{parts}</>;
}
