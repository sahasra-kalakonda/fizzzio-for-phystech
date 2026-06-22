let lineChartCanvas = null;
let radarChartCanvas = null;
let animationFrameId = null;

// Initialize charts
export function initCharts(activities) {
  lineChartCanvas = document.getElementById('intensityChart');
  radarChartCanvas = document.getElementById('balanceChart');
  
  if (!lineChartCanvas || !radarChartCanvas) return;

  // Set high DPI support
  resizeCanvas(lineChartCanvas);
  resizeCanvas(radarChartCanvas);

  renderCharts(activities);
  
  // Listen for resize
  window.addEventListener('resize', () => {
    resizeCanvas(lineChartCanvas);
    resizeCanvas(radarChartCanvas);
    renderCharts(activities);
  });
}

// Update charts with new data
export function updateCharts(activities) {
  renderCharts(activities);
}

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
}

function renderCharts(activities) {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  
  // Prepare data
  const lineData = getPast7DaysData(activities);
  const radarData = getRadarData(activities);

  // Animate drawing
  let progress = 0;
  function animate() {
    progress += 0.04;
    if (progress > 1) progress = 1;

    drawLineChart(lineChartCanvas, lineData, progress);
    drawRadarChart(radarChartCanvas, radarData, progress);

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    }
  }
  animate();
}

// Process last 7 days of calorie data
function getPast7DaysData(activities) {
  const days = [];
  const labels = [];
  const now = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    // Day Label (e.g. 'Mon')
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    labels.push(dayLabel);
    
    // Sum calories for this date
    const dailyCal = activities
      .filter(a => a.date.startsWith(dateStr))
      .reduce((sum, curr) => sum + curr.calories, 0);
      
    days.push(dailyCal);
  }

  // Ensure we have some default shapes if everything is 0
  const max = Math.max(...days, 500); // minimum scale of 500 kcal

  return { labels, values: days, max };
}

// Process Category counts for Radar
function getRadarData(activities) {
  const categories = {
    fitness: { label: 'Fitness & Strength', val: 0 },
    cardio: { label: 'Cardio & Sports', val: 0 },
    flexibility: { label: 'Flexibility & Mindful', val: 0 },
    recreation: { label: 'Recreation & Casual', val: 0 }
  };

  activities.forEach(a => {
    if (categories[a.category] !== undefined) {
      // Weight by frequency and duration slightly
      categories[a.category].val += 1 + (a.duration / 30);
    }
  });

  const keys = Object.keys(categories);
  const labels = keys.map(k => categories[k].label);
  const values = keys.map(k => categories[k].val);
  
  // Normalize values (0 to 10 scale for chart visualization)
  const maxVal = Math.max(...values, 4);
  const normalized = values.map(v => (v / maxVal) * 100);

  return { labels, values: normalized };
}

// Draw Line Chart
function drawLineChart(canvas, data, progress) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Setup padding
  const paddingLeft = 50 * dpr;
  const paddingRight = 20 * dpr;
  const paddingTop = 30 * dpr;
  const paddingBottom = 40 * dpr;
  
  const graphWidth = w - paddingLeft - paddingRight;
  const graphHeight = h - paddingTop - paddingBottom;

  // Draw Grid Lines (Y axis ticks)
  const ticks = 4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1 * dpr;
  ctx.fillStyle = '#6b7280';
  ctx.font = `${10 * dpr}px Outfit`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= ticks; i++) {
    const yVal = data.max * (i / ticks);
    const y = h - paddingBottom - (graphHeight * (i / ticks));
    
    // Grid line
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - paddingRight, y);
    ctx.stroke();

    // Text label
    ctx.fillText(`${Math.round(yVal)}`, paddingLeft - 10 * dpr, y);
  }

  // Draw X axis labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const pointsCount = data.values.length;
  const stepX = graphWidth / (pointsCount - 1);
  const points = [];

  for (let i = 0; i < pointsCount; i++) {
    const x = paddingLeft + i * stepX;
    const yVal = data.values[i];
    const y = h - paddingBottom - (graphHeight * (yVal / data.max)) * progress;
    points.push({ x, y });

    // X Label
    ctx.fillText(data.labels[i], x, h - paddingBottom + 12 * dpr);
  }

  // Draw Gradient area under line
  if (points.length > 0) {
    const grad = ctx.createLinearGradient(0, paddingTop, 0, h - paddingBottom);
    grad.addColorStop(0, 'rgba(168, 85, 247, 0.35)'); // Primary Neon Purple
    grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');   // Info Electric Cyan

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(points[0].x, h - paddingBottom);
    
    // Bezier curve approximation
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + stepX / 2;
      const cpY1 = p0.y;
      const cpX2 = p1.x - stepX / 2;
      const cpY2 = p1.y;
      ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, p1.x, p1.y);
    }
    ctx.lineTo(points[points.length - 1].x, h - paddingBottom);
    ctx.closePath();
    ctx.fill();
  }

  // Draw Line path
  if (points.length > 0) {
    ctx.strokeStyle = 'hsl(270, 85%, 65%)'; // Purple neon line
    ctx.lineWidth = 3 * dpr;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + stepX / 2;
      const cpY1 = p0.y;
      const cpX2 = p1.x - stepX / 2;
      const cpY2 = p1.y;
      ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, p1.x, p1.y);
    }
    ctx.stroke();
  }

  // Draw Data Nodes (circles)
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'hsl(190, 90%, 50%)'; // Cyan glow border
  ctx.lineWidth = 2 * dpr;
  for (let i = 0; i < points.length; i++) {
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, 4 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// Draw Radar Chart
function drawRadarChart(canvas, data, progress) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2 - 10 * dpr;
  const maxRadius = Math.min(w, h) * 0.32;

  const numAxes = data.values.length;
  const angleStep = (Math.PI * 2) / numAxes;

  // Draw Background Concentric Webs (Polygons)
  const rings = 4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1 * dpr;
  
  for (let r = 1; r <= rings; r++) {
    const radius = maxRadius * (r / rings);
    ctx.beginPath();
    for (let i = 0; i < numAxes; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // Draw Axes Radiants
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  for (let i = 0; i < numAxes; i++) {
    const angle = i * angleStep - Math.PI / 2;
    const x = cx + Math.cos(angle) * maxRadius;
    const y = cy + Math.sin(angle) * maxRadius;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Draw Labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = `${10 * dpr}px Outfit`;
    ctx.textAlign = 'center';
    
    // Push labels slightly outside radius
    const textDist = maxRadius + 18 * dpr;
    const lx = cx + Math.cos(angle) * textDist;
    const ly = cy + Math.sin(angle) * textDist;

    // Adjust vertical alignment depending on direction
    if (Math.abs(lx - cx) < 5) { // Center vertical
      ctx.textBaseline = ly < cy ? 'bottom' : 'top';
    } else {
      ctx.textBaseline = 'middle';
    }
    
    ctx.fillText(data.labels[i], lx, ly);
  }

  // Plot Data Polygon
  const dataPoints = [];
  for (let i = 0; i < numAxes; i++) {
    const angle = i * angleStep - Math.PI / 2;
    // Map value (0 to 100) to radius
    const valRatio = (data.values[i] / 100) * progress;
    const radius = maxRadius * valRatio;
    
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    dataPoints.push({ x, y });
  }

  // Draw Data Fill
  if (dataPoints.length > 0) {
    ctx.fillStyle = 'rgba(6, 182, 212, 0.25)'; // Neon cyan fill
    ctx.strokeStyle = 'hsl(190, 90%, 50%)';   // Cyan border
    ctx.lineWidth = 2 * dpr;

    ctx.beginPath();
    ctx.moveTo(dataPoints[0].x, dataPoints[0].y);
    for (let i = 1; i < dataPoints.length; i++) {
      ctx.lineTo(dataPoints[i].x, dataPoints[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Small dots on joints
    ctx.fillStyle = '#fff';
    for (let i = 0; i < dataPoints.length; i++) {
      ctx.beginPath();
      ctx.arc(dataPoints[i].x, dataPoints[i].y, 3 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
