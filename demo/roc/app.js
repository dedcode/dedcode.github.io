(()=>{
const el=id=>document.getElementById(id),M=ROCModel;
let points=M.data('overlap'),threshold=1.01,timer=null;
const notes={overlap:'Some negative instances outrank positive ones.',perfect:'Every positive instance ranks above every negative instance.',reversed:'Every negative instance ranks above every positive instance. The scores rank the classes in reverse.'};
function stop(){clearInterval(timer);timer=null;el('play').textContent='Play';}
function updateThreshold(t){threshold=Math.round(t*100)/100;draw();const scroller=el('instance-scroll'),lineY=32+24*points.filter(p=>p.score>=threshold).length;if(lineY<scroller.scrollTop+24)scroller.scrollTop=Math.max(0,lineY-24);else if(lineY>scroller.scrollTop+scroller.clientHeight-24)scroller.scrollTop=lineY-scroller.clientHeight+24;}
function next(){const t=M.levels(points).find(v=>v<threshold-1e-9);if(t===undefined){stop();return;}updateThreshold(t);if(!M.levels(points).some(v=>v<threshold-1e-9))stop();}
function reset(){stop();threshold=1.01;el('instance-scroll').scrollTop=0;draw();}
function regenerate(){points=M.data(el('example').value,Number(el('sample-size').value),Number(el('positive-share').value)/100);reset();}
function rankedPoints(){return [...points].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));}
function thresholdAtIndex(index){const sorted=rankedPoints(),split=sorted.filter(p=>p.score>=threshold).length;if(index<split){while(index>0&&sorted[index-1].score===threshold)index--;}return index===0?1.01:sorted[index-1].score;}
function drawScores(){
 const svg=d3.select(el('scores')),w=el('scores').getBoundingClientRect().width,top=32,row=24,sorted=rankedPoints(),bottom=top+row*sorted.length,h=bottom+24;
 el('threshold').style.height=`${row*sorted.length+16}px`;
 const split=sorted.filter(p=>p.score>=threshold).length,lineY=top+row*split;
 svg.attr('viewBox',`0 0 ${w} ${h}`).attr('height',h).attr('aria-label',`Instances sorted from highest to lowest score. Threshold ${threshold.toFixed(2)}. ${split} shaded rows above the line are predicted positive.`);svg.selectAll('*').remove();
 [['Instance',14],['Class',w*.46],['Score',w-18]].forEach(([text,x],i)=>svg.append('text').attr('x',x).attr('y',18).attr('text-anchor',i===2?'end':'start').attr('font-weight',600).text(text));
 svg.append('rect').attr('x',1).attr('y',top).attr('width',w-2).attr('height',bottom-top).attr('fill','none').attr('stroke','var(--border)');
 const rows=svg.selectAll('g.instance').data(sorted).join('g').attr('class','instance').attr('data-id',p=>p.id).attr('data-predicted-positive',p=>String(p.score>=threshold)).attr('transform',(p,i)=>`translate(0,${top+i*row})`);
 rows.append('rect').attr('x',2).attr('width',w-4).attr('height',row).attr('fill',p=>p.score>=threshold?'var(--surface)':'var(--bg)');
 rows.append('text').attr('x',14).attr('y',16).text(p=>p.id.toUpperCase());
 rows.append('path').attr('transform',`translate(${w*.46+8},12)`).attr('d',p=>d3.symbol().type(p.positive?d3.symbolCircle:d3.symbolSquare).size(45)()).attr('fill',p=>p.positive?'var(--pos)':'var(--neg)');
 rows.append('text').attr('x',w*.46+22).attr('y',16).text(p=>p.positive?'+':'−');
 rows.append('text').attr('x',w-18).attr('y',16).attr('text-anchor','end').text(p=>p.score.toFixed(2));
 rows.append('title').text(p=>`${p.id}: actual ${p.positive?'positive':'negative'}, score ${p.score.toFixed(2)}, predicted ${p.score>=threshold?'positive':'negative'}`);
 svg.append('line').attr('x1',0).attr('x2',w).attr('y1',lineY).attr('y2',lineY).attr('stroke','var(--line)').attr('stroke-width',3);
 svg.append('text').attr('x',w/2).attr('y',h-5).attr('text-anchor','middle').text(`Threshold = ${threshold.toFixed(2)}`);
 svg.append('rect').attr('class','drag-line').attr('x',0).attr('y',lineY-10).attr('width',w).attr('height',20).attr('fill','transparent').call(d3.drag().on('start',stop).on('drag',ev=>{const index=Math.max(0,Math.min(sorted.length,Math.round((ev.y-top)/row)));updateThreshold(thresholdAtIndex(index));}));
}
function drawRoc(){const svg=d3.select(el('roc')),w=el('roc').getBoundingClientRect().width,left=55,top=18,right=20,side=w-left-right,h=side+top+55,sx=d3.scaleLinear().domain([0,1]).range([left,left+side]),sy=d3.scaleLinear().domain([0,1]).range([top+side,top]);svg.attr('viewBox',`0 0 ${w} ${h}`).attr('height',h);svg.selectAll('*').remove();const all=M.curve(points),visible=all.filter(p=>p.threshold>=1||p.threshold>=threshold),current=M.counts(points,threshold);svg.attr('aria-label',`Current ROC point: false positive rate ${current.fpr.toFixed(2)}, true positive rate ${current.tpr.toFixed(2)}. ${visible.length-1} threshold groups crossed.`);
svg.append('rect').attr('x',left).attr('y',top).attr('width',side).attr('height',side).attr('fill','none').attr('stroke','var(--border)');
svg.append('path').attr('d',`M${sx(0)},${sy(0)}L${sx(1)},${sy(1)}`).attr('stroke','var(--muted)').attr('stroke-dasharray','5 5').attr('fill','none');
const path=d3.line().x(d=>sx(d.fpr)).y(d=>sy(d.tpr));
svg.append('path').attr('d',path(visible)).attr('fill','none').attr('stroke','var(--line)').attr('stroke-width',3);
svg.selectAll('circle.step').data(visible).join('circle').attr('class','step').attr('cx',d=>sx(d.fpr)).attr('cy',d=>sy(d.tpr)).attr('r',2.5).attr('fill','var(--line)');
svg.append('circle').attr('cx',sx(current.fpr)).attr('cy',sy(current.tpr)).attr('r',6).attr('fill','var(--line)').attr('stroke','var(--bg)').attr('stroke-width',2);
svg.append('g').attr('transform',`translate(0,${top+side})`).call(d3.axisBottom(sx).ticks(5));svg.append('g').attr('transform',`translate(${left},0)`).call(d3.axisLeft(sy).ticks(5));svg.append('text').attr('x',left+side/2).attr('y',h-8).attr('text-anchor','middle').text('False positive rate (FPR)');svg.append('text').attr('transform',`translate(14,${top+side/2}) rotate(-90)`).attr('text-anchor','middle').text('True positive rate (TPR)');}
function draw(){const c=M.counts(points,threshold),P=c.tp+c.fn,N=c.fp+c.tn;el('sample-size-value').textContent=points.length;el('positive-share-value').textContent=`${el('positive-share').value}%`;el('positive-share').setAttribute('aria-valuetext',`${el('positive-share').value}% positive, ${100-Number(el('positive-share').value)}% negative`);el('class-counts').textContent=`${P} positive · ${N} negative`;el('threshold').max=points.length;el('threshold').value=points.filter(p=>p.score>=threshold).length;el('threshold').setAttribute('aria-valuetext',`Threshold ${threshold.toFixed(2)}; ${c.tp+c.fp} predicted positive`);el('threshold-value').textContent=threshold.toFixed(2);el('example-note').textContent=notes[el('example').value];for(const key of ['tp','fp','tn','fn'])el(key).textContent=c[key];el('tpr-calculation').textContent=`${c.tp} / ${P} = ${c.tpr.toFixed(2)}`;el('fpr-calculation').textContent=`${c.fp} / ${N} = ${c.fpr.toFixed(2)}`;el('coordinate').textContent=`ROC point (FPR, TPR) = (${c.fpr.toFixed(2)}, ${c.tpr.toFixed(2)})`;const crossed=M.levels(points).filter(v=>v>=threshold).length;el('progress').textContent=`${crossed} / ${M.levels(points).length} distinct scores crossed`;el('next').disabled=el('play').disabled=crossed===M.levels(points).length;drawScores();drawRoc();}
el('threshold').addEventListener('input',ev=>{stop();updateThreshold(thresholdAtIndex(Number(ev.target.value)));});el('next').addEventListener('click',()=>{stop();next();});el('reset').addEventListener('click',reset);el('example').addEventListener('change',regenerate);for(const id of ['sample-size','positive-share'])el(id).addEventListener('input',regenerate);el('play').addEventListener('click',()=>{if(timer){stop();return;}el('play').textContent='Pause';timer=setInterval(next,850);next();});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});new ResizeObserver(()=>{drawScores();drawRoc();}).observe(document.querySelector('main'));draw();
})();
