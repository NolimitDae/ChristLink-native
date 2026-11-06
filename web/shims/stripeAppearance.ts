import type { Appearance, StripeCardElementOptions } from '@stripe/stripe-js';

/** The subset of the native PaymentSheet appearance the app passes (components/event/CheckoutSheet.tsx). */
export interface SheetAppearance {
  shapes?: { borderRadius?: number };
  colors?: Partial<
    Record<
      | 'primary'
      | 'background'
      | 'componentBackground'
      | 'componentBorder'
      | 'componentDivider'
      | 'primaryText'
      | 'secondaryText'
      | 'componentText'
      | 'placeholderText'
      | 'icon'
      | 'error',
      string
    >
  >;
  primaryButton?: { colors?: { background?: string; text?: string }; shapes?: { borderRadius?: number } };
}

const TEXT_FONT = '"Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
// Stripe's fields live in their own iframe, so the app's text face is loaded there separately
const FONTS = [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap' }];

/** Native PaymentSheet appearance → Stripe Elements options, so the web dialog matches the app's look. */
export function appearanceFor(
  p: { style?: 'alwaysDark' | 'alwaysLight' | 'automatic'; appearance?: SheetAppearance },
  scheme: 'light' | 'dark',
): { appearance: Appearance; fonts: typeof FONTS } {
  const c = p.appearance?.colors ?? {};
  const dark = p.style === 'alwaysDark' || (p.style !== 'alwaysLight' && scheme === 'dark');
  const radius = p.appearance?.shapes?.borderRadius;
  const variables: NonNullable<Appearance['variables']> = { fontFamily: TEXT_FONT, fontSizeBase: '16px' };
  if (c.primary) variables.colorPrimary = c.primary;
  if (c.componentBackground) variables.colorBackground = c.componentBackground;
  if (c.componentText) variables.colorText = c.componentText;
  if (c.secondaryText) variables.colorTextSecondary = c.secondaryText;
  if (c.placeholderText) variables.colorTextPlaceholder = c.placeholderText;
  if (c.error) variables.colorDanger = c.error;
  if (c.icon) variables.colorIcon = c.icon;
  if (radius !== undefined) variables.borderRadius = `${radius}px`;
  return {
    appearance: {
      theme: dark ? 'night' : 'stripe',
      variables,
      rules: c.componentBorder ? { '.Input': { border: `1px solid ${c.componentBorder}`, boxShadow: 'none' }, '.Tab': { border: `1px solid ${c.componentBorder}` } } : undefined,
    },
    fonts: FONTS,
  };
}

/** Native CardField cardStyle → the card Element's style. */
export function cardStyleFor(s?: {
  backgroundColor?: string;
  textColor?: string;
  placeholderColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  cursorColor?: string;
  textErrorColor?: string;
  fontSize?: number;
}): StripeCardElementOptions['style'] {
  return {
    base: {
      color: s?.textColor,
      iconColor: s?.textColor,
      fontFamily: TEXT_FONT,
      fontSize: `${s?.fontSize ?? 16}px`,
      lineHeight: '50px',
      '::placeholder': { color: s?.placeholderColor },
    },
    invalid: { color: s?.textErrorColor, iconColor: s?.textErrorColor },
  };
}
