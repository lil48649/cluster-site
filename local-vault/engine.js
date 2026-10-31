/* Browser-local CSV engine. Data is never sent to any network endpoint.
 * All records live in this Web Worker memory only until the page is closed.
 */
"use strict";
const MISSING = new Set(["","NA","N/A","NaN","NULL","null","None","none","--","—","未检测","未测"]);
let store = null, activeJob = 0;
function missing(v){ return MISSING.has(String(v).trim()); }
function num(v){const z=Number(v);return Number.isFinite(z)?z:NaN;}
function alloc(kind,cap){const data=kind==="number"?new Float64Array(cap):new Uint8Array(cap);if(kind==="number") data.fill(NaN);return data;}
function beginColumns(names,samples){
 const width=names.length,cap=16384, cols=[];
 for(let i=0;i<width;i++){
  let observed=0,valid=0;
  for(const r of samples){const v=r[i];if(missing(v))continue;observed++;if(Number.isFinite(num(v)))valid++;}
  const kind=observed>0&&valid/observed>=0.90?"number":"category";
  cols.push({name:names[i],kind,data:alloc(kind,cap),values:kind==="category"?[""]:null,
    codes:kind==="category"?new Map([["",0]]):null,missing:0,invalid:0});
 }
 return {cols,names,cap,count:0,badRows:0};
}
function grow(){
 const cap=store.cap*2;
 if(cap>2000000)throw Error("文件行数超出本地查询引擎容量限制");
 for(const c of store.cols){const next=alloc(c.kind,cap);next.set(c.data);c.data=next;}
 store.cap=cap;
}
function addRow(row){
 if(row.length!==store.cols.length){store.badRows++;return;}
 if(store.count>=store.cap)grow();
 const idx=store.count++;
 for(let k=0;k<store.cols.length;k++){
  const c=store.cols[k], raw=String(row[k]??"").trim();
  if(missing(raw)){c.missing++;if(c.kind==="category")c.data[idx]=0;continue;}
  if(c.kind==="number"){
   const n=num(raw);
   if(Number.isFinite(n))c.data[idx]=n;else{c.invalid++;c.missing++;c.data[idx]=NaN;}
  } else{
   let code=c.codes.get(raw);
   if(code===undefined){
    code=c.values.length;
    if(code>=65535)throw Error("某文本字段的不同取值数量超过本地编码限制");
    if(code===256 && c.data instanceof Uint8Array){const next=new Uint16Array(store.cap);next.set(c.data);c.data=next;}
    c.values.push(raw);c.codes.set(raw,code);
   }
   c.data[idx]=code;
  }
 }
}
function cell(c,i){const v=c.data[i];return c.kind==="number"?(Number.isFinite(v)?v:null):(c.values[v]||null);}
function fit(i,filters){
 for(const f of filters){
  const c=store.cols[f.c];if(!c)continue;const v=cell(c,i);
  if(f.op==="missing"){if(v!==null) return false;continue;}
  if(f.op==="present"){if(v===null) return false;continue;}
  if(v===null)return false;
  if(f.op==="contains"){if(!String(v).toLowerCase().includes(String(f.v||"").toLowerCase()))return false;continue;}
  if(f.op==="eq"||f.op==="ne"){const ok=String(v).toLowerCase()===String(f.v||"").trim().toLowerCase();if(f.op==="eq"?!ok:ok)return false;continue;}
  if(c.kind!=="number")return false;
  const n=num(f.v);if(!Number.isFinite(n))return false;
  if(f.op==="gt"&&!(v>n))return false;
  if(f.op==="gte"&&!(v>=n))return false;
  if(f.op==="lt"&&!(v<n))return false;
  if(f.op==="lte"&&!(v<=n))return false;
 }
 return true;
}
function distribution(col,indices){
 const c=store.cols[col];if(!c)return {type:"empty",items:[]};
 if(c.kind==="category"){
  const counts=new Map(),limit=indices.length;
  for(let a=0;a<limit;a++){const v=cell(c,indices[a]);const k=v===null?"(缺失)":String(v);counts.set(k,(counts.get(k)||0)+1);}
  const all=Array.from(counts,([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
  return {type:"category",items:all.slice(0,20),other:all.slice(20).reduce((s,v)=>s+v.value,0)};
 }
 let min=Infinity,max=-Infinity,n=0,sum=0,missingCount=0;
 for(const i of indices){const v=cell(c,i);if(v===null){missingCount++;continue;}min=Math.min(min,v);max=Math.max(max,v);sum+=v;n++;}
 if(!n)return {type:"numeric",items:[],n:0,missing:missingCount};
 const bins=12,counts=new Array(bins).fill(0),step=max===min?1:(max-min)/bins;
 for(const i of indices){const v=cell(c,i);if(v===null)continue;const j=Math.min(bins-1,Math.floor((v-min)/step));counts[j]++;}
 return {type:"numeric",n,missing:missingCount,mean:sum/n,min,max,
  items:counts.map((v,i)=>({label: max===min?String(min):((min+step*i).toPrecision(4)+"–"+(min+step*(i+1)).toPrecision(4)),value:v}))};
}
async function load(file,job){
 store=null;
 const reader=file.stream().getReader(),decoder=new TextDecoder("utf-8",{fatal:true});
 let inQuotes=false,pendingQuote=false,afterCR=false,field="",row=[],headers=null,sample=[],processed=0,sampleSize=1100,lastReport=0;
 const completeField=()=>{row.push(field);field="";};
 const completeRow=()=>{
  completeField();const completed=row;row=[];
  if(headers===null){headers=completed.map((x,i)=>i===0?x.replace(/^\uFEFF/,"").trim():x.trim());
    if(!headers.length||headers.length>3000||headers.some(x=>!x))throw Error("CSV字段名为空或列数超出限制");
    if(new Set(headers).size!==headers.length)throw Error("CSV中存在重复字段名");
  }else if(!store){sample.push(completed);if(sample.length>=sampleSize){store=beginColumns(headers,sample);for(const x of sample)addRow(x);sample=[];}}
  else addRow(completed);
 };
 const chunk=(text)=>{
  for(let i=0;i<text.length;i++){
   const ch=text[i];
   if(afterCR){afterCR=false;if(ch==="\n")continue;}
   if(pendingQuote){pendingQuote=false;if(ch==='"'){field+='"';continue;}inQuotes=false;}
   if(inQuotes){if(ch==='"')pendingQuote=true;else field+=ch;continue;}
   if(ch==='"'&&field===""){inQuotes=true;continue;}
   if(ch===","){completeField();continue;}
   if(ch==="\r"){completeRow();afterCR=true;continue;}
   if(ch==="\n"){completeRow();continue;}
   field+=ch;
  }
 };
 try{
  for(;;){
   const part=await reader.read();if(part.done)break;
   if(activeJob!==job){try{reader.cancel()}catch(e){}return;}
   processed+=part.value.byteLength;
   chunk(decoder.decode(part.value,{stream:true}));
   if(Date.now()-lastReport>450){lastReport=Date.now();postMessage({type:"progress",loaded:processed,size:file.size,rows:store?store.count:sample.length});}
  }
  chunk(decoder.decode());
  if(pendingQuote){pendingQuote=false;inQuotes=false;}
  if(inQuotes)throw Error("CSV中存在未关闭的引号");
  if(field.length||row.length)completeRow();
  if(!store){store=beginColumns(headers||[],sample);for(const x of sample)addRow(x);}
  if(!store.count)throw Error("文件不包含有效数据记录");
  const meta=store.cols.map((c,i)=>({index:i,name:c.name,kind:c.kind,missing:c.missing,invalid:c.invalid,
      unique:c.kind==="category"?c.values.length-1:null,
      options:c.kind==="category"&&c.values.length<=22?c.values.slice(1):null}));
  postMessage({type:"loaded",rows:store.count,columns:meta,width:store.cols.length,badRows:store.badRows,bytes:file.size,
    missing:store.cols.reduce((sum,c)=>sum+c.missing,0)});
 }catch(e){store=null;postMessage({type:"error",message:String(e.message||e).slice(0,250)});}
}
function query(msg){
 if(!store)return;
 try{
 const filters=Array.isArray(msg.filters)?msg.filters.slice(0,8):[];
 const indices=[];
 for(let i=0;i<store.count;i++)if(fit(i,filters))indices.push(i);
 const order=Number(msg.order);
 if(Number.isInteger(order)&&store.cols[order]){
  const c=store.cols[order],asc=msg.desc?-1:1;
  indices.sort((a,b)=>{const va=cell(c,a),vb=cell(c,b);if(va===null)return 1;if(vb===null)return -1;
    return (c.kind==="number"?va-vb:String(va).localeCompare(String(vb),"zh"))*asc;});
 }
 const pageSize=Math.min(100,Math.max(10,Number(msg.pageSize)||30)),page=Math.max(1,Number(msg.page)||1);
 const first=(page-1)*pageSize;
 const selected=(msg.visible||[]).filter(k=>Number.isInteger(k)&&store.cols[k]).slice(0,16);
 const rows=indices.slice(first,first+pageSize).map(i=>({row:i+1,values:selected.map(k=>cell(store.cols[k],i))}));
 const chart=Number.isInteger(msg.chart)?distribution(msg.chart,indices):null;
 postMessage({type:"result",id:msg.id,total:indices.length,page,pages:Math.max(1,Math.ceil(indices.length/pageSize)),
  selected,rows,chart});
 }catch(e){postMessage({type:"error",message:String(e.message||e).slice(0,180)})}
}
onmessage=(event)=>{
 const m=event.data||{};
 if(m.type==="load"&&m.file){activeJob++;load(m.file,activeJob);}
 else if(m.type==="query")query(m);
 else if(m.type==="clear"){activeJob++;store=null;postMessage({type:"cleared"});}
};
