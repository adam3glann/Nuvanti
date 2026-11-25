export function getStoreTheme() {
  return "dark";
}

export function applyStoreTheme() {
  const value = "dark";
  document.documentElement.dataset.theme = value;
  document.documentElement.style.colorScheme = value;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  meta.content = value === "dark" ? "#111714" : "#E9E6DE";
  return value;
}

export function toggleStoreTheme() {
  applyStoreTheme();
  return "dark";
}
