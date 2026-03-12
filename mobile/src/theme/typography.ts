import { TextStyle } from 'react-native';

export const typography = {
  heroBalance: {
    fontSize: 48,
    fontWeight: '200' as TextStyle['fontWeight'],
    letterSpacing: -1,
  },
  heading1: {
    fontSize: 28,
    fontWeight: '500' as TextStyle['fontWeight'],
    letterSpacing: -0.5,
  },
  heading2: {
    fontSize: 22,
    fontWeight: '500' as TextStyle['fontWeight'],
    letterSpacing: -0.3,
  },
  heading3: {
    fontSize: 18,
    fontWeight: '500' as TextStyle['fontWeight'],
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as TextStyle['fontWeight'],
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as TextStyle['fontWeight'],
  },
  label: {
    fontSize: 12,
    fontWeight: '300' as TextStyle['fontWeight'],
    letterSpacing: 0.5,
    textTransform: 'uppercase' as TextStyle['textTransform'],
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as TextStyle['fontWeight'],
  },
  mono: {
    fontSize: 14,
    fontWeight: '400' as TextStyle['fontWeight'],
    fontFamily: 'monospace',
  },
} as const;
