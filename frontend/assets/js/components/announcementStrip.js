const PATTERNS = new Set(['solid', 'stripes', 'dots', 'checker', 'waves']);

export function renderAnnouncementStrip(settings) {
  const header = document.getElementById('site-header');
  if (!header) return;
  let strip = document.getElementById('storeAnnouncement');
  if (!settings.announcementEnabled || !String(settings.announcementText || '').trim()) {
    strip?.remove();
    return;
  }

  if (!strip) {
    strip = document.createElement('div');
    strip.id = 'storeAnnouncement';
    strip.className = 'store-announcement';
    strip.setAttribute('role', 'region');
    strip.setAttribute('aria-label', 'Store announcement');
    header.parentNode.insertBefore(strip, header);
  }
  const background = /^#[0-9a-f]{6}$/i.test(settings.announcementBackgroundColor || '')
    ? settings.announcementBackgroundColor
    : '#17251e';
  const foreground = /^#[0-9a-f]{6}$/i.test(settings.announcementTextColor || '')
    ? settings.announcementTextColor
    : '#ffffff';
  const pattern = PATTERNS.has(settings.announcementPattern) ? settings.announcementPattern : 'solid';
  strip.dataset.pattern = pattern;
  strip.style.setProperty('--announcement-bg', background);
  strip.style.setProperty('--announcement-fg', foreground);

  const track = document.createElement('div');
  track.className = 'store-announcement__track';
  for (let index = 0; index < 2; index += 1) {
    const group = document.createElement('span');
    group.className = 'store-announcement__group';
    if (index) group.setAttribute('aria-hidden', 'true');
    for (let repeat = 0; repeat < 3; repeat += 1) {
      const message = document.createElement('span');
      message.textContent = String(settings.announcementText).slice(0, 240);
      if (repeat) message.setAttribute('aria-hidden', 'true');
      group.append(message);
      const separator = document.createElement('span');
      separator.className = 'store-announcement__separator';
      separator.setAttribute('aria-hidden', 'true');
      separator.textContent = '✦';
      group.append(separator);
    }
    track.append(group);
  }
  strip.replaceChildren(track);
}
