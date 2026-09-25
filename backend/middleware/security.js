const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function sameOrigin({ storeOrigin, storeOrigins = [], storePreviewOrigin, adminOrigin }) {
  const allowed = new Set([...storeOrigins, storeOrigin, storePreviewOrigin, adminOrigin].filter(Boolean));
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    let sameRequestHost = false;
    if (origin) {
      try {
        const parsedOrigin = new URL(origin);
        const requestHost = (req.get('host') || '').toLowerCase();
        sameRequestHost = parsedOrigin.host.toLowerCase() === requestHost
          && (process.env.NODE_ENV !== 'production' || parsedOrigin.protocol === 'https:');
      } catch {}
    }
    if (!origin || (!allowed.has(origin) && !sameRequestHost)) {
      return res.status(403).json({ error: 'Invalid request origin.' });
    }
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
