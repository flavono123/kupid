// TODO: Make animation origin follow click/enter position
// Currently the animation always starts from the center of the screen.
// The goal is to have the circular expansion start from where the user clicked
// or from the center of the selected item when using Enter key.
// Reference: https://theme-toggle.rdsx.dev/

// Inject dynamic keyframes for the animation
function injectCircleAnimation(): void {
  const styleId = 'theme-toggle-animation';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation: none;
      mix-blend-mode: normal;
    }
    ::view-transition-old(root) {
      z-index: 1;
    }
    ::view-transition-new(root) {
      z-index: 9999;
      animation: theme-circle-clip 500ms ease-in-out;
    }
    @keyframes theme-circle-clip {
      from {
        clip-path: circle(0px at 50% 50%);
      }
      to {
        clip-path: circle(200vmax at 50% 50%);
      }
    }
  `;
}

type SetThemeFn = (theme: string) => void;

/**
 * Toggle theme with circular animation
 */
export function toggleThemeWithAnimation(
  _event: React.MouseEvent | React.KeyboardEvent,
  currentTheme: string | undefined,
  setTheme: SetThemeFn
): void {
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  // Check if View Transitions API is supported
  if (!document.startViewTransition) {
    setTheme(newTheme);
    return;
  }

  // Inject animation styles
  injectCircleAnimation();

  // Use View Transitions API for smooth animation
  document.startViewTransition(() => {
    setTheme(newTheme);
  });
}
