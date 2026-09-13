// Minimal, dependency-free chart rendering. Renders a line chart (with
// optional area fill) or a bar chart as raw SVG sized to its container.
export function lineChart(data, { width = 720, height = 240, color = 'var(--a-primary)', valueKey = 'revenue', labelKey = 'date' } = {}) {
  if (!data.length) return '<p style="color:var(--a-muted);font-size:.85rem">No data for this range.</p>';
  const pad = { top: 16, right: 12, bottom: 24, left: 12 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  const min = Math.min(...data.map((d) => d[valueKey]), 0);
  const range = max - min || 1;
  const stepX = w / (data.length - 1 || 1);

  const points = data.map((d, i) => {
    const x = pad.left + i * stepX;
    const y = pad.top + h - ((d[valueKey] - min) / range) * h;
    return [x, y];
  });
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1][0].toFixed(1)} ${pad.top + h} L ${points[0][0].toFixed(1)} ${pad.top + h} Z`;

  const labelEvery = Math.ceil(data.length / 6);
  const labels = data.map((d, i) => (i % labelEvery === 0 || i === data.length - 1
    ? `<text x="${points[i][0].toFixed(1)}" y="${height - 4}" font-size="10" fill="var(--a-muted)" text-anchor="middle">${d[labelKey].slice(5)}</text>`
    : '')).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Chart">
      <path d="${areaD}" fill="${color}" opacity="0.08" stroke="none" />
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      ${labels}
    </svg>
  `;
}

export function barChart(data, { width = 720, height = 240, color = 'var(--a-primary)', valueKey = 'revenue', labelKey = 'name' } = {}) {
  if (!data.length) return '<p style="color:var(--a-muted);font-size:.85rem">No data.</p>';
  const pad = { top: 16, right: 12, bottom: 40, left: 12 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  const gap = w / data.length * 0.3;
  const barW = (w / data.length) - gap;

  const bars = data.map((d, i) => {
    const x = pad.left + i * (barW + gap) + gap / 2;
    const barH = (d[valueKey] / max) * h;
    const y = pad.top + h - barH;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="3" fill="${color}" />
      <text x="${(x + barW / 2).toFixed(1)}" y="${height - 22}" font-size="10" fill="var(--a-muted)" text-anchor="middle">${d[labelKey].length > 12 ? d[labelKey].slice(0, 11) + '…' : d[labelKey]}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Bar chart">${bars}</svg>`;
}
