import { query } from './db.js';

let pendingPageViews = 0;
let flushing = false;

export function queueStorefrontPageView() {
  pendingPageViews += 1;
}

export async function flushStorefrontPageViews() {
  if (flushing || pendingPageViews === 0) return;
  flushing = true;
  const batch = pendingPageViews;
  pendingPageViews = 0;
  try {
    await query(
      'UPDATE storefront_metrics SET total_views = total_views + $1, updated_at = NOW() WHERE id = 1',
      [batch],
    );
  } catch (error) {
    pendingPageViews += batch;
    throw error;
  } finally {
    flushing = false;
  }
}

export async function cleanupStorefrontPresence() {
  await query(
    "DELETE FROM storefront_presence WHERE last_seen_at < NOW() - INTERVAL '2 minutes'",
  );
}
