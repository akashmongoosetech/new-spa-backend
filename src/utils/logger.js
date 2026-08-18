import env from '../config/env.js';

function fmt(level, scope, msg) {
  const ts = new Date().toISOString();
  return `[${ts}] ${level} [${scope}] ${msg}`;
}

export const logger = {
  info: (scope, msg) => {
    if (env.isProduction) return;
    console.log(fmt('INFO', scope, msg));
  },
  warn: (scope, msg) => console.warn(fmt('WARN', scope, msg)),
  error: (scope, msg, err) => {
    console.error(fmt('ERROR', scope, msg));
    if (err && err.stack) console.error(err.stack);
  },
};

export default logger;