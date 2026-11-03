/* 天津心血管疾病+队列: single-use browser-to-private-database CSV importer.
 * No patient rows are placed in GitHub or browser storage. Only memory and
 * TLS-authenticated RPC requests controlled by an authorized administrator.
 */
"use strict";
let responseResolve=null,responseReject=null,busy=false;
const FIELD_KEYS=Array.from({length:313},(_,i)=>"c"+String(i+1).padStart(3,"0"));
const MISSING=new Set(["","NA","N/A","NAN","NULL","NONE","--","—","未检测","未测"]);
function request(type,payload){
 return new Promise((resolve,reject)=>{
  responseResolve=resolve;responseReject=reject;postMessage({type,...payload});
 });
}
onmessage=(event)=>{
 const m=event.data||{};
 if(m.type==="ack"){const cb=responseResolve;responseResolve=null;responseReject=null;cb?.(m);}
 else if(m.type==="nack"){const cb=responseReject;responseResolve=null;responseReject=null;cb?.(new Error(m.message||"数据库写入失败"));}
 else if(m.type==="start"&&!busy){busy=true;run(m.file).catch(e=>postMessage({type:"error",message:String(e.message||e).slice(0,260)})).finally(()=>{busy=false;});}
};
async function run(file){
 if(!file||file.size<1000)throw Error("请选择原始 CSV 文件");
 const digest=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());
 const sha=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
 const decoder=new TextDecoder("utf-8",{fatal:true});
 const reader=file.stream().getReader();
 let cell="",row=[],header=null,numRows=0,quote=false,pendingQuote=false,afterCR=false,first=true;
 let batch=[],doneBytes=0,lastReport=0;
 let resumeFrom=1;
 const finishCell=()=>{row.push(cell);cell="";};
 const finishRow=async()=>{
  finishCell();const cells=row;row=[];
  if(first){first=false;header=cells.map((s,i)=>i===0?s.replace(/^\uFEFF/,""):s);
   if(header.length!==313||new Set(header).size!==313)throw Error("CSV字段必须是313个不重复名称");
   const init=await request("begin",{sha,headers:header,rows:50312});
   if (!init.accepted) throw new Error("导入登记未获确认");
   resumeFrom=Number(init.resume_from);
   if (!Number.isInteger(resumeFrom) || resumeFrom<1 || resumeFrom>50313)
     throw new Error("数据库续传游标无效，已停止上传");
   postMessage({type:"resuming",rows:resumeFrom-1,resume_from:resumeFrom,
     continuous:init.continuous!==false,already_complete:init.ready===true});
   return;
  }
  if(cells.length===1&&cells[0]==="")return;
  if(cells.length!==313)throw Error("CSV第"+(numRows+1)+"行列数异常");
  numRows++;if(numRows>50312)throw Error("CSV实际行数大于50312");
  // The file is parsed locally from the beginning for validation, but
  // previously confirmed rows are NOT re-encoded, queued, or uploaded.
  if(numRows<resumeFrom)return;
  const encoded={source_line:numRows};
  for(let k=0;k<313;k++){
   const value=cells[k];
   encoded[FIELD_KEYS[k]]=MISSING.has(value.trim().toUpperCase())?null:value;
  }
  batch.push(encoded);
  if(batch.length>=150)await flush();
 };
 const flush=async()=>{if(!batch.length)return;const payload=batch;batch=[];const ack=await request("batch",{sha,rows:payload});
  if(!ack.accepted)throw Error("服务器没有确认数据批次写入");
  if(Date.now()-lastReport>250){lastReport=Date.now();postMessage({type:"progress",rows:numRows,bytes:doneBytes,total:file.size});}};
 const parse=async text=>{
  for(let i=0;i<text.length;i++){
   const ch=text[i];
   if(afterCR){afterCR=false;if(ch==="\n")continue;}
   if(pendingQuote){pendingQuote=false;if(ch==='"'){cell+='"';continue;}quote=false;}
   if(quote){if(ch==='"')pendingQuote=true;else cell+=ch;continue;}
   if(ch==='"'&&cell===""){quote=true;continue;}
   if(ch===","){finishCell();continue;}
   if(ch==="\r"){await finishRow();afterCR=true;continue;}
   if(ch==="\n"){await finishRow();continue;}
   cell+=ch;
  }
 };
 for(;;){
  const p=await reader.read();if(p.done)break;
  doneBytes+=p.value.byteLength;await parse(decoder.decode(p.value,{stream:true}));
 }
 await parse(decoder.decode());
 if(pendingQuote){pendingQuote=false;quote=false;}
 if(quote)throw Error("CSV中存在未闭合的引号");
 if(cell.length||row.length)await finishRow();
 await flush();
 if(numRows!==50312)throw Error("原始文件行数不符，实际为"+numRows+"，未完成正式导入");
 await request("finish",{sha});
 postMessage({type:"complete",rows:numRows});
}
