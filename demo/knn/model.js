(function(root){
  'use strict';
  const LIMIT=10;
  function distanceScore(a,b,metric){const dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y);return metric==='l1'?dx+dy:dx*dx+dy*dy;}
  function vote(counts){const max=Math.max(...counts),winners=counts.map((n,c)=>n===max?c:-1).filter(c=>c>=0);return {winner:winners.length===1?winners[0]:-1,winners};}
  function predict(points,q,k,metric='l2',classes=5){
    const effectiveK=Math.max(0,Math.min(points.length,Math.floor(k)));
    const neighbors=points.map(p=>({point:p,score:distanceScore(p,q,metric)})).sort((a,b)=>a.score-b.score||a.point.id-b.point.id).slice(0,effectiveK);
    const counts=Array(classes).fill(0);
    neighbors.forEach(n=>{counts[n.point.c]++;n.distance=metric==='l1'?n.score:Math.sqrt(n.score);});
    return {neighbors,counts,k:effectiveK,...(effectiveK?vote(counts):{winner:-1,winners:[]})};
  }
  // Reuse scratch arrays for the dense map. Tie handling matches predict().
  function makeClassifier(points,k,metric,classes){
    const size=Math.max(0,Math.min(points.length,Math.floor(k))),scores=new Float64Array(size),ids=new Float64Array(size),labels=new Int16Array(size),counts=new Int16Array(classes);
    return function(x,y){
      if(!size)return -1;
      scores.fill(Infinity);ids.fill(Infinity);counts.fill(0);
      for(let i=0;i<points.length;i++){
        const p=points[i],dx=Math.abs(p.x-x),dy=Math.abs(p.y-y),s=metric==='l1'?dx+dy:dx*dx+dy*dy;
        let j=size-1;if(s>scores[j]||(s===scores[j]&&p.id>=ids[j]))continue;
        while(j>0&&(s<scores[j-1]||(s===scores[j-1]&&p.id<ids[j-1]))){scores[j]=scores[j-1];ids[j]=ids[j-1];labels[j]=labels[j-1];j--;}
        scores[j]=s;ids[j]=p.id;labels[j]=p.c;
      }
      for(let i=0;i<size;i++)counts[labels[i]]++;
      let best=-1,max=-1,tie=false;
      for(let c=0;c<classes;c++){if(counts[c]>max){max=counts[c];best=c;tie=false;}else if(counts[c]===max)tie=true;}
      return tie?-1:best;
    };
  }
  function generate(count,classes,seed=42){
    let state=seed>>>0;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296;};
    const normal=()=>Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());
    const centers=Array.from({length:classes},(_,c)=>{const a=2*Math.PI*c/classes+.4;return {x:5+2.45*Math.cos(a),y:5+2.45*Math.sin(a)};});
    return Array.from({length:count},(_,i)=>{const c=i%classes,p=centers[c];return {id:i+1,c,x:Math.max(.35,Math.min(9.65,p.x+normal()*1.18)),y:Math.max(.35,Math.min(9.65,p.y+normal()*1.18))};});
  }
  const api={LIMIT,distanceScore,predict,makeClassifier,generate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KNNModel=api;
})(typeof window!=='undefined'?window:this);
