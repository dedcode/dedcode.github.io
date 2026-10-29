const {test}=require('node:test');
const assert=require('node:assert/strict');
const {predict,makeClassifier,generate,distanceScore}=require('./model.js');
test('L1 and L2 can select different nearest examples',()=>{
 const p=[{id:1,x:3,y:0,c:0},{id:2,x:2,y:2,c:1}],q={x:0,y:0};
 assert.equal(predict(p,q,1,'l1',2).winner,0);
 assert.equal(predict(p,q,1,'l2',2).winner,1);
 assert.equal(predict(p,q,1,'l2',2).neighbors[0].distance,Math.sqrt(8));
});
test('majority, tied votes, and a tie among only the largest totals',()=>{
 const p=[0,1,2,3,4].map((x,i)=>({id:i,x,y:0,c:i<2?0:i<4?1:2}));
 assert.equal(predict(p,{x:0,y:0},3,'l2',3).winner,0);
 assert.equal(predict(p,{x:0,y:0},4,'l2',3).winner,-1);
 assert.deepEqual(predict(p,{x:0,y:0},5,'l2',3).winners,[0,1]);
});
test('equal distances select the lower point ID, independent of input order',()=>{
 const p=[{id:9,x:1,y:0,c:1},{id:2,x:-1,y:0,c:0}];
 for(const metric of ['l1','l2']){assert.equal(predict(p,{x:0,y:0},1,metric,2).neighbors[0].point.id,2);assert.equal(makeClassifier(p,1,metric,2)(0,0),0);}
});
test('zero distances, duplicated points, empty data, and K above the data count',()=>{
 const p=[{id:5,x:0,y:0,c:1},{id:3,x:0,y:0,c:0}];
 assert.equal(predict(p,{x:0,y:0},1,'l2',2).winner,0);
 assert.equal(predict(p,{x:0,y:0},99,'l2',2).winner,-1);
 assert.equal(makeClassifier([],3,'l2',2)(0,0),-1);
 assert.equal(predict([],{x:0,y:0},3,'l2',2).k,0);
});
test('dense map agrees with sorted prediction across metrics, K, classes and edited points',()=>{
 let checks=0;
 for(const classes of [2,3,4,5])for(const metric of ['l1','l2'])for(const k of [1,2,3,7,15]){
  const p=generate(40,classes,917);p[0].x=0;p[0].y=10;p[1].x=p[2].x;p[1].y=p[2].y;
  const grid=makeClassifier(p,k,metric,classes);
  for(let x=0;x<=10;x+=.5)for(let y=0;y<=10;y+=.5){assert.equal(grid(x,y),predict(p,{x,y},k,metric,classes).winner);checks++;}
 }
 assert.equal(checks,17640);
});
test('synthetic data is repeatable, bounded, balanced and nonconstant',()=>{
 assert.deepEqual(generate(40,4,42),generate(40,4,42));
 assert.notDeepEqual(generate(40,4,42),generate(40,4,43));
 for(const classes of [2,3,4,5])for(const n of [20,30,40,50,60,80,100]){
  const p=generate(n,classes);assert.equal(p.length,n);assert.equal(new Set(p.map(p=>p.id)).size,n);
  const counts=Array(classes).fill(0);for(const q of p){assert(q.x>=.35&&q.x<=9.65&&q.y>=.35&&q.y<=9.65);counts[q.c]++;}
  assert(Math.max(...counts)-Math.min(...counts)<=1);
 }
 assert.equal(distanceScore({x:1,y:1},{x:1,y:1},'l2'),0);
});
