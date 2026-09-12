const bundled = require('../dist/vercel-api.cjs');
module.exports = bundled.default || bundled;
