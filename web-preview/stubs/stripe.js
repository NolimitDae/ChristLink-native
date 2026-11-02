// Web preview stand-in for @stripe/stripe-react-native: checkout explains payments are phone-only.
const React = require('react'); const { View } = require('react-native');
const noop = async () => ({ error: { code: 'Unavailable', message: 'Payments work in the phone app. This web preview uses sample data.' } });
module.exports = { StripeProvider: ({ children }) => children,
  useStripe: () => ({ initPaymentSheet: noop, presentPaymentSheet: noop, confirmPayment: noop, createPaymentMethod: noop, isPlatformPaySupported: async () => false }),
  CardField: (p) => React.createElement(View, { style: [{ height: 50, borderWidth: 1, borderColor: '#555', borderRadius: 10 }, p.style] }),
  PaymentSheetError: { Canceled: 'Canceled', Failed: 'Failed', Timeout: 'Timeout' } };
