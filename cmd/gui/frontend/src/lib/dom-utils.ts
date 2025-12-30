/**
 * Check if an input-like element is currently focused.
 * Used to prevent keyboard shortcuts from interfering with text input.
 */
export function isInputElementFocused(): boolean {
  const activeEl = document.activeElement;
  return activeEl instanceof HTMLInputElement ||
         activeEl instanceof HTMLTextAreaElement ||
         activeEl?.getAttribute('contenteditable') === 'true';
}
