import type { Theme } from './theme';

/**
 * Theme → Stripe Connect embedded components appearance (same variable names on web and native), so payout setup
 * looks like the rest of Christ Link: warm ground, ivory text, gold primary buttons with dark text.
 */
export function connectAppearance(t: Theme, fontFamily?: string) {
  const c = t.c;
  return {
    overlays: 'drawer' as const,
    variables: {
      ...(fontFamily ? { fontFamily } : null),
      fontSizeBase: '16px',
      spacingUnit: '10px',
      borderRadius: `${t.radius.md}px`,
      colorPrimary: c.goldText,
      colorBackground: c.bg,
      colorText: c.text,
      colorSecondaryText: c.textMuted,
      colorBorder: c.border,
      colorDanger: c.danger,
      buttonPrimaryColorBackground: c.gold,
      buttonPrimaryColorBorder: c.gold,
      buttonPrimaryColorText: c.onGold,
      buttonSecondaryColorBackground: c.surface,
      buttonSecondaryColorText: c.text,
      buttonSecondaryColorBorder: c.border,
      formAccentColor: c.gold,
      actionPrimaryColorText: c.goldText,
      actionSecondaryColorText: c.textMuted,
      offsetBackgroundColor: c.surface,
      formBackgroundColor: c.surface,
      formHighlightColorBorder: c.gold,
    },
  };
}

