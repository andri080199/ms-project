/**
 * Single source of truth for color tokens.
 * Mirrored as CSS variables in globals.css — keep both in sync.
 *
 * Palette: violet/iris derived from
 *   #372463 (deep violet) · #5F5082 (medium iris) · #736692 (soft lavender)
 */

export const colors = {
  primary: {
    50: '#F2F0F7',
    100: '#E0DAEC',
    200: '#BFB5CE',
    300: '#9990AD',
    400: '#7A6F92',
    500: '#736692',
    600: '#685B82',
    700: '#5F5082',
    800: '#4B377A',
    900: '#372463',
  },
  secondary: '#4B3A73',
  accent: {
    fuchsia: '#5F5082',
    cyan: '#9990AD',
    mint: '#736692',
  },
  bg: {
    base: '#EEEDF2',
    canvas1: '#F5F3FA',
    canvas2: '#ECE8F2',
    canvas3: '#DFD9EA',
    elevated: '#372463',     // deep violet, used as glass card tint
    overlay: '#1F1538',
  },
  text: {
    primary: '#EEEEEE',           // light, used INSIDE dark glass cards
    secondary: '#CFC9DA',         // light secondary, inside cards
    muted: '#948AAA',             // light muted, inside cards
    onCanvas: '#372463',          // dark violet, used directly on body
    onCanvasMuted: '#5F5082',     // muted iris on body
    inverse: '#1F1538',
  },
  status: {
    success: '#2FA084',
    warning: '#D99E50',
    danger: '#C85C5C',
    info: '#3C9C96',
  },
} as const;

export const semantic = {
  primary: colors.primary[900],
  primaryLight: colors.primary[300],
  primaryDark: colors.primary[900],
} as const;
