/** Web builds of native modules (web/shims): pure parts. */
jest.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({}) }));
import { appearanceFor, cardStyleFor } from '../../web/shims/stripeAppearance';
import { fromInputValue, toInputValue } from '../../web/shims/datetimepicker';

describe('Stripe web appearance', () => {
  const sheet = {
    style: 'alwaysDark' as const,
    appearance: {
      shapes: { borderRadius: 14 },
      colors: { primary: '#C9A84C', componentBackground: '#1A1612', componentText: '#F6EFE3', error: '#E5484D', componentBorder: '#3A332A' },
    },
  };

  it('maps the in-app PaymentSheet look onto Stripe Elements', () => {
    const { appearance, fonts } = appearanceFor(sheet, 'light');
    expect(appearance.theme).toBe('night'); // alwaysDark wins over the system scheme
    expect(appearance.variables).toMatchObject({
      colorPrimary: '#C9A84C',
      colorBackground: '#1A1612',
      colorText: '#F6EFE3',
      colorDanger: '#E5484D',
      borderRadius: '14px',
    });
    expect(appearance.variables?.fontFamily).toMatch(/Instrument Sans/);
    expect(appearance.rules?.['.Input']).toMatchObject({ border: '1px solid #3A332A' });
    expect(fonts[0].cssSrc).toMatch(/^https:\/\/fonts\.googleapis\.com\//);
  });

  it('follows the app scheme when the style is automatic', () => {
    expect(appearanceFor({ style: 'automatic' }, 'light').appearance.theme).toBe('stripe');
    expect(appearanceFor({ style: 'automatic' }, 'dark').appearance.theme).toBe('night');
  });

  it('styles the card field like the app’s inputs', () => {
    const style = cardStyleFor({ textColor: '#111', placeholderColor: '#777', textErrorColor: '#c00', fontSize: 15 });
    expect(style?.base).toMatchObject({ color: '#111', fontSize: '15px', '::placeholder': { color: '#777' } });
    expect(style?.invalid).toMatchObject({ color: '#c00' });
  });
});

describe('date/time picker on the web', () => {
  const base = new Date(2026, 10, 6, 19, 30);

  it('formats local values for the browser input', () => {
    expect(toInputValue(base, 'date')).toBe('2026-11-06');
    expect(toInputValue(base, 'time')).toBe('19:30');
    expect(toInputValue(base, 'datetime')).toBe('2026-11-06T19:30');
  });

  it('parses input values, keeping the parts that mode does not edit', () => {
    expect(fromInputValue('2026-12-24', 'date', base)).toEqual(new Date(2026, 11, 24, 19, 30));
    expect(fromInputValue('08:05', 'time', base)).toEqual(new Date(2026, 10, 6, 8, 5));
    expect(fromInputValue('2027-01-02T09:15', 'datetime', base)).toEqual(new Date(2027, 0, 2, 9, 15));
  });

  it('ignores incomplete input', () => {
    expect(fromInputValue('', 'date', base)).toBeNull();
    expect(fromInputValue('2026-12-24', 'datetime', base)).toBeNull();
    expect(fromInputValue('7', 'time', base)).toBeNull();
  });
});
