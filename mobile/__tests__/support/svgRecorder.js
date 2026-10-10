// react-native-svg drawn as plain host elements that keep their props, for
// tests that read chart geometry back. Lives in its own module because a
// jest.mock factory may not reach the createElement call NativeWind rewrites.
const { createElement } = require("react");

const host = (name) => {
  const C = (props) => createElement(`svg-${name}`, props, props.children);
  C.displayName = `svg-${name}`;
  return C;
};

module.exports = new Proxy({ __esModule: true, default: host("root") }, {
  get: (t, k) => (k in t ? t[k] : host(String(k).toLowerCase())),
});
