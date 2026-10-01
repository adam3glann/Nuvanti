const THEME_KEY = 'nuvanti-store-theme';

export function getStoreTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }
}

export function applyStoreTheme(theme = getStoreTheme()) {
  const value = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = value;
  document.documentElement.style.colorScheme = value;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = value === 'dark' ? '#111714' : '#E9E6DE';
  return value;
}

export function toggleStoreTheme() {
  const value = getStoreTheme() === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem(THEME_KEY, value); } catch { /* The current page still switches if storage is unavailable. */ }
  applyStoreTheme(value);
  return value;
}
