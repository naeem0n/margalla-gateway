const app = require('../server/index.cjs');
module.exports = app.default || app;
