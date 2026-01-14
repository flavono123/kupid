import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Simple pluralize for English words (covers most K8s resource kinds)
 * - policy → policies (consonant + y → ies)
 * - status → statuses (s, x, ch, sh → es)
 * - pod → pods (default → s)
 */
export function pluralize(word: string): string {
  const lower = word.toLowerCase();
  // Consonant + y → ies (but not vowel + y like "key" → "keys")
  if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) {
    return word.slice(0, -1) + 'ies';
  }
  // s, x, ch, sh → es
  if (/(?:s|x|ch|sh)$/.test(lower)) {
    return word + 'es';
  }
  return word + 's';
}
