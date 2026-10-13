// Express 4 does not forward rejected promises from async route handlers.
// Forward them to Express's error middleware so a bad request or failed query
// returns an HTTP error instead of becoming an unhandled rejection.
import Layer from 'express/lib/router/layer.js';

if (!Layer.prototype.__nuvantiAsyncPatched) {
  Layer.prototype.handle_request = function handleRequest(req, res, next) {
    const handler = this.handle;
    if (handler.length > 3) return next();
    try {
      const result = handler(req, res, next);
      if (result && typeof result.catch === 'function') result.catch(next);
    } catch (error) {
      next(error);
    }
  };
  Layer.prototype.__nuvantiAsyncPatched = true;
}
