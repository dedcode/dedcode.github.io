(() => {
  'use strict';
  const M = window.KMeansModel;
  const $ = id => document.getElementById(id);
  const plot = $('plot');
  const letters = ['a', 'b', 'c', 'd', 'e', 'f'];
  const color = i => `var(--${letters[i]})`;
  const clone = values => values.map(p => ({ ...p }));
  const clamp = v => Math.max(0, Math.min(10, v));
  const fmt = n => n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const PX = x => 44 + x * 53.2;
  const PY = y => 552 - y * 53.2;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let dataSeed = 42, centerSeed = 11;
  let points = M.generate(60, 'blobs', dataSeed);
  let centroids = [], initial = [], labels = null, counts = [], trails = [];
  let phase = 'assign', lastAction = 'start', iterations = 0, changed = 0, maxShift = 0;
  let history = [], empty = [], running = false, timer = null, animation = null, drag = null;

  function svg(name, attrs = {}, text) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function stop() {
    running = false;
    clearTimeout(timer);
    timer = null;
    $('play').textContent = '▶ Play';
    $('play').setAttribute('aria-pressed', 'false');
  }
  function cancelAnimation() {
    if (animation !== null) cancelAnimationFrame(animation);
    animation = null;
  }
  function resetRun(startingCenters) {
    stop();
    cancelAnimation();
    centroids = clone(startingCenters);
    initial = clone(startingCenters);
    trails = centroids.map(c => [{ ...c }]);
    labels = null;
    counts = centroids.map(() => 0);
    history = []; empty = [];
    phase = 'assign'; lastAction = 'start'; iterations = 0; changed = 0; maxShift = 0;
    render();
  }
  function initialize() {
    resetRun(M.initialize(points, Number($('k').value), $('initialization').value, centerSeed));
    rebuildEditor();
  }
  function regenerate() {
    points = M.generate(Number($('count').value), $('dataset').value, dataSeed);
    initialize();
  }
  function schedule() {
    clearTimeout(timer);
    if (running && phase !== 'done') timer = setTimeout(step, Number($('speed').value));
  }
  function step() {
    clearTimeout(timer);
    if (phase === 'done' || animation !== null || drag) return;
    if (phase === 'assign') {
      const result = M.assign(points, centroids);
      const previous = labels;
      changed = previous ? result.labels.reduce((n, c, i) => n + Number(c !== previous[i]), 0) : points.length;
      labels = result.labels; counts = result.counts;
      empty = counts.map((n, i) => n === 0 ? i : -1).filter(i => i >= 0);
      history.push({ value: result.inertia, label: `Assign ${iterations + 1}`, kind: 'assign' });
      lastAction = 'assign';
      phase = previous && changed === 0 ? 'done' : 'move';
      if (phase === 'done') stop();
      render();
      announce();
      schedule();
    } else {
      const old = clone(centroids);
      const result = M.update(points, labels, centroids);
      centroids = result.centroids; counts = result.counts; empty = result.empty; maxShift = result.maxShift;
      iterations++;
      centroids.forEach((c, i) => trails[i].push({ ...c }));
      history.push({ value: M.inertia(points, labels, centroids), label: `Move ${iterations}`, kind: 'move' });
      phase = 'assign'; lastAction = 'move';
      render();
      announce();
      if (reducedMotion.matches || maxShift < 0.000001) { schedule(); return; }
      const start = performance.now();
      const duration = Math.min(500, Number($('speed').value) * 0.7);
      const animate = now => {
        const progress = Math.min(1, (now - start) / duration);
        const t = 1 - Math.pow(1 - progress, 3);
        drawPlot(centroids.map((c, i) => ({ x: old[i].x + (c.x - old[i].x) * t, y: old[i].y + (c.y - old[i].y) * t })));
        if (progress < 1) animation = requestAnimationFrame(animate);
        else { animation = null; renderControls(); schedule(); }
      };
      animation = requestAnimationFrame(animate);
      renderControls();
    }
  }
  function announce() {
    $('announcement').textContent = `${$('stage-title').textContent}. ${$('progress-detail').textContent} SSE ${$('inertia').textContent}.`;
  }
  function renderControls() {
    $('step').textContent = phase === 'done' ? 'Converged ✓' : phase === 'assign' ? 'Assign points →' : 'Move centroids →';
    $('step').disabled = phase === 'done' || running || animation !== null;
    $('play').disabled = phase === 'done';
    $('play').textContent = running ? 'Ⅱ Pause' : '▶ Play';
    $('play').setAttribute('aria-pressed', String(running));
    $('phase-assign').className = phase === 'assign' ? 'active' : phase === 'done' ? 'complete' : '';
    $('phase-move').className = phase === 'move' ? 'active' : phase === 'done' ? 'complete' : '';
    $('k-value').textContent = $('k').value;
  }
  function renderStats() {
    renderControls();
    const done = phase === 'done';
    const titles = { start: 'Start with K centroids', assign: 'Points assigned', move: 'Centroids moved' };
    const descriptions = {
      start: 'The points have no labels yet. Each centroid is a candidate cluster center.',
      assign: 'Each point takes the color of its nearest centroid. Next, move the centers to their cluster means.',
      move: 'Each center is now the mean of its assigned points. Next, check who is nearest again.'
    };
    $('stage-title').textContent = done ? 'Clusters have settled' : titles[lastAction];
    $('stage-copy').textContent = done ? 'No point changed clusters. Each nonempty cluster has its centroid at the mean; this run has converged.' : descriptions[lastAction];
    $('iterations').textContent = iterations;
    $('inertia').textContent = history.length ? fmt(history.at(-1).value) : '—';
    $('progress-detail').textContent = done ? '0 points reassigned. Try new centroids to compare starting positions.'
      : lastAction === 'start' ? 'First, assign each point to its nearest centroid.'
      : lastAction === 'assign' ? `${changed} of ${points.length} points ${iterations ? 'changed clusters' : 'assigned'}.`
      : `Largest centroid move: ${fmt(maxShift)} units. Colors keep their previous assignment for now.`;
    $('plot-status').textContent = labels ? `${points.length} points · ${centroids.length} centroids` : `${points.length} unlabeled points`;
    $('assigned-count').textContent = `${labels ? points.length : 0} assigned`;
    $('clusters').replaceChildren();
    centroids.forEach((c, i) => {
      const row = document.createElement('div'); row.className = 'cluster-row';
      const key = document.createElement('span'); key.className = 'cluster-key'; key.style.background = color(i); key.textContent = i + 1;
      const info = document.createElement('div');
      const coord = document.createElement('div'); coord.className = 'cluster-coord'; coord.textContent = `μ${i + 1} = (${fmt(c.x)}, ${fmt(c.y)})`;
      const bar = document.createElement('div'); bar.className = 'cluster-bar';
      const fill = document.createElement('div'); fill.className = 'cluster-fill'; fill.style.background = color(i); fill.style.width = `${counts[i] / points.length * 100}%`;
      bar.append(fill); info.append(coord, bar);
      const count = document.createElement('span'); count.className = 'cluster-count'; count.textContent = labels ? counts[i] : '—'; count.setAttribute('aria-label', `${counts[i]} points in cluster ${i + 1}`);
      row.append(key, info, count); $('clusters').append(row);
    });
    $('empty-note').hidden = !empty.length;
    $('empty-note').textContent = `Empty cluster${empty.length > 1 ? 's' : ''}: ${empty.map(i => i + 1).join(', ')}. These centroids keep their position.`;
    $('experiment').textContent = $('dataset').value === 'rings'
      ? 'Try K = 2 on the rings. K-means cuts space into nearest-center regions, so it cannot recover an inner ring and an outer ring as two whole clusters.'
      : $('dataset').value === 'uniform'
        ? 'Uniform scatter has no planted groups, but K-means still partitions it. A clustering result alone is not evidence of natural categories.'
        : 'Run the three blobs with K = 3, then try K = 2. K is a choice you make; the algorithm does not discover it.';
  }

  // Clip the square by the bisector half-plane for each pair of centroids.
  // This draws exact nearest-centroid regions without a raster approximation.
  function region(index, centers) {
    let polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const a = centers[index];
    for (let j = 0; j < centers.length; j++) {
      if (j === index) continue;
      const b = centers[j], nx = b.x - a.x, ny = b.y - a.y;
      if (nx === 0 && ny === 0) { if (j < index) return []; else continue; }
      const limit = (b.x * b.x + b.y * b.y - a.x * a.x - a.y * a.y) / 2;
      const clipped = [];
      for (let i = 0; i < polygon.length; i++) {
        const p = polygon[i], q = polygon[(i + 1) % polygon.length];
        const dp = p.x * nx + p.y * ny - limit, dq = q.x * nx + q.y * ny - limit;
        if (dp <= 0) clipped.push(p);
        if ((dp <= 0) !== (dq <= 0)) {
          const t = dp / (dp - dq);
          clipped.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
        }
      }
      polygon = clipped;
    }
    return polygon;
  }
  function drawPlot(centers = centroids) {
    const fragment = document.createDocumentFragment();
    fragment.append(svg('title', { id: 'plot-title' }, 'K-means cluster space'));
    fragment.append(svg('desc', { id: 'plot-desc' }, `${points.length} data points and ${centers.length} numbered centroids. Use the coordinate editor below as an alternative to dragging. ${$('stage-title').textContent}.`));
    const defs = svg('defs');
    const clip = svg('clipPath', { id: 'space-clip' }); clip.append(svg('rect', { x: 44, y: 20, width: 532, height: 532 })); defs.append(clip); fragment.append(defs);
    const map = svg('g', { 'clip-path': 'url(#space-clip)' });
    map.append(svg('rect', { x: 44, y: 20, width: 532, height: 532, fill: 'var(--surface)' }));
    if ($('regions').checked) centers.forEach((c, i) => {
      const vertices = region(i, centers);
      if (vertices.length) map.append(svg('polygon', { class: 'region', 'data-cluster': i, points: vertices.map(p => `${PX(p.x)},${PY(p.y)}`).join(' '), fill: `var(--map-${letters[i]})`, stroke: 'var(--border)', 'stroke-width': 0.7 }));
    });
    for (let i = 0; i <= 10; i += 2) {
      map.append(svg('line', { x1: PX(i), x2: PX(i), y1: 20, y2: 552, stroke: 'var(--border)', 'stroke-opacity': 0.45, 'stroke-width': 0.6 }));
      map.append(svg('line', { x1: 44, x2: 576, y1: PY(i), y2: PY(i), stroke: 'var(--border)', 'stroke-opacity': 0.45, 'stroke-width': 0.6 }));
    }
    if ($('connections').checked && labels) points.forEach((p, i) => {
      const c = centers[labels[i]];
      map.append(svg('line', { class: 'assignment-line', x1: PX(p.x), y1: PY(p.y), x2: PX(c.x), y2: PY(c.y), stroke: color(labels[i]), 'stroke-opacity': 0.23, 'stroke-width': 1 }));
    });
    if ($('trails').checked) trails.forEach((trail, i) => {
      if (trail.length < 2) return;
      // The last trail endpoint follows the centroid during its animation.
      const visible = [...trail.slice(0, -1), centers[i]];
      map.append(svg('polyline', { class: 'centroid-trail', points: visible.map(p => `${PX(p.x)},${PY(p.y)}`).join(' '), fill: 'none', stroke: color(i), 'stroke-width': 2.2, 'stroke-dasharray': '4 4', 'stroke-opacity': 0.8 }));
      visible.slice(0, -1).forEach(p => map.append(svg('circle', { cx: PX(p.x), cy: PY(p.y), r: 3, fill: 'var(--bg)', stroke: color(i), 'stroke-width': 1.2 })));
    });
    fragment.append(map);
    points.forEach((p, i) => {
      const g = svg('g', { class: 'data-point', 'data-point': i, transform: `translate(${PX(p.x)} ${PY(p.y)})` });
      g.append(svg('title', {}, `Point ${p.id}: (${fmt(p.x)}, ${fmt(p.y)})${labels ? `, cluster ${labels[i] + 1}` : ', unassigned'}`));
      g.append(svg('circle', { r: 10, fill: 'transparent' }));
      g.append(svg('circle', { r: 4.6, fill: labels ? color(labels[i]) : 'var(--neutral)', stroke: 'var(--bg)', 'stroke-width': 1.2 }));
      fragment.append(g);
    });
    centers.forEach((c, i) => {
      const g = svg('g', { class: 'centroid', 'data-centroid': i, transform: `translate(${PX(c.x)} ${PY(c.y)})` });
      g.append(svg('title', {}, `Centroid ${i + 1}: (${fmt(c.x)}, ${fmt(c.y)})`));
      g.append(svg('circle', { r: 18, fill: 'transparent' }));
      g.append(svg('circle', { r: 12, fill: color(i), stroke: 'var(--bg)', 'stroke-width': 3 }));
      g.append(svg('circle', { r: 14, fill: 'none', stroke: color(i), 'stroke-width': 1.1 }));
      g.append(svg('text', { class: 'centroid-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, i + 1));
      fragment.append(g);
    });
    fragment.append(svg('rect', { x: 44, y: 20, width: 532, height: 532, fill: 'none', stroke: 'var(--border)', 'pointer-events': 'none' }));
    for (let i = 0; i <= 10; i += 2) {
      fragment.append(svg('text', { class: 'tick', x: PX(i), y: 572, 'text-anchor': 'middle' }, i));
      fragment.append(svg('text', { class: 'tick', x: 33, y: PY(i) + 4, 'text-anchor': 'end' }, i));
    }
    fragment.append(svg('text', { class: 'axis-title', x: 310, y: 594, 'text-anchor': 'middle' }, 'Feature x₁'));
    fragment.append(svg('text', { class: 'axis-title', x: 13, y: 286, transform: 'rotate(-90 13 286)', 'text-anchor': 'middle' }, 'Feature x₂'));
    plot.replaceChildren(fragment);
  }
  function drawHistory() {
    const chart = $('history');
    chart.replaceChildren();
    const left = 38, right = 292, top = 12, bottom = 84;
    chart.append(svg('line', { x1: left, x2: right, y1: bottom, y2: bottom, stroke: 'var(--border)' }));
    if (!history.length) {
      chart.setAttribute('aria-label', 'No objective values yet. Step or play to begin.');
      chart.append(svg('text', { x: 150, y: 46, 'text-anchor': 'middle' }, 'Step or play to begin'));
      $('history-note').textContent = 'The chart starts after the first assignment.';
      return;
    }
    const max = Math.max(history[0].value, 1);
    const coords = history.map((h, i) => ({ x: left + (right - left) * i / Math.max(1, history.length - 1), y: bottom - (bottom - top) * h.value / max }));
    chart.append(svg('text', { x: left - 6, y: top + 3, 'text-anchor': 'end' }, Math.round(max)));
    chart.append(svg('text', { x: left - 6, y: bottom + 3, 'text-anchor': 'end' }, '0'));
    chart.append(svg('polyline', { points: coords.map(p => `${p.x},${p.y}`).join(' '), stroke: 'var(--accent)', 'stroke-width': 1.8, fill: 'none' }));
    coords.forEach((p, i) => {
      const mark = svg('circle', { cx: p.x, cy: p.y, r: i === coords.length - 1 ? 3.5 : 2.3, fill: history[i].kind === 'move' ? 'var(--accent)' : 'var(--bg)', stroke: 'var(--accent)', 'stroke-width': 1.3 });
      mark.append(svg('title', {}, `${history[i].label}: ${fmt(history[i].value)}`)); chart.append(mark);
    });
    chart.append(svg('text', { x: left, y: 103 }, 'First assignment'));
    chart.append(svg('text', { x: right, y: 103, 'text-anchor': 'end' }, history.at(-1).label));
    chart.setAttribute('aria-label', `SSE from ${fmt(history[0].value)} to ${fmt(history.at(-1).value)} across ${history.length} steps.`);
    $('history-note').textContent = '○ Assign points    ● Move centroids';
  }
  function render() { renderStats(); drawPlot(); drawHistory(); syncEditor(); }
  function rebuildEditor() {
    const select = $('edit-item'), previous = select.value;
    select.replaceChildren();
    centroids.forEach((_, i) => select.add(new Option(`Centroid ${i + 1}`, `c:${i}`)));
    points.forEach((p, i) => select.add(new Option(`Point ${p.id}`, `p:${i}`)));
    if ([...select.options].some(o => o.value === previous)) select.value = previous;
    syncEditor();
  }
  function editedItem() {
    const [kind, index] = $('edit-item').value.split(':');
    return kind === 'c' ? centroids[Number(index)] : points[Number(index)];
  }
  function syncEditor() {
    const p = editedItem();
    if (p) { $('edit-x').value = p.x.toFixed(2); $('edit-y').value = p.y.toFixed(2); }
  }
  function editCoordinate(axis) {
    const field = $(axis === 'x' ? 'edit-x' : 'edit-y');
    if (field.value === '' || !Number.isFinite(field.valueAsNumber)) { syncEditor(); return; }
    const p = editedItem();
    if (!p) return;
    p[axis] = clamp(field.valueAsNumber);
    resetRun(centroids);
    $('announcement').textContent = 'Coordinates changed. A new run is ready.';
  }
  function pointerPosition(event) {
    const box = plot.getBoundingClientRect();
    return { x: clamp((600 * (event.clientX - box.left) / box.width - 44) / 53.2), y: clamp((552 - 600 * (event.clientY - box.top) / box.height) / 53.2) };
  }
  plot.addEventListener('pointerdown', event => {
    if (event.button !== 0 || animation !== null) return;
    const target = event.target.closest('[data-point],[data-centroid]');
    if (!target) return;
    stop(); renderControls();
    drag = { kind: target.hasAttribute('data-centroid') ? 'c' : 'p', index: Number(target.dataset.centroid ?? target.dataset.point), id: event.pointerId, startX: event.clientX, startY: event.clientY, started: false };
    plot.setPointerCapture(event.pointerId);
    $('edit-item').value = `${drag.kind}:${drag.index}`; syncEditor();
    event.preventDefault();
  });
  plot.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.started && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 3) return;
    if (!drag.started) { resetRun(centroids); drag.started = true; plot.classList.add('dragging'); }
    const p = pointerPosition(event);
    if (drag.kind === 'c') centroids[drag.index] = p;
    else Object.assign(points[drag.index], p);
    initial = clone(centroids); trails = centroids.map(c => [{ ...c }]);
    render();
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.started;
    drag = null; plot.classList.remove('dragging');
    if (plot.hasPointerCapture(event.pointerId)) plot.releasePointerCapture(event.pointerId);
    renderControls();
    if (moved) $('announcement').textContent = 'Coordinates changed. A new run is ready.';
  }
  plot.addEventListener('pointerup', finishDrag);
  plot.addEventListener('pointercancel', finishDrag);
  plot.addEventListener('lostpointercapture', finishDrag);
  $('step').addEventListener('click', step);
  $('play').addEventListener('click', () => {
    if (running) { stop(); renderControls(); }
    else {
      running = true; renderControls();
      if (animation === null) step();
    }
  });
  $('reset').addEventListener('click', () => resetRun(initial));
  $('reseed').addEventListener('click', () => { centerSeed++; initialize(); });
  $('resample').addEventListener('click', () => { dataSeed++; centerSeed++; regenerate(); });
  $('k').addEventListener('input', initialize);
  $('initialization').addEventListener('change', initialize);
  $('dataset').addEventListener('change', regenerate);
  $('count').addEventListener('change', regenerate);
  $('speed').addEventListener('change', () => { if (animation === null) schedule(); });
  ['regions', 'connections', 'trails'].forEach(id => $(id).addEventListener('change', () => drawPlot()));
  $('edit-item').addEventListener('change', syncEditor);
  $('edit-x').addEventListener('change', () => editCoordinate('x'));
  $('edit-y').addEventListener('change', () => editCoordinate('y'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); renderControls(); } });
  window.addEventListener('pagehide', () => { stop(); cancelAnimation(); });
  window.addEventListener('pageshow', () => render());
  initialize();
})();
