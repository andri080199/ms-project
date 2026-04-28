/**
 * Single source of truth for color tokens.
 * Mirrored as CSS variables in globals.css — keep both in sync.
 *
 * Palette: teal/mint forest derived from
 *   #1F6F5F (dark teal) · #2FA084 (medium teal) · #6FCF97 (mint) · #EEEEEE (off-white)
 */

export const colors = {
  primary: {
    50: '#E8F5F0',
    100: '#C9EAD9',
    200: '#A8DDC2',
    300: '#6FCF97',
    400: '#4ABA90',
    500: '#2FA084',
    600: '#258870',
    700: '#1F6F5F',
    800: '#185548',
    900: '#0F3C33',
  },
  accent: {
    fuchsia: '#2FA084',
    cyan: '#6EC7C0',
    mint: '#6FCF97',
  },
  bg: {
    base: '#EEEEEE',
    canvas1: '#F4F8F6',
    canvas2: '#E8F1ED',
    canvas3: '#DCE9E3',
    elevated: '#133D34',     // dark teal, used as glass card tint
    overlay: '#050F0D',
  },
  text: {
    primary: '#EEEEEE',           // light, used INSIDE dark glass cards
    secondary: '#C5D0CC',         // light secondary, inside cards
    muted: '#8AA39C',             // light muted, inside cards
    onCanvas: '#0F3C33',          // dark, used directly on body
    onCanvasMuted: '#5A746B',     // dark muted, on body
    inverse: '#0A1F1A',
  },
  status: {
    success: '#2FA084',
    warning: '#D99E50',
    danger: '#C85C5C',
    info: '#3C9C96',
  },
} as const;

export const semantic = {
  primary: colors.primary[500],
  primaryLight: colors.primary[300],
  primaryDark: colors.primary[700],
} as const;
