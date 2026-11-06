// Run every test in a time zone with daylight saving, so date math that assumes 24-hour days fails here.
module.exports = () => {
  process.env.TZ = 'America/New_York';
};
