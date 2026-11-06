const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web build (the website and the demo preview): native-only modules resolve to web versions in web/shims/.
// iOS/Android are untouched. Stripe is a real Stripe.js implementation; the rest are storage/no-op stand-ins.
const WEB_STUBS = {
  '@stripe/stripe-react-native': 'web/shims/stripe.tsx',
  'react-native-maps': 'web/shims/maps.js',
  'expo-secure-store': 'web/shims/securestore.js',
  'expo-notifications': 'web/shims/notifications.js',
  '@react-native-community/datetimepicker': 'web/shims/datetimepicker.tsx',
};
const resolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) =>
  platform === 'web' && WEB_STUBS[moduleName]
    ? { type: 'sourceFile', filePath: path.join(__dirname, WEB_STUBS[moduleName]) }
    : (resolve ?? context.resolveRequest)(context, moduleName, platform);

module.exports = config;
