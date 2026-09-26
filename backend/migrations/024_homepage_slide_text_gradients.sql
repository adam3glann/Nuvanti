ALTER TABLE homepage_slides
  ADD COLUMN IF NOT EXISTS text_gradients JSONB NOT NULL DEFAULT '{"all":{"enabled":true,"start":"#83a88a","end":"#f5f2eb"},"eyebrow":{"mode":"inherit","start":"#83a88a","end":"#f5f2eb"},"title":{"mode":"inherit","start":"#83a88a","end":"#f5f2eb"},"description":{"mode":"inherit","start":"#83a88a","end":"#f5f2eb"},"button":{"mode":"inherit","start":"#83a88a","end":"#f5f2eb"}}'::jsonb;

UPDATE homepage_slides
SET text_gradients = jsonb_build_object(
  'all', jsonb_build_object('enabled', true, 'start', title_gradient_start, 'end', title_gradient_end),
  'eyebrow', jsonb_build_object('mode', 'inherit', 'start', '#83a88a', 'end', '#f5f2eb'),
  'title', jsonb_build_object(
    'mode', CASE WHEN title_gradient_enabled THEN 'inherit' ELSE 'solid' END,
    'start', title_gradient_start, 'end', title_gradient_end
  ),
  'description', jsonb_build_object('mode', 'inherit', 'start', '#83a88a', 'end', '#f5f2eb'),
  'button', jsonb_build_object('mode', 'inherit', 'start', '#83a88a', 'end', '#f5f2eb')
);
