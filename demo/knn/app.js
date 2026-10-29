(() => {
  'use strict';
  const M=window.KNNModel,$=id=>document.getElementById(id),svg=$('points'),canvas=$('regions'),plot=$('plot');
  const names=['A','B','C','D','E'],symbols=['●','■','▲','◆','⬟'],keys=['a','b','c','d','e'];
  const color=c=>`var(--${keys[c]})`;
  let seed=42,classes=4,total=40,k=3,metric='l2',points=M.generate(total,classes,seed),query={x:6,y:5};
  let selectedId=1,geometry,drag=null,mapFrame=0,mapVersion=0,announceTimer=0;
  const NS='http://www.w3.org/2000/svg';
  function element(tag,attrs={},parent=svg){const n=document.createElementNS(NS,tag);for(const [a,v] of Object.entries(attrs))n.setAttribute(a,v);parent.appendChild(n);return n;}
  function label(x,y,value,attrs={}){const n=element('text',{x,y,...attrs});n.textContent=value;return n;}
  function symbol(c,parent,x,y,r,attrs={}){
    const common={fill:color(c),stroke:'var(--bg)','stroke-width':1.4,...attrs};
    if(c===0)return element('circle',{cx:x,cy:y,r,...common},parent);
    if(c===1)return element('rect',{x:x-r,y:y-r,width:r*2,height:r*2,rx:1,...common},parent);
    const n=c===2?3:c===3?4:5,vertices=Array.from({length:n},(_,i)=>{const a=-Math.PI/2+2*Math.PI*i/n;return `${x+Math.cos(a)*(r+1)},${y+Math.sin(a)*(r+1)}`;});
    return element('polygon',{points:vertices.join(' '),...common},parent);
  }
  function dimensions(){
    const width=plot.getBoundingClientRect().width,side=Math.max(1,width-58);
    geometry={width,side,left:44,top:14,X:x=>44+x/10*side,Y:y=>14+(10-y)/10*side};
    svg.setAttribute('viewBox',`0 0 ${width} ${width}`);
    canvas.style.left='44px';canvas.style.top='14px';canvas.style.width=`${side}px`;canvas.style.height=`${side}px`;
  }
  function drawOverlay(){
    dimensions();svg.replaceChildren();const g=geometry,{X,Y,side}=g;
    const defs=element('defs'),clip=element('clipPath',{id:'plot-clip'},defs);
    element('rect',{x:g.left,y:g.top,width:side,height:side},clip);
    const layer=element('g',{'clip-path':'url(#plot-clip)'});
    const result=M.predict(points,query,k,metric,classes),r=result.neighbors.at(-1)?.distance||0;
    const qx=X(query.x),qy=Y(query.y),radius=r/10*side;
    if(metric==='l2')element('circle',{cx:qx,cy:qy,r:radius,fill:'none',stroke:'var(--fg)','stroke-width':1.15,'stroke-dasharray':'5 4',opacity:.6},layer);
    else element('path',{d:`M${qx},${qy-radius} L${qx+radius},${qy} L${qx},${qy+radius} L${qx-radius},${qy} Z`,fill:'none',stroke:'var(--fg)','stroke-width':1.15,'stroke-dasharray':'5 4',opacity:.6},layer);
    const chosen=new Set(result.neighbors.map(n=>n.point.id));
    result.neighbors.forEach(({point:p})=>element('line',{x1:qx,y1:qy,x2:X(p.x),y2:Y(p.y),stroke:'var(--fg)','stroke-width':1,opacity:.32},layer));
    points.forEach(p=>{
      const x=X(p.x),y=Y(p.y),group=element('g',{'data-point-id':p.id},layer);
      if(chosen.has(p.id))element('circle',{cx:x,cy:y,r:9,fill:'none',stroke:'var(--fg)','stroke-width':1.3},group);
      symbol(p.c,group,x,y,5.5);
      const title=element('title',{},group);title.textContent=`Point ${p.id} · class ${names[p.c]} · (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`;
    });
    element('circle',{cx:qx,cy:qy,r:9,fill:'var(--bg)',stroke:'var(--fg)','stroke-width':1.5},layer);
    element('path',{d:`M${qx-4.5},${qy} H${qx+4.5} M${qx},${qy-4.5} V${qy+4.5}`,stroke:'var(--fg)','stroke-width':1.8,fill:'none'},layer);
    element('rect',{x:g.left,y:g.top,width:side,height:side,fill:'none',stroke:'var(--border)','pointer-events':'none'});
    const ticks=g.width<420?[0,5,10]:[0,2,4,6,8,10];
    for(const v of ticks){
      element('line',{x1:X(v),y1:Y(0),x2:X(v),y2:Y(0)+4,stroke:'var(--border)'});
      label(X(v),Y(0)+19,v,{'text-anchor':'middle'});
      label(g.left-10,Y(v)+4,v,{'text-anchor':'end'});
    }
    label(g.left+side/2,g.width-6,'Feature x₁',{'text-anchor':'middle',class:'axis-title'});
    label(13,g.top+side/2,'Feature x₂',{'text-anchor':'middle',transform:`rotate(-90 13 ${g.top+side/2})`,class:'axis-title'});
    svg.setAttribute('aria-label',`${total} training points, ${classes} classes, ${metric.toUpperCase()} distance, K = ${k}. Query at (${query.x.toFixed(2)}, ${query.y.toFixed(2)}): ${result.winner<0?'tied vote':'predicted class '+names[result.winner]}.`);
  }
  function renderInspector(announce=true){
    const r=M.predict(points,query,k,metric,classes),tie=r.winner<0;
    $('prediction').textContent=tie?'Tied vote':`Predicted class ${names[r.winner]}`;
    $('query-x').value=query.x.toFixed(2);$('query-y').value=query.y.toFixed(2);
    $('votes').replaceChildren();
    r.counts.forEach((n,c)=>{
      const row=document.createElement('div');row.className='vote-row';
      row.innerHTML=`<span class="vote-label"><span class="symbol" style="color:${color(c)}">${symbols[c]}</span>${names[c]}</span><div class="vote-bar" aria-hidden="true"><div class="vote-fill" style="background:${color(c)};width:${n/k*100}%"></div></div><span class="vote-count">${n} / ${k}</span>`;
      $('votes').appendChild(row);
    });
    const winning=Math.max(...r.counts);
    $('vote-summary').textContent=tie?`${r.winners.map(c=>names[c]).join(' and ')} each have ${winning} vote${winning===1?'':'s'}. No unique winner.`:`${winning} of the ${k} nearest examples vote for ${names[r.winner]}.`;
    $('neighborhood').textContent=`${metric==='l2'?'Circle radius':'Diamond radius'}: ${r.neighbors.at(-1).distance.toFixed(3)} feature units.`;
    $('distance-label').textContent=`${metric.toUpperCase()} distance`;
    $('neighbors').replaceChildren();
    r.neighbors.forEach((n,i)=>{
      const tr=document.createElement('tr');tr.innerHTML=`<td>${i+1}</td><td>#${n.point.id}</td><td><span class="symbol" style="color:${color(n.point.c)}">${symbols[n.point.c]}</span> ${names[n.point.c]}</td><td class="numeric">${n.distance.toFixed(3)}</td>`;$('neighbors').appendChild(tr);
    });
    if(announce){clearTimeout(announceTimer);announceTimer=setTimeout(()=>{$('announcement').textContent=`${$('prediction').textContent}. ${$('vote-summary').textContent}`;},180);}
  }
  function requestMap(coarse=false){
    cancelAnimationFrame(mapFrame);const version=++mapVersion;
    dimensions();const cells=Math.max(24,Math.ceil(geometry.side/(coarse?9:3))),classify=M.makeClassifier(points,k,metric,classes);
    const style=getComputedStyle(document.documentElement);
    const rgb=key=>{const s=style.getPropertyValue(key).trim();return [parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];};
    const palette=keys.slice(0,classes).map(c=>rgb(`--map-${c}`)),neutral=rgb('--map-tie');
    const image=new ImageData(cells,cells);let row=0;
    plot.dataset.updating='true';$('map-status').textContent='Updating regions…';
    function paint(){
      if(version!==mapVersion)return;
      const start=performance.now();
      while(row<cells){
        const y=10-(row+.5)/cells*10;
        for(let col=0;col<cells;col++){
          const c=classify((col+.5)/cells*10,y),rgb=c<0?neutral:palette[c],offset=(row*cells+col)*4;
          image.data[offset]=rgb[0];image.data[offset+1]=rgb[1];image.data[offset+2]=rgb[2];image.data[offset+3]=255;
        }
        row++;if(row%4===0&&performance.now()-start>9)break;
      }
      if(row<cells){mapFrame=requestAnimationFrame(paint);return;}
      canvas.width=cells;canvas.height=cells;canvas.getContext('2d').putImageData(image,0,0);
      plot.dataset.updating='false';$('map-status').textContent=`${total} examples · ${metric.toUpperCase()} distance`;
    }
    mapFrame=requestAnimationFrame(paint);
  }
  function legend(){
    $('legend').replaceChildren();
    for(let c=0;c<classes;c++){const s=document.createElement('span');s.innerHTML=`<i class="symbol" style="color:${color(c)};font-style:normal">${symbols[c]}</i>Class ${names[c]}`;$('legend').appendChild(s);}
    const t=document.createElement('span');t.innerHTML='<i class="tie-swatch"></i>Tied vote';$('legend').appendChild(t);
  }
  function editor(){
    const p=points.find(p=>p.id===selectedId)||points[0];selectedId=p.id;
    $('edit-point').value=p.id;$('edit-x').value=p.x.toFixed(2);$('edit-y').value=p.y.toFixed(2);
  }
  function regenerate(){
    points=M.generate(total,classes,seed);selectedId=points[0].id;
    $('edit-point').replaceChildren();points.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=`#${p.id} · Class ${names[p.c]}`;$('edit-point').appendChild(o);});
    legend();editor();update(true);
  }
  function update(map=false,coarse=false){drawOverlay();renderInspector(!drag);if(map)requestMap(coarse);}
  $('k').addEventListener('input',()=>{k=Number($('k').value);$('k-value').textContent=k;update(true);});
  document.querySelectorAll('[name=metric]').forEach(radio=>radio.addEventListener('change',()=>{metric=radio.value;update(true);}));
  $('classes').addEventListener('change',()=>{classes=Number($('classes').value);regenerate();});
  $('count').addEventListener('change',()=>{total=Number($('count').value);regenerate();});
  $('resample').addEventListener('click',()=>{seed++;regenerate();});
  const clamp=v=>Math.max(0,Math.min(10,v));
  for(const axis of ['x','y']){
    $(`query-${axis}`).addEventListener('change',event=>{const v=event.target.valueAsNumber;if(Number.isFinite(v))query[axis]=clamp(v);update();});
    $(`edit-${axis}`).addEventListener('change',event=>{const v=event.target.valueAsNumber;if(Number.isFinite(v))points.find(p=>p.id===selectedId)[axis]=clamp(v);editor();update(true);});
  }
  $('edit-point').addEventListener('change',()=>{selectedId=Number($('edit-point').value);editor();});
  function position(event){const b=svg.getBoundingClientRect();return {x:clamp((event.clientX-b.left-geometry.left)/geometry.side*10),y:clamp(10-(event.clientY-b.top-geometry.top)/geometry.side*10)};}
  function move(event){
    const p=position(event);
    if(drag.type==='point'){Object.assign(points.find(p=>p.id===drag.id),p);editor();update(true,true);}
    else {query=p;update();}
  }
  svg.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const b=svg.getBoundingClientRect(),x=event.clientX-b.left,y=event.clientY-b.top,g=geometry;
    if(x<g.left||x>g.left+g.side||y<g.top||y>g.top+g.side)return;
    event.preventDefault();const target=points.map(p=>({p,d:Math.hypot(g.X(p.x)-x,g.Y(p.y)-y)})).sort((a,b)=>a.d-b.d)[0];
    const qdist=Math.hypot(g.X(query.x)-x,g.Y(query.y)-y),hit=event.pointerType==='touch'?22:12;
    if(target.d<hit&&target.d<qdist){selectedId=target.p.id;drag={type:'point',id:selectedId};editor();}
    else drag={type:'query'};
    svg.setPointerCapture(event.pointerId);svg.style.cursor='grabbing';move(event);
  });
  svg.addEventListener('pointermove',event=>{if(drag)move(event);});
  function end(){if(!drag)return;const map=drag.type==='point';drag=null;svg.style.cursor='crosshair';update(map);}
  svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);svg.addEventListener('lostpointercapture',end);
  new ResizeObserver(()=>{drawOverlay();requestMap();}).observe(plot);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{drawOverlay();requestMap();});
  regenerate();
})();
