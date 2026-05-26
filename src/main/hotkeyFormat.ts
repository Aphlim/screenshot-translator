/**
 * Format an Electron accelerator string for display in menus / tooltips.
 *
 * Electron uses "CommandOrControl" as a cross-platform stand-in, which is
 * verbose for end-users. On Windows we show "Ctrl"; on macOS "⌘"; the rest
 * of the keys are simplified similarly.
 *
 * Kept platform-aware but minimal — full key normalization is overkill for
 * the labels the user actually sees here.
 */
export function acceleratorToHumanLabel(accelerator: string): string {
  if (!accelerator) return '';
  const isMac = process.platform === 'darwin';
  return accelerator
    .split('+')
    .map((part) => {
      switch (part) {
        case 'CommandOrControl':
        case 'CmdOrCtrl':
          return isMac ? '⌘' : 'Ctrl';
        case 'Command':
        case 'Cmd':
          return '⌘';
        case 'Control':
        case 'Ctrl':
          return 'Ctrl';
        case 'Option':
          return isMac ? '⌥' : 'Alt';
        case 'Alt':
          return isMac ? '⌥' : 'Alt';
        case 'Shift':
          return isMac ? '⇧' : 'Shift';
        case 'Super':
        case 'Meta':
          return isMac ? '⌘' : 'Win';
        default:
          return part;
      }
    })
    .join('+');
}
