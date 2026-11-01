/* 天津心血管疾病+队列 / 正式数据管理
 * Patient data: never GitHub, never browser storage, never CSV/Excel export.
 * Single-use admin importer and least-privilege paged database access only.
 */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const fmt=n=>Number(n??0).toLocaleString("zh-CN");
const state={status:null,fields:[],allFields:[],page:1,size:20,filters:[],worker:null,inProgress:false,started:false,view:"overview"};
const rpc=(name,args={})=>window.CLINICAL_PREVIEW_RPC(name,args);
function notice(message){const el=$("error");el.textContent=message;el.hidden=!message;}
function base(){
 const root=$("app");root.className="app vault-shell";
 root.innerHTML=
 '<aside class="vault-sidebar">'+
  '<div class="vault-brand"><div class="vault-logo">♥</div><div><strong>天津心血管疾病+队列</strong><small>TIANJIN CARDIOVASCULAR COHORT</small></div></div>'+
  '<div class="vault-navtitle">队列科研管理</div>'+
  '<button class="vault-nav active" type="button" data-view="overview">▦　队列概览</button>'+
  '<button class="vault-nav" type="button" data-view="records">☷　队列数据检索</button>'+
  '<div class="vault-bottom"><span class="vault-dot"></span> 研究成员身份验证 · 私有数据</div>'+
 '</aside>'+
 '<div class="vault-right"><header class="vault-top"><div><small>天津心血管疾病+队列 / 科研数据平台</small><strong id="pageTitle">队列概览</strong></div>'+
 '<div class="vault-actions"><span class="vault-shield"><span class="vault-dot"></span> TOTP 双因素验证</span></div></header>'+
 '<main class="vault-main"><section class="vault-hero"><div><div class="vault-eyebrow">TIANJIN CARDIOVASCULAR COHORT · SECURE DATA PLATFORM</div>'+
 '<h1>天津心血管疾病+队列</h1><p>研究数据集中管理 · 授权访问 · 服务器端检索与分页</p></div><div class="vault-hero-chip">SECURE COHORT</div></section>'+
 '<div id="error" class="clinical-error" hidden></div>'+
 '<div id="load" class="clinical-loading">正在核验身份和正式数据库状态…</div>'+
 '<div id="site" hidden>'+
  '<section class="vault-stats">'+
   '<div class="vault-stat"><small>正式入库记录</small><strong id="total">—</strong><span>服务器端记录数</span></div>'+
   '<div class="vault-stat"><small>队列字段</small><strong id="fieldCount">—</strong><span>原始宽表字段</span></div>'+
   '<div class="vault-stat"><small>可见字段</small><strong id="visibleCount">—</strong><span>管理员审核后开放</span></div>'+
   '<div class="vault-stat"><small>数据状态</small><strong id="dataState">—</strong><span>受控数据库</span></div>'+
  '</section>'+
  '<section class="vault-pane active" data-pane="overview">'+
    '<div class="vault-block"><div class="vault-block-head"><div><h2>队列数据概况</h2><p>真实患者数据由数据库集中存储；每位成员按权限访问，无需在不同电脑重复上传</p></div></div>'+
     '<div id="cohortChart" hidden><div class="vault-block-head"><div><h2>队列变量统计</h2><p>仅显示经过批准的字段，人数小于5的分组不单独显示</p></div><select id="chartField" class="vault-select"></select></div><div id="chartContent" class="vault-plot"></div></div>'+
  '<div id="importSection">'+
      '<div class="vault-warning"><strong>首次导入：</strong>仅管理员可将本机原始 CSV 经加密连接写入私有数据库。浏览器不在本机永久保存文件，也不向 GitHub 传输记录。正式数据尚未入库时，不能展示真实记录。</div>'+
      '<label for="importFile" class="vault-primary">管理员选择 CSV，开始一次性导入</label><input id="importFile" type="file" accept=".csv,text/csv" hidden>'+
      '<p class="clinical-muted" id="importHelp">首次操作需要选取原始113 MB CSV。若网络中断，可重新选择同一文件恢复导入。</p>'+
      '<div class="vault-progress" id="uploadProgress" hidden><div id="uploadBar"></div></div>'+
      '<p id="uploadText" class="clinical-muted" aria-live="polite"></p>'+
     '</div>'+
     '<div id="importNoAdmin" class="vault-warning" hidden>正式数据尚未导入。请由项目管理员登录执行一次性导入。</div>'+
     '<div id="readyText" class="vault-warning" hidden>正式数据已经导入。所有成员通过同一数据库检索，不需要再次上传CSV。</div>'+
    '</div>'+
    '<div class="vault-block" id="permissionCard" hidden><div class="vault-block-head"><div><h2>研究字段授权</h2><p>仅管理员可以审核字段；默认不开放任何患者级字段，单次最多选择15项</p></div>'+
      '<button id="saveFields" class="vault-primary" type="button">保存可见字段</button></div>'+
      '<p class="clinical-muted">请特别注意姓名、身份证号、联系电话、住院号以及可能重新识别患者的字段。未勾选字段不会进入普通成员的查询结果。</p>'+
      '<input id="fieldSearch" class="vault-input" type="search" placeholder="搜索本次导入的临床字段…">'+
      '<div id="fieldReview" class="cohort-field-list"></div></div>'+
  '</section>'+
  '<section class="vault-pane" data-pane="records">'+
    '<div class="vault-block"><div class="vault-block-head"><div><h2>队列数据检索</h2><p>服务器端限制单页最多25条，查询仅返回经过管理员批准的字段</p></div></div>'+
      '<div id="searchBlock" hidden>'+
       '<div class="clinical-filters"><label>筛选字段<select id="filterField" class="vault-select"></select></label>'+
       '<label>运算<select id="filterOp" class="vault-select"><option value="eq">等于</option><option value="gte">大于或等于</option><option value="lte">小于或等于</option></select></label>'+
       '<label>筛选值<input id="filterValue" class="vault-input" placeholder="输入筛选值"></label>'+
       '<button id="apply" class="vault-primary" type="button">查询</button><button id="clear" class="vault-outline" type="button">重置</button></div>'+
       '<div class="vault-table-scroll"><table class="vault-table"><thead id="heads"></thead><tbody id="rows"></tbody></table></div>'+
       '<div class="vault-pagination"><span id="pageText"></span><div><button type="button" id="prev" class="vault-outline">上一页</button><button type="button" id="next" class="vault-outline">下一页</button></div></div>'+
      '</div><p id="searchUnavailable" class="clinical-muted">正式数据库及字段授权完成后开放检索。</p>'+
    '</div>'+
  '</section>'+
 '</div><footer class="vault-footer">天津心血管疾病+队列 · 私有科研数据库 · 严禁未经授权的患者数据导出</footer></main></div>';
 const logout=$("logoutBtn");if(logout){logout.hidden=false;logout.className="vault-outline";root.querySelector(".vault-actions").appendChild(logout);}
 root.querySelectorAll(".vault-nav").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
 $("importFile").addEventListener("change",e=>{if(e.target.files?.[0])startImport(e.target.files[0]);});
 $("fieldSearch").addEventListener("input",renderReview);
 $("chartField").addEventListener("change",updateChart);
 $("saveFields").addEventListener("click",saveApprovedFields);
 $("apply").addEventListener("click",()=>{const v=$("filterValue").value.trim();state.filters=v?[{field:$("filterField").value,op:$("filterOp").value,value:v}]:[];state.page=1;search();});
 $("clear").addEventListener("click",()=>{$("filterValue").value="";state.filters=[];state.page=1;search();});
 $("prev").addEventListener("click",()=>{state.page=Math.max(1,state.page-1);search();});
 $("next").addEventListener("click",()=>{state.page+=1;search();});
}
function navigate(view){
 state.view=view;$("pageTitle").textContent=view==="overview"?"队列概览":"队列数据检索";
 document.querySelectorAll(".vault-nav").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 document.querySelectorAll(".vault-pane").forEach(b=>b.classList.toggle("active",b.dataset.pane===view));
}
async function refresh(){
 const stat=await rpc("tj_cv_import_progress");
 if(!stat||typeof stat.admin!=="boolean")throw Error("没有得到数据库权限状态");
 state.status=stat;
 $("total").textContent=fmt(stat.imported);
 $("fieldCount").textContent=stat.ready?"313":"—";
 $("dataState").textContent=stat.ready?"已就绪":stat.status==="loading"?"导入中":"待导入";
 $("importSection").hidden=stat.ready||!stat.admin;
 $("importNoAdmin").hidden=stat.ready||stat.admin;
 $("readyText").hidden=!stat.ready;
 $("site").hidden=false;$("load").hidden=true;
 if(stat.ready){
  state.fields=await rpc("tj_cv_fields",{p_include_hidden:false});
  $("visibleCount").textContent=fmt(state.fields.length);
  if(stat.admin){state.allFields=await rpc("tj_cv_fields",{p_include_hidden:true});$("permissionCard").hidden=false;renderReview();}
  if(state.fields.length){$("searchBlock").hidden=false;$("searchUnavailable").hidden=true;renderFilterOptions();$("cohortChart").hidden=false;$("chartField").innerHTML=state.fields.map(f=>'<option value="'+esc(f.key)+'">'+esc(f.name)+'</option>').join("");await updateChart();if(state.view==="records")await search();}
  else {$("searchBlock").hidden=true;$("searchUnavailable").hidden=false;}
 }else{$("visibleCount").textContent="—";}
}
async function updateChart(){
 if(!state.fields.length)return;
 const key=$("chartField").value||state.fields[0].key;
 try{const data=await rpc("tj_cv_distribution",{p_field:key});const bars=data.groups||[];
  const m=Math.max(1,...bars.map(b=>Number(b.count)||0));
  $("chartContent").innerHTML=bars.map(b=>'<div class="vault-bar"><span>'+esc(b.name)+'</span><div class="vault-bar-track"><div style="width:'+(100*b.count/m).toFixed(1)+'%"></div></div><strong>'+fmt(b.count)+'</strong></div>').join("")||
    '<p class="clinical-muted">没有可公开的统计分组</p>';
 }catch(e){$("chartContent").textContent="该字段统计暂不可用。";}
}
function renderReview(){
 const q=$("fieldSearch").value.trim().toLowerCase();
 const list=state.allFields.filter(x=>!q||x.name.toLowerCase().includes(q));
 $("fieldReview").innerHTML=list.map(f=>'<label class="cohort-field-row"><input type="checkbox" data-pos="'+f.position+'"'+(f.visible?' checked':'')+'><span>'+esc(f.name)+'</span><small>'+esc(f.type)+'</small></label>').join("");
}
async function saveApprovedFields(){
 if(!state.status?.admin)return;
 const checked=[...document.querySelectorAll('#fieldReview input[type="checkbox"]:checked')].map(x=>Number(x.dataset.pos));
 const unseen=state.allFields.filter(f=>f.visible&&!document.querySelector('#fieldReview input[data-pos="'+f.position+'"]')).map(x=>x.position);
 const selected=[...new Set([...checked,...unseen])];
 if(selected.length>15){notice("最多开放15个字段，请先减少勾选项。");return;}
 if(!confirm("确定向所有授权项目组成员开放所选的 "+selected.length+" 个字段吗？请先确认不包含患者身份标识或不宜共享的敏感信息。"))return;
 try{await rpc("tj_cv_admin_set_visible",{p_positions:selected});notice("");await refresh();}
 catch(e){notice("保存字段授权失败，请检查管理员权限和字段数量。");}
}
function renderFilterOptions(){
 $("filterField").innerHTML=state.fields.map(f=>'<option value="'+esc(f.key)+'">'+esc(f.name)+'</option>').join("");
}
async function search(){
 if(!state.status?.ready||!state.fields.length)return;
 $("rows").innerHTML='<tr><td>正在读取受限数据库…</td></tr>';
 try{
  const r=await rpc("tj_cv_search",{p_page:state.page,p_size:20,p_filters:state.filters});
  $("heads").innerHTML='<tr><th>内部行号</th>'+state.fields.map(f=>'<th>'+esc(f.name)+'</th>').join("")+'</tr>';
  $("rows").innerHTML=r.rows.length?r.rows.map(x=>'<tr><td class="vault-rowid">'+fmt(x.source_line)+'</td>'+
   state.fields.map(f=>'<td>'+esc(x[f.key]===null||x[f.key]===undefined?"—":x[f.key])+'</td>').join("")+'</tr>').join(""):
   '<tr><td colspan="'+(1+state.fields.length)+'">无匹配记录</td></tr>';
  $("pageText").textContent="匹配 "+fmt(r.total)+" 条 · 第 "+r.page+" 页 · 每页最多25条";
  $("prev").disabled=r.page<=1;$("next").disabled=r.page*r.page_size>=r.total;
 }catch(e){$("rows").innerHTML="";notice("查询暂不可用，请检查字段授权或查询权限。");}
}
async function startImport(file){
 if(!state.status?.admin||state.inProgress)return;
 if(!/\.csv$/i.test(file.name)){notice("请选择CSV文件。");return;}
 state.inProgress=true;notice("");
 // Only the duration of a genuinely active import is protected from idle logout.
 window.TJ_CV_IMPORT_LIFECYCLE?.(true);
 const logout=$("logoutBtn");if(logout)logout.disabled=true;
 $("importFile").value=""; // Re-selecting the same file must always trigger change.
 $("importHelp").textContent="正在计算SHA-256并分批传输。请保持此页面打开，不要关闭浏览器。";
 $("uploadProgress").hidden=false;$("uploadBar").style.width="0%";
 const w=new Worker("import-worker.js?v=tj-cv-resume-fix-3");state.worker=w;
 w.onmessage=async event=>{
  const m=event.data||{};
  if(m.type==="resuming"){
   const existing=Number(m.rows)||0;
   $("uploadBar").style.width=Math.min(99,100*existing/163335).toFixed(1)+"%";
   $("uploadText").textContent=existing>0
     ?"已保存 "+fmt(existing)+" 条；从第 "+fmt(m.resume_from)+" 条开始补传。正在本机跳过已保存行，不重新上传。"
     :"数据库尚无记录，将从第一条开始导入。";
  }else if(m.type==="progress"){
   $("uploadBar").style.width=Math.min(99,100*m.bytes/m.total).toFixed(1)+"%";
   $("uploadText").textContent="已向数据库提交 "+fmt(m.rows)+" / 163,335 行（服务端批次确认）";
  }else if(m.type==="error"){
   state.inProgress=false;window.TJ_CV_IMPORT_LIFECYCLE?.(false);
   if($("logoutBtn"))$("logoutBtn").disabled=false;
   notice("导入中断："+m.message+"。重新选择相同CSV可继续导入。");
   $("uploadText").textContent="导入暂停";w.terminate();
  }
  else if(m.type==="complete"){
   state.inProgress=false;window.TJ_CV_IMPORT_LIFECYCLE?.(false);
   if($("logoutBtn"))$("logoutBtn").disabled=false;
   w.terminate();$("uploadBar").style.width="100%";$("uploadText").textContent="全部163,335条记录已导入";await refresh();
  }else if(["begin","batch","finish"].includes(m.type)){
   try{
    let result;
    if(m.type==="begin")result=await rpc("tj_cv_import_begin",{p_sha256:m.sha,p_expected:m.rows,p_headers:m.headers});
    if(m.type==="batch")result=await rpc("tj_cv_import_batch",{p_sha256:m.sha,p_rows:m.rows});
    if(m.type==="finish")result=await rpc("tj_cv_import_finish",{p_sha256:m.sha});
    if(m.type==="finish" ? result?.ready!==true : result?.accepted!==true)throw new Error("RPC_FAILED_ACK");
    w.postMessage({type:"ack",accepted:true,new_rows:result?.new_rows||0,
       resume_from:result?.resume_from,continuous:result?.continuous,ready:result?.ready});
   }catch(e){
    const stage={begin:"登记文件",batch:"写入记录",finish:"完成核验"}[m.type]||"数据库操作";
    const code=String(e?.code||"NETWORK").replace(/[^A-Za-z0-9_-]/g,"").slice(0,15)||"UNKNOWN";
    w.postMessage({type:"nack",message:stage+"失败 ["+code+"]。请记录此错误代码，同一文件可以安全重试。"});
   }
  }
 };
 w.onerror=()=>{
   state.inProgress=false;window.TJ_CV_IMPORT_LIFECYCLE?.(false);
   if($("logoutBtn"))$("logoutBtn").disabled=false;
   notice("本机解析程序出现错误，请刷新后重试同一个文件。");w.terminate();
 };
 w.postMessage({type:"start",file});
}
async function init(){
 base();try{await refresh()}catch(e){$("load").hidden=true;notice("数据库连接未通过安全核验，请确认登录会话和双因素认证状态。");}
}
init();
})();