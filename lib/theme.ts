import type { TextStyle, ViewStyle } from 'react-native';

export type Scheme = 'light' | 'dark';
export type ThemePreference = 'system' | Scheme;

export interface Palette {
  bg: string;
  bgElevated: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  /** Gold fill for buttons, chips, tab Host button. Always paired with `onGold` text. */
  gold: string;
  goldPressed: string;
  /** Gold used for text and icons; darker in light mode for contrast. */
  goldText: string;
  goldDim: string;
  goldHairline: string;
  onGold: string;
  success: string;
  successDim: string;
  danger: string;
  dangerDim: string;
  live: string;
  glass: string;
  overlay: string;
  shadow: string;
  skeleton: string;
  skeletonHighlight: string;
  /** Over photos, video and the camera: identical in both themes because the backdrop is always dark. */
  onImage: string;
  onImageMuted: string;
  onImageGold: string;
  onImageHairline: string;
  onImageBorder: string;
  /** Dark glass behind chips/buttons on images; `scrimStrong` for panels and gradient ends. */
  scrim: string;
  scrimStrong: string;
  /** Black stage behind the camera and the fullscreen photo viewer. */
  stage: string;
  /** Text/icons on live, success and danger fills. */
  onStatus: string;
}

const onImage = {
  onImage: '#F6EFE3',
  onImageMuted: 'rgba(246,239,227,0.6)',
  onImageGold: '#D9BC6A',
  onImageHairline: 'rgba(201,168,76,0.5)',
  onImageBorder: 'rgba(246,239,227,0.12)',
  scrim: 'rgba(14,12,10,0.6)',
  scrimStrong: 'rgba(14,12,10,0.85)',
  stage: '#000000',
  onStatus: '#FFFFFF',
} as const;

export const palettes: Record<Scheme, Palette> = {
  dark: {
    bg: '#0E0C0A',
    bgElevated: '#14110E',
    surface: '#1A1612',
    surface2: '#221D18',
    surface3: '#2C261F',
    border: 'rgba(246,239,227,0.08)',
    borderStrong: 'rgba(246,239,227,0.16)',
    text: '#F6EFE3',
    textMuted: '#B3A895',
    textFaint: '#7C7263',
    gold: '#C9A84C',
    goldPressed: '#B39238',
    goldText: '#D9BC6A',
    goldDim: 'rgba(201,168,76,0.14)',
    goldHairline: 'rgba(201,168,76,0.45)',
    onGold: '#14110E',
    success: '#4EC98C',
    successDim: 'rgba(78,201,140,0.14)',
    danger: '#E8705F',
    dangerDim: 'rgba(232,112,95,0.14)',
    live: '#E8705F',
    glass: 'rgba(20,17,14,0.72)',
    overlay: 'rgba(0,0,0,0.6)',
    shadow: '#000000',
    skeleton: '#221D18',
    skeletonHighlight: '#2C261F',
    ...onImage,
  },
  light: {
    bg: '#F7F2E8',
    bgElevated: '#FBF8F1',
    surface: '#FFFDF8',
    surface2: '#F2EBDD',
    surface3: '#E8DFCE',
    border: 'rgba(28,22,14,0.09)',
    borderStrong: 'rgba(28,22,14,0.18)',
    text: '#1C160E',
    textMuted: '#5F5546',
    textFaint: '#958A78',
    gold: '#C9A84C',
    goldPressed: '#B39238',
    goldText: '#8A6A1F',
    goldDim: 'rgba(138,106,31,0.11)',
    goldHairline: 'rgba(138,106,31,0.4)',
    onGold: '#1C160E',
    success: '#2A8A5E',
    successDim: 'rgba(42,138,94,0.12)',
    danger: '#B8412E',
    dangerDim: 'rgba(184,65,46,0.1)',
    live: '#C2412F',
    glass: 'rgba(255,253,248,0.8)',
    overlay: 'rgba(28,22,14,0.45)',
    shadow: '#5A4A2A',
    skeleton: '#EDE5D6',
    skeletonHighlight: '#F6F0E4',
    ...onImage,
  },
};

/**
 * Display serif: DM Serif Display. Text: Loew Next is licensed separately; the brand kit
 * only ships a demo, so the app uses Montserrat until a licensed font file is added.
 */
export const fonts = {
  display: 'DMSerifDisplay_400Regular',
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
} as const;

export type TypeVariant =
  | 'display'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'bodyStrong'
  | 'callout'
  | 'caption'
  | 'overline'
  | 'button'
  | 'numeral';

export const type: Record<TypeVariant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42, letterSpacing: -0.3 },
  title1: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.2 },
  title2: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  title3: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26 },
  headline: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  callout: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.4, textTransform: 'uppercase' },
  button: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, letterSpacing: 0.2 },
  numeral: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
};

/** 8-point spacing scale (with a 4pt half step). */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const motion = {
  fast: 150,
  base: 250,
  slow: 420,
  celebrate: 900,
} as const;

export function shadow(level: 1 | 2 | 3, color: string): ViewStyle {
  const map = {
    1: { shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    2: { shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
    3: { shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  } as const;
  return { shadowColor: color, ...map[level] };
}

export interface Theme {
  scheme: Scheme;
  c: Palette;
  type: typeof type;
  space: typeof space;
  radius: typeof radius;
  motion: typeof motion;
  fonts: typeof fonts;
  reduceMotion: boolean;
}

export function buildTheme(scheme: Scheme, reduceMotion: boolean): Theme {
  return { scheme, c: palettes[scheme], type, space, radius, motion, fonts, reduceMotion };
}

export function resolveScheme(preference: ThemePreference, system: string | null | undefined): Scheme {
  if (preference === 'system') return system === 'light' ? 'light' : 'dark';
  return preference;
}

/** Map style for react-native-maps (Google provider): warm black or parchment, minimal POIs. */
export const mapStyles: Record<Scheme, object[]> = {
  dark: [
    { elementType: 'geometry', stylers: [{ color: '#16130F' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#9C907C' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0E0C0A' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A241D' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3A3127' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A0908' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#4A3F2E' }] },
  ],
  light: [
    { elementType: 'geometry', stylers: [{ color: '#F1E8D6' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#6B5D45' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#F7F2E8' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFBF2' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#E9D9B5' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#CFC3A8' }] },
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#C7B48C' }] },
  ],
};
