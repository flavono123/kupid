interface HighlightedTextProps {
  text: string;
  indices?: readonly [number, number][]; // fuse.js match indices
  highlightClassName?: string; // Customizable highlight style
}

export function HighlightedText({
  text,
  indices = [],
  highlightClassName = "bg-yellow-200 text-foreground"
}: HighlightedTextProps) {
  if (indices.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  indices.forEach(([start, end], idx) => {
    // Non-matched part
    if (start > lastIndex) {
      parts.push(text.substring(lastIndex, start));
    }
    // Matched part (highlighted)
    parts.push(
      <mark key={idx} className={highlightClassName}>
        {text.substring(start, end + 1)}
      </mark>
    );
    lastIndex = end + 1;
  });

  // Remaining part
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <>{parts}</>;
}
