const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function sameOrigin({ storeOrigin, storePreviewOrigin, adminOrigin }) {
  const allowed = new Set([storeOrigin, storePreviewOrigin, adminOrigin].filter(Boolean));
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    if (!origin || !allowed.has(origin)) return res.status(403).json({ error: 'Invalid request origin.' });
    next();
  };
}

export function notFound(req, res) { res.status(404).json({ error: 'Not found.' }); }

export function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(error);
  const status = error.status || (error.name === 'ZodError' ? 400 : 500);
  const message = error.name === 'ZodError' ? 'Invalid request data.' : status >= 500 ? 'Internal server error.' : error.message;
  res.status(status).json({ error: message });
}
