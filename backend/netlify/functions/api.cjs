// Netlify's generated Lambda entry is CommonJS. Dynamically import the ESM
// application so the CommonJS loader does not try to require an ES module.
let handlerPromise;
exports.handler = async (event, context) => {
  handlerPromise ??= import('../../server.js').then((module) => module.handler);
  const handler = await handlerPromise;
  return handler(event, context);
};
