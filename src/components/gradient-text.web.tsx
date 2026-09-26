import type { CSSProperties } from 'react';

import { gradients } from '@/theme/tokens';

import type { GradientTextProps } from './gradient-text';

const FONT_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Web version: CSS background-clip keeps the text selectable and crisp. */
export function GradientText({ text, style, colors = gradients.brandText }: GradientTextProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        alignSelf: 'flex-start',
        fontFamily: FONT_STACK,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight as CSSProperties['fontWeight'],
        lineHeight: style.lineHeight ? `${style.lineHeight}px` : undefined,
        letterSpacing: style.letterSpacing,
        backgroundImage: `linear-gradient(90deg, ${colors.join(', ')})`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
      }}>
      {text}
    </span>
  );
}
