function seeded(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

export function revenueSeries(days = 30) {
  const rand = seeded(days * 7);
  const out = [];
  let base = 8000;
  for (let i = days - 1; i >= 0; i--) {
    base += (rand() - 0.45) * 1500;
    base = Math.max(2000, base);
    const date = new Date(Date.now() - i * 86400000);
    out.push({ date: date.toISOString().slice(0, 10), revenue: Math.round(base), orders: Math.round(base / 950) });
  }
  return out;
}

export function topProducts() {
  return [
    { name: 'Knitted Embroidered Polo', unitsSold: 164, revenue: 103320 },
    { name: 'Embroidered Tank Top', unitsSold: 141, revenue: 35250 },
    { name: 'Men Tank Top', unitsSold: 98, revenue: 19600 },
    { name: 'Nuv Sweatpants', unitsSold: 76, revenue: 38000 },
  ];
}

export function topCategories() {
  return [
    { name: 'Polos', revenue: 103320 },
    { name: 'Tank Tops', revenue: 54850 },
    { name: 'Sweatpants', revenue: 38000 },
  ];
}
