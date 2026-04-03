// Reusable Trippin' brand logo — tree icon + wordmark.
// Rendered as inline-flex so the element's layout bounds match its visual bounds,
// making centering (flex justify-center, mx-auto, etc.) work reliably.
//
// Props:
//   size    — 'sm' | 'md' (default) | 'lg'
//   variant — 'dark' (green, for light backgrounds) | 'light' (white, for dark backgrounds)

import { ReactElement } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
  className?: string;
}

const TREE_SIZES  = { sm: 16, md: 20, lg: 28 } as const;
const FONT_SIZES  = { sm: 18, md: 22, lg: 36 } as const;
const COLORS      = { dark: '#2D5A27', light: '#ffffff' } as const;

const TrippinLogo = ({ size = 'md', variant = 'dark', className }: LogoProps): ReactElement => {
  const color    = COLORS[variant];
  const treeSize = TREE_SIZES[size];
  const fontSize = FONT_SIZES[size];
  const gap      = Math.round(treeSize * 0.45);

  return (
    <div
      role="img"
      aria-label="Trippin'"
      style={{ display: 'inline-flex', alignItems: 'center', gap }}
      className={className}
    >
      {/* Pine-tree icon — native 16×16 viewBox, explicit width+height so it never stretches */}
      <svg
        width={treeSize}
        height={treeSize}
        viewBox="0 0 16 16"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M8.416.223a.5.5 0 0 0-.832 0l-3 4.5A.5.5 0 0 0 5 5.5h.098L3.076 8.735A.5.5 0 0 0 3.5 9.5h.191l-1.638 3.276a.5.5 0 0 0 .447.724H7V16h2v-2.5h4.5a.5.5 0 0 0 .447-.724L12.31 9.5h.191a.5.5 0 0 0 .424-.765L10.902 5.5H11a.5.5 0 0 0 .416-.777z"
          fill={color}
        />
      </svg>

      {/* Wordmark */}
      <span
        style={{
          fontFamily: "'Fredoka', sans-serif",
          fontSize,
          fontWeight: 600,
          color,
          lineHeight: 1,
        }}
      >
        Trippin'
      </span>
    </div>
  );
};

export default TrippinLogo;
