module.exports = function (api) {
  const isTest = api.env('test');
  api.cache(!isTest);

  if (isTest) {
    // Skip NativeWind in Jest — it requires react-native-worklets which is unavailable in tests
    return {
      presets: ['babel-preset-expo'],
    };
  }

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
