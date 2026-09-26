import { useId } from 'react';

/**
 * A document-unique prefix for SVG gradient / clip-path ids. On web every
 * screen of a stack stays in the DOM, so fixed ids would collide and a hidden
 * screen's definition would win (the shape then renders empty).
 */
export function useSvgId(name: string): (part: string) => string {
  const prefix = `${name}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (part) => `${prefix}-${part}`;
}
