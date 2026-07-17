/**
 * Alinma Bank – Financial Health feature design tokens.
 * Dark-only palette matching Alinma's existing visual language.
 */

const alinma = {
  // Legacy aliases
  text: '#FFFFFF',
  tint: '#E07A5F',

  // Surfaces
  background: '#091525',
  foreground: '#FFFFFF',

  // Cards
  card: '#122033',
  cardForeground: '#FFFFFF',

  // Primary (coral – Alinma's progress-bar accent)
  primary: '#E07A5F',
  primaryForeground: '#FFFFFF',

  // Secondary
  secondary: '#1A2C45',
  secondaryForeground: '#FFFFFF',

  // Muted
  muted: '#0D1E35',
  mutedForeground: '#7A90AD',

  // Accent (green – positive metrics)
  accent: '#4CAF8C',
  accentForeground: '#FFFFFF',

  // Warning (amber)
  warning: '#F4A836',
  warningForeground: '#FFFFFF',

  // Destructive
  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',

  // Borders / inputs
  border: '#1E3050',
  input: '#1A2C45',
};

const colors = {
  light: alinma,
  dark: alinma,
  radius: 12,
};

export default colors;
