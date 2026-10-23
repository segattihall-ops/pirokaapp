// Redirect `server-only` to an empty module so server route handlers can be imported
// from node:test. Next's react-server export condition also empties this package,
// but that condition breaks React itself outside the Next bundler.
const Module = require('module');
const path = require('path');

const empty = path.join(__dirname, 'server-only-empty.cjs');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'server-only') return empty;
  return resolve.call(this, request, parent, isMain, options);
};
