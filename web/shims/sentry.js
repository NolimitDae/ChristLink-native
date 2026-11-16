// Web build of @sentry/react-native (metro.config.js maps the package here for web only; iOS/Android use the real
// SDK). The full SDK was about a third of the website's script (1.5 MB before compression) and delayed the first
// paint, so the website doesn't load it: errors still go to the browser console (lib/logger.ts) and the app's
// ErrorBoundary. Only the calls the app makes are here.
const noop = () => undefined;

module.exports = {
  init: noop,
  wrap: component => component,
  setUser: noop,
  setTag: noop,
  setContext: noop,
  addBreadcrumb: noop,
  captureException: noop,
  captureMessage: noop,
  withScope: fn => fn({ setTag: noop, setExtra: noop, setLevel: noop, setContext: noop }),
};
