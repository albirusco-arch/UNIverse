/**
 * UNIverse design tokens, ported from the Figma Make prototype (Home screen):
 * deep slate background, violet → teal brand gradient, glassy surfaces.
 * Text colors are raised one step vs. the prototype so small text passes WCAG AA
 * on the dark background (slate-500/600 on #0F172A did not).
 */
export const colors = {
  bg: '#0F172A',
  bgDeep: '#0B1120',
  surface: 'rgba(255,255,255,0.05)',
  surfaceStrong: 'rgba(255,255,255,0.08)',
  surfacePressed: 'rgba(255,255,255,0.12)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',

  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',

  violet: '#8B5CF6',
  violetLight: '#A78BFA',
  violetPale: '#C4B5FD',
  violetDeep: '#7C3AED',
  violetSoft: 'rgba(139,92,246,0.16)',
  violetBorder: 'rgba(167,139,250,0.30)',

  teal: '#14B8A6',
  tealLight: '#2DD4BF',
  tealDeep: '#0D9488',
  tealSoft: 'rgba(20,184,166,0.16)',
  tealBorder: 'rgba(45,212,191,0.30)',

  indigo: '#6366F1',
  indigoLight: '#818CF8',
  indigoSoft: 'rgba(99,102,241,0.16)',

  amber: '#FBBF24',
  amberSoft: 'rgba(251,191,36,0.14)',
  amberBorder: 'rgba(251,191,36,0.30)',

  red: '#F87171',
  redSoft: 'rgba(248,113,113,0.14)',
  redBorder: 'rgba(248,113,113,0.30)',

  tabBar: 'rgba(15,23,42,0.94)',
  overlay: 'rgba(2,6,23,0.72)',
} as const;

export const gradients = {
  brand: ['#7C3AED', '#0D9488'] as const,
  brandText: ['#A78BFA', '#C4B5FD', '#2DD4BF'] as const,
  violet: ['#7C3AED', '#5B21B6'] as const,
  teal: ['#14B8A6', '#0F766E'] as const,
  indigo: ['#6366F1', '#4338CA'] as const,
  purple: ['#A855F7', '#7E22CE'] as const,
  cover: ['#312E81', '#0F172A'] as const,
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
  display: { fontSize: 42, lineHeight: 44, fontWeight: '900', letterSpacing: -1.2 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.3 },
  title3: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  callout: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
} as const;

export type TypeVariant = keyof typeof type;
export type ColorName = keyof typeof colors;
