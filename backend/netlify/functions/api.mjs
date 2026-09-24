// Netlify runs this one Express gateway for both API requests and the
// separately protected admin hostname. Set NUVANTI_NETLIFY_FUNCTION=true in
// the Netlify environment before deploying.
import { handler } from '../../server.js';

export { handler };
