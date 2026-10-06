(function(root){
 const datasets={overlap:{p:[.95,.9,.82,.75,.7,.65,.55,.5,.35,.2],n:[.88,.75,.68,.6,.5,.42,.3,.25,.15,.05]},perfect:{p:[.95,.91,.87,.83,.79,.75,.71,.67,.63,.59],n:[.45,.41,.37,.33,.29,.25,.21,.17,.13,.09]},reversed:{p:[.45,.41,.37,.33,.29,.25,.21,.17,.13,.09],n:[.95,.91,.87,.83,.79,.75,.71,.67,.63,.59]}};
 const data=name=>Object.entries(datasets[name]).flatMap(([label,scores])=>scores.map((score,i)=>({id:label+(i+1),positive:label==='p',score})));
 function counts(points,t){const tp=points.filter(p=>p.positive&&p.score>=t).length,fp=points.filter(p=>!p.positive&&p.score>=t).length,P=points.filter(p=>p.positive).length,N=points.length-P;return{tp,fp,fn:P-tp,tn:N-fp,tpr:tp/P,fpr:fp/N};}
 const levels=points=>[...new Set(points.map(p=>p.score))].sort((a,b)=>b-a);
 const curve=points=>[{threshold:1.01,...counts(points,1.01)},...levels(points).map(threshold=>({threshold,...counts(points,threshold)}))];
 function auc(points){let wins=0,ties=0,total=0;for(const p of points.filter(p=>p.positive))for(const n of points.filter(p=>!p.positive)){total++;if(p.score>n.score)wins++;else if(p.score===n.score)ties++;}return{wins,ties,total,value:(wins+ties/2)/total};}
 const api={data,counts,levels,curve,auc};if(typeof module!=='undefined')module.exports=api;else root.ROCModel=api;
})(typeof window!=='undefined'?window:this);
