/**
 * UNIverse design tokens, derived from the logo: near-black navy background,
 * electric blue → violet brand gradient, white orbit highlights.
 * Text colours keep at least WCAG AA contrast on the background.
 */
export const colors = {
  bg: '#070A13',
  bgDeep: '#04060D',
  surface: 'rgba(255,255,255,0.045)',
  surfaceStrong: 'rgba(255,255,255,0.075)',
  surfacePressed: 'rgba(255,255,255,0.11)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.15)',

  text: '#F7F8FF',
  textSecondary: '#C8CEE6',
  textMuted: '#8E97B8',

  primary: '#4F6BFF',
  primaryLight: '#8A9CFF',
  primaryPale: '#C5CDFF',
  primaryDeep: '#3949E6',
  primarySoft: 'rgba(79,107,255,0.16)',
  primaryBorder: 'rgba(138,156,255,0.32)',

  accent: '#A35BF5',
  accentLight: '#C495FA',
  accentSoft: 'rgba(163,91,245,0.16)',
  accentBorder: 'rgba(196,149,250,0.32)',

  success: '#34D399',
  successLight: '#6EE7B7',
  successSoft: 'rgba(52,211,153,0.13)',
  successBorder: 'rgba(52,211,153,0.3)',

  amber: '#FBBF24',
  amberSoft: 'rgba(251,191,36,0.13)',
  amberBorder: 'rgba(251,191,36,0.3)',

  red: '#F87171',
  redSoft: 'rgba(248,113,113,0.13)',
  redBorder: 'rgba(248,113,113,0.3)',

  bubbleMine: '#3A4FE0',
  bubbleOther: '#141A2E',
  tabBar: 'rgba(7,10,19,0.94)',
  overlay: 'rgba(2,4,10,0.75)',
} as const;

type Gradient = readonly [string, string, ...string[]];

export const gradients = {
  brand: ['#3F5EFB', '#6B4EF3', '#B05CF2'] as Gradient,
  brandText: ['#8A9CFF', '#B7A4FF', '#D08CF7'] as Gradient,
  primary: ['#4F6BFF', '#3441D6'] as Gradient,
  sky: ['#5B8DEF', '#3657E0'] as Gradient,
  accent: ['#A35BF5', '#6D28D9'] as Gradient,
  indigo: ['#6366F1', '#4338CA'] as Gradient,
  success: ['#10B981', '#047857'] as Gradient,
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/** Horizontal page gutter used by every screen. */
export const gutter = 20;

/** Space reserved at the bottom of tab screens for the floating tab bar. */
export const tabBarClearance = 110;

export const type = {
  display: { fontSize: 40, lineHeight: 44, fontWeight: '800', letterSpacing: -1.1 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  title3: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  callout: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
} as const;

export type TypeVariant = keyof typeof type;
export type ColorName = keyof typeof colors;
