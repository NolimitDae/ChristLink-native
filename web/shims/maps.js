// Web build of react-native-maps (no web support): an empty panel. The Map tab is hidden on the website.
const React = require('react'); const { View } = require('react-native');
// Camera calls are no-ops so screens that move the map don't throw
const MapView = React.forwardRef((p, ref) => {
  React.useImperativeHandle(ref, () => ({ animateToRegion() {}, animateCamera() {}, fitToCoordinates() {}, fitToSuppliedMarkers() {} }), []);
  return React.createElement(View, { style: [{ backgroundColor: '#1b1a17' }, p.style] }, p.children);
});
module.exports = MapView; module.exports.default = MapView; module.exports.Marker = (p) => React.createElement(View, null, p.children); module.exports.PROVIDER_GOOGLE = 'google';
