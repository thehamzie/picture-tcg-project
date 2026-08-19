// Small color utilities. Skin tokens are stored as the mockup wrote them — some `#RRGGBB`,
// some already `rgba(...)` — so anything that needs a token at partial opacity goes through
// `withAlpha` rather than assuming a format.

/** Returns `color` at the given alpha. Accepts `#RGB`, `#RRGGBB`, `rgb()` and `rgba()`. */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const hex = color.length === 4 ? color.slice(1).split('').map((c) => c + c).join('') : color.slice(1);
    const int = parseInt(hex, 16);
    return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
  }
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const [r, g, b] = match[1].split(',').map((part) => parseFloat(part.trim()));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

/**
 * Whether a skin paints its shell light. Drives anything that has to invert with the shell
 * rather than with a token — currently the OS status bar, which no token can express.
 * Derived from the palette instead of a hardcoded skin-id list so a new skin gets it right
 * without touching this file.
 */
export function isLightSurface(color: string): boolean {
  return readableInk(color) === '#17130F';
}

/**
 * Dark ink or white, whichever reads on `color`. The mockup only ever renders the "golden"
 * vibe chip, where it uses dark ink (#17130F); this threshold reproduces that for golden and
 * falls to white for the four darker vibes, which dark ink wouldn't clear on.
 */
export function readableInk(color: string): string {
  const hex = color.startsWith('#') ? color.slice(1) : null;
  if (!hex) return '#FFFFFF';
  const int = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
  const luminance = (0.299 * ((int >> 16) & 255) + 0.587 * ((int >> 8) & 255) + 0.114 * (int & 255)) / 255;
  return luminance > 0.6 ? '#17130F' : '#FFFFFF';
}
