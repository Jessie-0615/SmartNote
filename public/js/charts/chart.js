/* ---------------------------------------------------------------------------
   Lightweight Canvas Chart Renderer
   Bar charts and donut charts — no external dependencies
   --------------------------------------------------------------------------- */

/**
 * Get the current theme's CSS variable value
 */
function getThemeColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Render a vertical bar chart onto a canvas element
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{label: string, value: number}>} data
 * @param {Object} options
 * @param {string} [options.barColor=theme primary]
 * @param {string} [options.axisColor=theme text-tertiary]
 * @param {string} [options.labelColor=theme text-secondary]
 * @param {number} [options.fontSize=12]
 */
function renderBarChart(canvas, data, options = {}) {
  if (!data || !data.length) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#aeaeb2';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet', w / 2, h / 2);
    return;
  }

  const {
    barColor = getThemeColor('--primary') || '#E56A79',
    axisColor = getThemeColor('--text-tertiary') || '#aeaeb2',
    labelColor = getThemeColor('--text-secondary') || '#6e6e73',
    fontSize = 12,
  } = options;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width * dpr;
  const h = rect.height * dpr;

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const W = rect.width;
  const H = rect.height;
  const padLeft = 40;
  const padRight = 16;
  const padTop = 20;
  const padBottom = 40;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barCount = data.length;
  const barGap = Math.max(4, chartW / (barCount * 3));
  const barWidth = (chartW - barGap * (barCount + 1)) / barCount;

  // Y-axis
  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, padTop + chartH);
  ctx.lineTo(padLeft + chartW, padTop + chartH);
  ctx.stroke();

  // Y-axis labels (5 ticks)
  ctx.fillStyle = labelColor;
  ctx.font = `${fontSize}px -apple-system, sans-serif`;
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((maxVal / 4) * i);
    const y = padTop + chartH - (chartH / 4) * i;
    ctx.fillText(String(val), padLeft - 8, y + 4);
    // Grid line
    ctx.strokeStyle = '#e8e8ec';
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + chartW, y);
    ctx.stroke();
  }

  // Bars
  for (let i = 0; i < data.length; i++) {
    const x = padLeft + barGap + i * (barWidth + barGap);
    const barH = (data[i].value / maxVal) * chartH;
    const y = padTop + chartH - barH;

    // Bar with rounded top
    const radius = Math.min(4, barWidth / 2);
    ctx.fillStyle = barColor;
    ctx.beginPath();
    ctx.moveTo(x, y + barH);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.lineTo(x + barWidth - radius, y);
    ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
    ctx.lineTo(x + barWidth, y + barH);
    ctx.closePath();
    ctx.fill();

    // Value label on top
    if (data[i].value > 0) {
      ctx.fillStyle = labelColor;
      ctx.font = `bold ${fontSize - 1}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(data[i].value), x + barWidth / 2, y - 6);
    }
  }

  // X-axis labels
  ctx.fillStyle = labelColor;
  ctx.font = `${fontSize}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  const maxLabels = Math.floor(W / 60);
  const step = Math.ceil(data.length / maxLabels);

  for (let i = 0; i < data.length; i += step) {
    const x = padLeft + barGap + i * (barWidth + barGap) + barWidth / 2;
    ctx.save();
    ctx.translate(x, padTop + chartH + 10);
    if (data[i].label.length > 6) {
      ctx.rotate(-0.5);
    }
    ctx.fillText(data[i].label, 0, 0);
    ctx.restore();
  }
}

/**
 * Render a donut chart onto a canvas element
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{label: string, value: number, color: string}>} segments
 */
function renderDonutChart(canvas, segments) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#aeaeb2';
    ctx.font = '14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data yet', rect.width / 2, rect.height / 2);
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const size = Math.min(rect.width, rect.height);
  const w = size * dpr;
  const h = size * dpr;

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.4;
  const innerR = size * 0.22;

  let angle = -Math.PI / 2;

  for (const seg of segments) {
    if (seg.value === 0) continue;
    const sliceAngle = (seg.value / total) * Math.PI * 2;

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, angle, angle + sliceAngle);
    ctx.arc(cx, cy, innerR, angle + sliceAngle, angle, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();

    // Label percentage if slice is big enough
    if (seg.value / total > 0.08) {
      const midAngle = angle + sliceAngle / 2;
      const labelR = (outerR + innerR) / 2;
      const lx = cx + Math.cos(midAngle) * labelR;
      const ly = cy + Math.sin(midAngle) * labelR;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round((seg.value / total) * 100) + '%', lx, ly);
    }

    angle += sliceAngle;
  }

  // Center text: total count
  ctx.fillStyle = '#1d1d1f';
  ctx.font = 'bold 18px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(total), cx, cy - 4);
  ctx.fillStyle = '#6e6e73';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillText('Total', cx, cy + 14);

  // Return legend HTML
  let legendHtml = '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:12px">';
  for (const seg of segments) {
    legendHtml += `
      <span style="display:flex;align-items:center;gap:4px;font-size:12px;color:#6e6e73">
        <span style="width:10px;height:10px;border-radius:2px;background:${seg.color};display:inline-block"></span>
        ${seg.label}: ${seg.value}
      </span>
    `;
  }
  legendHtml += '</div>';

  // Attach legend to a sibling element or return as string
  const existing = canvas.parentElement.querySelector('.chart-legend');
  if (existing) existing.remove();
  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.innerHTML = legendHtml;
  canvas.parentElement.appendChild(legend);
}
