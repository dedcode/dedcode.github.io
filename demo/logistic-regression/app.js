// Logistic regression explorer. All state and computation stay in this browser.
(() => {
  const root = document.getElementById('logistic-explorer');
  const el = id => root.querySelector('#' + id);
  const state = {step:1, sourceId:null, x1:1,x2:0.5,y:1,angle:-45,offset:0};
  const training = {points:[],label:1,nextId:1};
  const c = {active:'var(--viz-series-1)',other:'var(--viz-series-2)',fg:'var(--foreground)',border:'var(--border)',bg:'var(--background)'};
  const sigmoid = z => 1/(1+Math.exp(-z));
  const logLoss = (score,y) => Math.log1p(Math.exp(y===1?-score:score));
  const signed = x => Math.abs(x) < 0.0005 ? '0.000' : (x > 0 ? '+' : '') + x.toFixed(3);
  const corners = [[-3,-3],[-3,3],[3,-3],[3,3]];
  const featureDomain = d3.extent(corners.flat());
  const weightNorm = Math.SQRT2;
  const offsetLimit = Number(el('line-offset').max);
  const scoreExtent = d3.extent(corners.flatMap(p=>{
    const bound=weightNorm*(Math.hypot(...p)+offsetLimit);
    return [-bound,bound];
  }));
  const scoreDomain = [scoreExtent[0]-0.3,scoreExtent[1]+0.3];
  const sigmoidData = d3.range(301).map(i=>({x:scoreDomain[0]+i*(scoreDomain[1]-scoreDomain[0])/300})).map(d=>({...d,y:sigmoid(d.x)}));
  const probabilityDomain = d3.extent([0,1,...sigmoidData.map(d=>d.y)]);
  const lossSamples = d3.range(601).map(i=>sigmoid(scoreDomain[0]+i*(scoreDomain[1]-scoreDomain[0])/600));
  const maxLoss = d3.max(lossSamples,p=>Math.max(-Math.log(p),-Math.log1p(-p)));
  let positionScales;
  let announceTimer;
  function geometry(angle,offset) {
    const theta=angle*Math.PI/180;
    const normal=[-Math.sin(theta),Math.cos(theta)];
    const scoreAt=p=>weightNorm*(normal[0]*p[0]+normal[1]*p[1]-offset);
    const square=[[-3,-3],[3,-3],[3,3],[-3,3]];
    function halfPlane(sign) {
      const result=[];
      for(let i=0;i<square.length;i++) {
        const a=square[i],b=square[(i+1)%square.length];
        const da=sign*scoreAt(a),db=sign*scoreAt(b);
        if(da>=0)result.push(a);
        if((da>=0)!==(db>=0)) {
          const t=da/(da-db);
          result.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
        }
      }
      return result;
    }
    const positive=halfPlane(1),negative=halfPlane(-1);
    const boundary=positive.filter(p=>Math.abs(scoreAt(p))<1e-8);
    return {normal,scoreAt,positive,negative,boundary};
  }
  function base(id,xd,yd,xTitle,yTitle,square=false) {
    const svg = d3.select(el(id));
    const width = el(id).parentElement.getBoundingClientRect().width;
    const left=64,right=18,top=28,bottom=58;
    const side = width-left-right;
    const height = side+top+bottom;
    svg.attr('viewBox',`0 0 ${width} ${height}`).attr('height',height);
    svg.selectAll('*').remove();
    svg.append('title').text(el(id).getAttribute('aria-label'));
    const x = d3.scaleLinear().domain(xd).range([left+6,width-right-6]);
    const y = d3.scaleLinear().domain(yd).range([height-bottom-6,top+6]);
    if(square) y.range([top+6+x.range()[1]-x.range()[0],top+6]);
    const box={l:left,r:width-right,t:top,b:height-bottom};
    svg.append('rect').attr('data-chart-frame','').attr('x',box.l).attr('y',box.t).attr('width',box.r-box.l).attr('height',box.b-box.t).attr('fill','none').attr('stroke',c.border);
    svg.append('defs').append('clipPath').attr('id',id+'-clip').append('rect').attr('x',box.l).attr('y',box.t).attr('width',box.r-box.l).attr('height',box.b-box.t);
    const layer=svg.append('g').attr('clip-path',`url(#${id}-clip)`);
    const ticks=width<370?3:5;
    svg.append('g').attr('transform',`translate(0,${box.b})`).call(d3.axisBottom(x).ticks(ticks).tickSizeOuter(0));
    svg.append('g').attr('transform',`translate(${box.l},0)`).call(d3.axisLeft(y).ticks(4).tickSizeOuter(0));
    svg.append('text').attr('class','axis-title').attr('data-axis','x').attr('x',(box.l+box.r)/2).attr('y',height-10).attr('text-anchor','middle').text(xTitle);
    svg.append('text').attr('class','axis-title').attr('data-axis','y').attr('transform',`translate(17,${(box.t+box.b)/2}) rotate(-90)`).attr('text-anchor','middle').text(yTitle);
    return {svg,layer,x,y,box,width,height};
  }
  function line(plot,pts,color=c.border,dash=null,width=1) {
    return plot.layer.append('path').attr('d',d3.line().x(d=>plot.x(d[0])).y(d=>plot.y(d[1]))(pts)).attr('fill','none').attr('stroke',color).attr('stroke-width',width).attr('stroke-dasharray',dash);
  }
  function marker(plot,x,y) {
    plot.layer.append('circle').attr('cx',plot.x(x)).attr('cy',plot.y(y)).attr('r',7).attr('fill',c.active).attr('stroke',c.bg).attr('stroke-width',2);
  }
  function label(plot,x,y,text,anchor='start') {
    plot.svg.append('text').attr('x',x).attr('y',y).attr('text-anchor',anchor).text(text);
  }
  function checkLabels(plot) {
    const texts = [...plot.svg.node().querySelectorAll('.tick text,.axis-title')];
    const boxes = texts.map(t=>({t,b:t.getBoundingClientRect()}));
    for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
      const a=boxes[i],b=boxes[j];
      if(a.b.width && b.b.width && a.b.left<b.b.right+4 && a.b.right+4>b.b.left && a.b.top<b.b.bottom+4 && a.b.bottom+4>b.b.top) {
        if(b.t.closest('.tick')) b.t.style.visibility='hidden';
      }
    }
  }
  // Lesson state is independent of the dataset. The probe is a value copy.
  function selectPoint(id) {
    const point = training.points.find(p => p.id === id);
    if (!point) return;
    Object.assign(state, {sourceId: point.id, x1: point.x1, x2: point.x2, y: point.y});
    syncProbeInputs();
  }
  function syncProbeInputs() {
    el('feature-one').value = state.x1.toFixed(2);
    el('feature-two').value = state.x2.toFixed(2);
  }
  function setStep(step) {
    if (step < 1 || step > 3 || (step > 1 && !training.points.length)) return;
    if (step === 3 && !training.points.some(p => p.id === state.sourceId)) {
      selectPoint(training.points[0].id);
    }
    state.step = step;
    draw();
  }
  function updateInterface() {
    root.dataset.step = state.step;
    const introductions = {
      1: ['1. Build the dataset', 'Choose a true label, then click the instance space to add points. Add at least one point to continue.'],
      2: ['2. Which line gives a smaller loss?', 'Rotate or shift the line. Watch each training point’s loss and the total change together.'],
      3: ['3. How does one prediction work?', 'Select a point, then drag its diamond copy. The selected-class score is positive on its correct side: higher score → higher probability → lower loss.']
    };
    el('step-heading').textContent = introductions[state.step][0];
    el('step-description').textContent = introductions[state.step][1];
    root.querySelectorAll('.step-button').forEach(button => {
      const step = Number(button.dataset.step);
      button.disabled = step > 1 && !training.points.length;
      if (step === state.step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    el('placement-controls').hidden = state.step !== 1;
    el('line-controls').hidden = state.step !== 2;
    el('probe-controls').hidden = state.step !== 3;
    el('dataset-panel').hidden = state.step === 3;
    el('inspection-panel').hidden = state.step !== 3;
    el('loss-summary').hidden = state.step !== 2;
    el('previous-step').hidden = state.step === 1;
    el('previous-step').textContent = state.step === 3 ? '← Back to total loss' : '← Back to points';
    el('next-step').hidden = state.step === 3;
    el('next-step').disabled = !training.points.length;
    el('next-step').textContent = state.step === 1 ? 'Next: explore total loss →' : 'Next: inspect one point →';
    el('training-one').setAttribute('aria-pressed', String(training.label === 1));
    el('training-zero').setAttribute('aria-pressed', String(training.label === 0));
    el('angle-value').textContent = state.angle + '°';
    el('offset-value').textContent = state.offset.toFixed(2);
  }
  function equation(g) {
    const coefficient = n => (Math.abs(n) < 0.0005 ? 0 : n).toFixed(2);
    const term = (n, symbol) => (n < -0.0005 ? ' − ' : ' + ') + coefficient(Math.abs(n)) + symbol;
    return 'f(x) = ' + coefficient(weightNorm * g.normal[0]) + 'x₁'
      + term(weightNorm * g.normal[1], 'x₂') + term(-weightNorm * state.offset, '');
  }
  function trainingValues(g) {
    return training.points.map(point => {
      const score = g.scoreAt([point.x1, point.x2]);
      return {...point, score, probability: sigmoid(score), loss: logLoss(score, point.y)};
    });
  }
  function draw() {
    updateInterface();
    const g = geometry(state.angle, state.offset);
    const values = trainingValues(g);
    const total = values.reduce((sum, point) => sum + point.loss, 0);
    el('space-caption').textContent = state.step === 1 ? '● y = 1 · ■ y = 0' : equation(g);
    drawSpace(g, values);
    if (state.step < 3) drawDataset(values, total);
    else drawInspection(g, values, total);
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      const context = state.step === 1 ? `${training.points.length} labeled points.`
        : `Training total loss ${total.toFixed(4)}.`;
      const copy = state.step === 3 ? ` Exploration copy of point ${state.sourceId}, label ${state.y}, selected-class score ${((2 * state.y - 1) * g.scoreAt([state.x1, state.x2])).toFixed(3)}. Probability of its true label ${sigmoid((2 * state.y - 1) * g.scoreAt([state.x1, state.x2])).toFixed(4)}.` : '';
      el('accessible-status').textContent = `Step ${state.step}. ${context}${copy}`;
    }, 250);
  }
  function drawSpace(g, values) {
    const a = base('position-plot', featureDomain, featureDomain, 'Feature x₁', 'Feature x₂', true);
    positionScales = a;
    if (state.step > 1) {
      const poly = points => points.map(d => [a.x(d[0]), a.y(d[1])].join(',')).join(' ');
      a.layer.append('polygon').attr('points', poly(g.positive)).attr('fill', c.active).attr('opacity', 0.08);
      a.layer.append('polygon').attr('points', poly(g.negative)).attr('fill', c.other).attr('opacity', 0.08);
      line(a, g.boundary, c.fg, null, 2).attr('data-decision-boundary', '');
    }
    line(a, [[-3, 0], [3, 0]]);
    line(a, [[0, -3], [0, 3]]);
    for (const point of values) {
      const selected = state.step === 3 && point.id === state.sourceId;
      const mark = point.y === 1
        ? a.layer.append('circle').attr('cx', a.x(point.x1)).attr('cy', a.y(point.x2)).attr('r', 6)
        : a.layer.append('rect').attr('x', a.x(point.x1) - 5).attr('y', a.y(point.x2) - 5).attr('width', 10).attr('height', 10);
      mark.attr('fill', point.y === 1 ? c.active : c.other).attr('stroke', c.bg).attr('stroke-width', 1.5)
        .attr('opacity', state.step === 3 && !selected ? 0.45 : 1).attr('data-training-point', point.id);
      mark.append('title').text(`Point ${point.id}: (${point.x1.toFixed(2)}, ${point.x2.toFixed(2)}), y = ${point.y}`);
      if (selected) {
        a.layer.append('circle').attr('cx', a.x(point.x1)).attr('cy', a.y(point.x2)).attr('r', 11)
          .attr('fill', 'none').attr('stroke', c.fg).attr('stroke-width', 1.5).attr('data-original-point', point.id);
      }
    }
    if (state.step === 3) {
      const score = g.scoreAt([state.x1, state.x2]);
      const distance = score / weightNorm;
      const foot = [state.x1 - distance * g.normal[0], state.x2 - distance * g.normal[1]];
      line(a, [[state.x1, state.x2], foot], c.fg, '5 4', 1.5);
      a.layer.append('rect').attr('x', a.x(foot[0]) - 3).attr('y', a.y(foot[1]) - 3)
        .attr('width', 6).attr('height', 6).attr('fill', c.fg);
      a.layer.append('path').attr('d', d3.symbol().type(d3.symbolDiamond).size(115)())
        .attr('transform', `translate(${a.x(state.x1)},${a.y(state.x2)})`)
        .attr('fill', c.fg).attr('stroke', c.bg).attr('stroke-width', 1.5).attr('data-exploration-copy', '');
      label(a, a.box.l, 16, '◇ Copy · outlined point = original');
    } else {
      label(a, a.box.l, 16, state.step === 1 ? `Click to add · y = ${training.label}` : 'Boundary: f(x) = 0');
    }
    a.svg.attr('aria-label', state.step === 1
      ? `${values.length} labeled training points. Click to add label ${training.label}, or use the coordinate fields.`
      : state.step === 2 ? `${values.length} fixed training points and an adjustable decision boundary.`
      : `Exploration copy of point ${state.sourceId} at (${state.x1.toFixed(2)}, ${state.x2.toFixed(2)}), fixed label ${state.y}. Drag the diamond or use the copy coordinate fields. Click a training point to select it.`);
    checkLabels(a);
  }
  function drawDataset(values, total) {
    const evaluating = state.step === 2;
    el('dataset-heading').textContent = evaluating ? 'Evaluate the whole dataset' : 'Your training set';
    el('dataset-count').textContent = `${values.length} ${values.length === 1 ? 'point' : 'points'}`;
    el('total-loss').textContent = total.toFixed(4);
    el('table-caption').textContent = evaluating ? 'Each point’s contribution to total training loss' : 'Labeled training points';
    el('training-header').innerHTML = '<tr><th scope="col">Point</th><th scope="col">(x₁, x₂)</th><th scope="col">y</th>'
      + (evaluating ? '<th scope="col">P(y = 1)</th><th scope="col">Loss Lᵢ</th>' : '')
      + '<th scope="col"><span class="sr-only">Point action</span></th></tr>';
    const rows = values.map(point => `<tr><td>${point.y === 1 ? '●' : '■'} ${point.id}</td><td>(${point.x1.toFixed(2)}, ${point.x2.toFixed(2)})</td><td>${point.y}</td>`
      + (evaluating ? `<td>${point.probability.toFixed(4)}</td><td>${point.loss.toFixed(4)}</td><td><button type="button" class="btn btn-ghost" data-inspect-point="${point.id}" aria-label="Inspect training point ${point.id}">Inspect</button></td>`
        : `<td><button type="button" class="btn btn-ghost" data-remove-point="${point.id}" aria-label="Remove training point ${point.id}">Remove</button></td>`) + '</tr>');
    el('training-rows').innerHTML = rows.length ? rows.join('') : '<tr><td colspan="4">Add your first training point in the instance space.</td></tr>';
  }
  function drawInspection(g, values, total) {
    const original = values.find(point => point.id === state.sourceId);
    const select = el('point-select');
    const options = values.map(p => `<option value="${p.id}">Point ${p.id} · y = ${p.y} · (${p.x1.toFixed(2)}, ${p.x2.toFixed(2)})</option>`).join('');
    if (select.innerHTML !== options) select.innerHTML = options;
    select.value = String(state.sourceId);
    const z = g.scoreAt([state.x1, state.x2]);
    // Reorient the inspection score toward the selected class. This does not
    // change the model, boundary, projection, or any training-point loss.
    const selectedScore = (2 * state.y - 1) * z;
    const trueClassProbability = sigmoid(selectedScore);
    const otherProbability = sigmoid(-selectedScore);
    const loss = logLoss(z, state.y);
    const scoreExpression = state.y === 1 ? 'f(x)' : '−f(x)';
    el('copy-description').textContent = `Exploration copy of point ${state.sourceId} · true label y = ${state.y} (fixed). The original point remains in the training set.`;
    el('true-class-label').textContent = `Probability assigned to this point’s true label: P(y = ${state.y})`;
    el('true-class-value').textContent = (100 * trueClassProbability).toFixed(2) + '%';
    el('true-class-loss').textContent = `s = ${scoreExpression} = ${signed(selectedScore)} → q = ${trueClassProbability.toFixed(4)} → L = −ln(q) = ${loss.toFixed(4)}`;
    el('selected-score-label').textContent = `Class-${state.y} score s = ${scoreExpression}`;
    el('score-value').textContent = signed(selectedScore);
    el('probability-heading').textContent = `Score → P(y = ${state.y})`;
    el('probability-formula').textContent = `s = ${scoreExpression}; q = 1 / (1 + exp(−s))`;
    el('selected-probability-label').textContent = `q = P(y = ${state.y})`;
    el('other-probability-label').textContent = `P(y = ${1 - state.y}) = 1 − q`;
    el('probability-value').textContent = trueClassProbability.toFixed(4);
    el('other-probability-value').textContent = otherProbability.toFixed(4);
    el('loss-value').textContent = loss.toFixed(4);
    el('loss-formula').textContent = `L = −ln(q), where q = P(y = ${state.y})`;
    el('loss-explanation').textContent = state.y === 1 ? 'Higher P(y = 1) → lower loss' : 'Higher P(y = 0) → lower loss';
    el('distance-value').textContent = 'Class-relative signed distance = s / √2 = ' + signed(selectedScore / weightNorm) + ' · positive on the correct side';
    el('logodds-value').textContent = `Model score f(x) = ${signed(z)} · Class-${state.y} log-odds s = ${signed(selectedScore)} · Class-${state.y} odds q / (1 − q) = ${Math.exp(selectedScore).toFixed(3)}`;
    el('original-loss').textContent = `Original point ${original.id}: loss Lᵢ = ${original.loss.toFixed(4)}.`;
    el('inspection-total').textContent = `Training total Σ Lᵢ = ${total.toFixed(4)} across ${values.length} points. Moving the copy leaves this total unchanged.`;
    el('probability-plot').setAttribute('aria-label', `Probability P(y = ${state.y}) as a function of selected-class score s = ${scoreExpression}. Current score ${selectedScore.toFixed(3)}; probability ${trueClassProbability.toFixed(4)}.`);
    el('loss-plot').setAttribute('aria-label', `Loss equals minus the log of P(y = ${state.y}). Current selected-class probability ${trueClassProbability.toFixed(4)}; loss ${loss.toFixed(4)}.`);
    const b = base('probability-plot', scoreDomain, probabilityDomain, `Class-${state.y} score s = ${scoreExpression}`, `P(y = ${state.y})`);
    line(b, [[0, 0], [0, 1]], c.border, '3 4');
    line(b, [[scoreDomain[0], 0.5], [scoreDomain[1], 0.5]], c.border, '3 4');
    line(b, sigmoidData.map(d => [d.x, d.y]), c.active, null, 2.5);
    line(b, [[selectedScore, 0], [selectedScore, trueClassProbability], [scoreDomain[0], trueClassProbability]], c.active, '4 4');
    marker(b, selectedScore, trueClassProbability);
    label(b, b.box.l, 16, 's = 0 → q = 0.5');
    const d = base('loss-plot', probabilityDomain, [0, maxLoss * 1.05], `q = P(y = ${state.y})`, 'Log loss L (nats)');
    line(d, lossSamples.map(q => [q, -Math.log(q)]), c.active, null, 2.5);
    line(d, [[trueClassProbability, 0], [trueClassProbability, loss], [0, loss]], c.active, '4 4');
    marker(d, trueClassProbability, loss);
    label(d, d.box.l, 16, 'q = 0.5 → L ≈ 0.693');
    label(d, d.x(0) + 5, d.y(maxLoss) + 8, '↑ ∞', 'start');
    [b, d].forEach(checkLabels);
  }
  function addTrainingPoint(x1, x2) {
    if (state.step !== 1 || !Number.isFinite(x1) || !Number.isFinite(x2) || Math.abs(x1) > 3 || Math.abs(x2) > 3) return;
    training.points.push({id: training.nextId++, x1, x2, y: training.label});
    el('training-x1').value = x1.toFixed(2);
    el('training-x2').value = x2.toFixed(2);
    draw();
  }
  // Pointer capture stays on the persistent SVG, even as its marks are redrawn.
  function pointerPosition(event) {
    const rect = el('position-plot').getBoundingClientRect();
    const x = (event.clientX - rect.left) * positionScales.width / rect.width;
    const y = (event.clientY - rect.top) * positionScales.height / rect.height;
    return {x, y, inside: x >= positionScales.box.l && x <= positionScales.box.r && y >= positionScales.box.t && y <= positionScales.box.b};
  }
  function coordinates(pointer) {
    return [positionScales.x.invert(pointer.x), positionScales.y.invert(pointer.y)]
      .map(value => Math.max(-3, Math.min(3, value)));
  }
  function moveCopy(event) {
    [state.x1, state.x2] = coordinates(pointerPosition(event));
    syncProbeInputs();
    draw();
  }
  const plot = el('position-plot');
  plot.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const pointer = pointerPosition(event);
    if (!pointer.inside) return;
    if (state.step === 1) { event.preventDefault(); addTrainingPoint(...coordinates(pointer)); return; }
    if (state.step !== 3) return;
    const copyDistance = Math.hypot(pointer.x - positionScales.x(state.x1), pointer.y - positionScales.y(state.x2));
    if (copyDistance > 22) {
      const closest = training.points.map(point => ({point, distance: Math.hypot(pointer.x - positionScales.x(point.x1), pointer.y - positionScales.y(point.x2))}))
        .sort((a, b) => a.distance - b.distance)[0];
      if (!closest || closest.distance > 22) return;
      selectPoint(closest.point.id);
      draw();
    }
    event.preventDefault();
    plot.setPointerCapture(event.pointerId);
  });
  plot.addEventListener('pointermove', event => {
    if (state.step === 3 && plot.hasPointerCapture(event.pointerId)) moveCopy(event);
  });
  plot.addEventListener('pointerup', event => {
    if (plot.hasPointerCapture(event.pointerId)) plot.releasePointerCapture(event.pointerId);
  });
  root.querySelectorAll('.step-button').forEach(button => button.addEventListener('click', () => setStep(Number(button.dataset.step))));
  el('next-step').addEventListener('click', () => setStep(state.step + 1));
  el('previous-step').addEventListener('click', () => setStep(state.step - 1));
  el('line-angle').addEventListener('input', () => { state.angle = el('line-angle').valueAsNumber; draw(); });
  el('line-offset').addEventListener('input', () => { state.offset = el('line-offset').valueAsNumber; draw(); });
  el('training-one').addEventListener('click', () => { training.label = 1; draw(); });
  el('training-zero').addEventListener('click', () => { training.label = 0; draw(); });
  el('training-form').addEventListener('submit', event => {
    event.preventDefault();
    addTrainingPoint(el('training-x1').valueAsNumber, el('training-x2').valueAsNumber);
  });
  el('training-rows').addEventListener('click', event => {
    const inspect = event.target.closest('[data-inspect-point]');
    if (inspect) { selectPoint(Number(inspect.dataset.inspectPoint)); setStep(3); return; }
    const remove = event.target.closest('[data-remove-point]');
    if (!remove || state.step !== 1) return;
    training.points = training.points.filter(p => p.id !== Number(remove.dataset.removePoint));
    if (!training.points.some(p => p.id === state.sourceId)) state.sourceId = null;
    draw();
  });
  el('point-select').addEventListener('change', () => { selectPoint(Number(el('point-select').value)); draw(); });
  el('reset-copy').addEventListener('click', () => { selectPoint(state.sourceId); draw(); });
  ['feature-one', 'feature-two'].forEach((id, index) => el(id).addEventListener('input', () => {
    const input = el(id), value = input.valueAsNumber;
    if (!Number.isFinite(value) || state.step !== 3) return;
    const clamped = Math.max(-3, Math.min(3, value));
    state[index === 0 ? 'x1' : 'x2'] = clamped;
    if (clamped !== value) input.value = clamped;
    draw();
  }));
  // Observe width only: switching panels can change height without changing scales.
  let lastWidth = 0;
  const observer = new ResizeObserver(entries => {
    const width = entries[0].contentRect.width;
    if (width !== lastWidth) { lastWidth = width; draw(); }
  });
  observer.observe(root);
  draw();
})();
