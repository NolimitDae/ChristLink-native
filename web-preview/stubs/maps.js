// Web preview stand-in for react-native-maps (no web support): an empty dark panel.
const React = require('react'); const { View } = require('react-native');
const MapView = React.forwardRef((p, ref) => React.createElement(View, { ref, style: [{ backgroundColor: '#1b1a17' }, p.style] }, p.children));
module.exports = MapView; module.exports.default = MapView; module.exports.Marker = (p) => React.createElement(View, null, p.children); module.exports.PROVIDER_GOOGLE = 'google';
