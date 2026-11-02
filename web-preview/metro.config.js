const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web preview only (docs/WEB-PREVIEW.md): native-only modules resolve to small stand-ins. iOS/Android are untouched.
const WEB_STUBS = {
  '@stripe/stripe-react-native': 'web-preview/stubs/stripe.js',
  'react-native-maps': 'web-preview/stubs/maps.js',
  'expo-secure-store': 'web-preview/stubs/securestore.js',
  'expo-notifications': 'web-preview/stubs/notifications.js',
};
const resolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) =>
  platform === 'web' && WEB_STUBS[moduleName]
    ? { type: 'sourceFile', filePath: path.join(__dirname, WEB_STUBS[moduleName]) }
    : (resolve ?? context.resolveRequest)(context, moduleName, platform);

module.exports = config;
