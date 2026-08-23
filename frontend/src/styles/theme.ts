/**
 * Emergency Operations Center Dashboard Theme Configuration
 * 
 * This file defines the visual theme and design system for the
 * Flood Intelligence Emergency Operations Center inspired by:
 * - Microsoft Azure Maps
 * - ArcGIS Dashboard
 * - IBM Environmental Intelligence
 */

// Color Palette
export const colors = {
  // Primary - Cyan/Blue (Action and primary elements)
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
  },

  // Secondary - Purple (Highlights and secondary actions)
  secondary: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },

  // Status - Red (Critical alerts)
  critical: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  // Status - Amber (Warning)
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // Status - Green (Success/Normal)
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#145231',
  },

  // Neutral - Slate (Backgrounds and text)
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
};

// Typography Scale
export const typography = {
  // Headings
  h1: 'text-4xl font-bold leading-tight',
  h2: 'text-3xl font-bold leading-snug',
  h3: 'text-2xl font-semibold leading-snug',
  h4: 'text-xl font-semibold leading-normal',
  h5: 'text-lg font-semibold leading-normal',
  h6: 'text-base font-semibold leading-normal',

  // Body
  body: 'text-base font-normal leading-relaxed',
  bodySm: 'text-sm font-normal leading-relaxed',
  bodyXs: 'text-xs font-normal leading-relaxed',

  // Labels
  label: 'text-sm font-medium leading-normal',
  labelSm: 'text-xs font-medium leading-normal',

  // Code
  code: 'font-mono text-sm',
};

// Spacing Scale
export const spacing = {
  xs: '0.25rem', // 4px
  sm: '0.5rem', // 8px
  md: '1rem', // 16px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
  '2xl': '2.5rem', // 40px
  '3xl': '3rem', // 48px
};

// Border Radius
export const borderRadius = {
  sm: '0.375rem', // 6px
  md: '0.5rem', // 8px
  lg: '0.75rem', // 12px
  xl: '1rem', // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',
};

// Shadows
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
  none: 'none',
  glow: '0 0 20px rgba(6, 182, 212, 0.3)',
};

// Transitions
export const transitions = {
  fast: 'all 0.15s ease-in-out',
  normal: 'all 0.3s ease-in-out',
  slow: 'all 0.5s ease-in-out',
};

// Animations
export const animations = {
  pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  bounce: 'bounce 1s infinite',
  fadeIn: 'fadeIn 0.3s ease-in-out',
  slideIn: 'slideIn 0.3s ease-in-out',
};

// Component Variants
export const components = {
  // Card - Base card component
  card: {
    base: 'rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-4 shadow-sm transition-all',
    hover: 'hover:border-slate-600/80 hover:shadow-md',
    interactive: 'cursor-pointer hover:shadow-lg hover:border-cyan-500/30',
  },

  // Button variants
  button: {
    primary: 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-white font-semibold',
    danger: 'bg-red-600 hover:bg-red-500 text-white font-semibold',
    ghost: 'hover:bg-slate-700/50 text-slate-300 hover:text-white font-semibold',
  },

  // Badge variants
  badge: {
    success: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/20',
    warning: 'bg-amber-500/15 text-amber-300 ring-amber-400/20',
    danger: 'bg-rose-500/15 text-rose-300 ring-rose-400/20',
    info: 'bg-cyan-500/15 text-cyan-300 ring-cyan-400/20',
  },

  // Panel backgrounds
  panel: {
    primary: 'bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/50',
    elevated: 'bg-gradient-to-br from-slate-700/50 to-slate-800/50 border border-slate-600/50 shadow-lg',
    overlay: 'bg-slate-900/95 backdrop-blur-md border border-slate-700/50',
  },
};

// Responsive Breakpoints
export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// Z-Index Scale
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modal: 1040,
  popover: 1050,
  tooltip: 1060,
};

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  animations,
  components,
  breakpoints,
  zIndex,
};
