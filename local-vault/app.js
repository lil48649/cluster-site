/* GBD Research Hub | Local Vault
 * The clinical CSV never leaves the user's browser. No fetch, XHR, uploads,
 * remote imports, analytics, browser storage, or data-side network requests.
 */
(function(){
"use strict";
const byId=id=>document.getElementById(id);
const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state={worker:null,columns:[],rowCount:0,missing:0,badRows:0,bytes:0,filters:[],visible:[],chart:0,sort:-1,desc:false,page:1,pageSize:30,requestId:0,loading:false,ready:false,result:null,active:"overview"};
const number=n=>Number(n||0).toLocaleString("zh-CN"),pct=(n,d)=>d?(100*n/d).toFixed(1)+"%":"0%";
function worker(){if(state.worker)state.worker.terminate();state.worker=new Worker("engine.js?v=local-vault-1");state.worker.onmessage=message;state.worker.onerror=()=>fail("本地数据引擎遇到异常，请重新选择文件。");}
function fail(message){state.loading=false;byId("loadStatus").textContent=message;byId("loadStatus").classList.add("has-error");}
function makeLayout(){
 const holder=byId("app");
 holder.className="app vault-shell";
 holder.innerHTML=`
 <aside class="vault-sidebar">
   <div class="vault-brand"><div class="vault-logo">✚</div><div><strong>Research Hub</strong><small>LOCAL CLINICAL DATA</small></div></div>
   <div class="vault-navtitle">数据管理</div>
   <button class="vault-nav active" data-view="overview">▦　数据总览</button>
   <button class="vault-nav" data-view="records">☷　数据检索</button>
   <button class="vault-nav" data-view="dictionary">▤　字段字典</button>
   <button class="vault-nav" data-view="quality">✓　质量核验</button>
   <div class="vault-bottom"><span class="vault-dot"></span> 本机处理 · 不上传患者数据</div>
 </aside>
 <div class="vault-right">
  <header class="vault-top"><div><small>科研数据 / 本地临床数据</small><strong id="pageName">数据总览</strong></div>
   <div class="vault-actions"><span class="vault-shield"> <span class="vault-dot"></span> 双因素认证已通过</span>
   <button class="vault-outline" id="clearData" disabled>清除本机数据</button><button id="logoutBtn" class="vault-outline">退出账号</button></div></header>
  <main class="vault-main">
   <section class="vault-hero"><div><div class="vault-eyebrow">CLINICAL RESEARCH WORKSPACE</div>
     <h1>临床科研数据管理系统</h1><p>选择本机CSV，浏览器内完成筛选、分布统计与质量核验。记录不上传服务器。</p></div>
     <div class="vault-hero-chip">PRIVATE · LOCAL ONLY</div></section>
   <div class="vault-warning"> <strong>保密说明：</strong>CSV 文件通过本机文件选择器读取，数据只进入本页 Web Worker 内存；网页刷新或退出后需要重新选择文件。账号验证需要连接 Supabase，但患者记录不参与网络请求。请仅在可信电脑和浏览器中使用。</div>
   <section class="vault-uploader" id="uploader"><div class="vault-upload-icon">⇧</div><div><strong>选择本机临床 CSV 文件</strong>
     <p>支持 UTF-8 CSV、中文字段名及大文件。请勿将文件添加到 GitHub 仓库。</p>
     <div id="loadStatus" aria-live="polite">尚未选择文件。</div>
     <div class="vault-progress" id="progressWrap" hidden><div id="progressBar"></div></div></div>
     <label for="vaultFile" class="vault-primary vault-pick">选择本机 CSV</label><input type="file" id="vaultFile" accept=".csv,text/csv" hidden></section>
   <div id="datasetContent" hidden>
    <section class="vault-stats">
      <div class="vault-stat"><small>总记录数</small><strong id="rowCount">—</strong><span>本地 CSV 记录</span></div>
      <div class="vault-stat"><small>字段数</small><strong id="colCount">—</strong><span>完整原始字段</span></div>
      <div class="vault-stat"><small>缺失单元格</small><strong id="missingCount">—</strong><span id="missingRate">原始文件检查</span></div>
      <div class="vault-stat"><small>当前匹配</small><strong id="matchedCount">—</strong><span>动态筛选结果</span></div>
    </section>
    <section data-pane="overview" class="vault-pane active">
      <div class="vault-block"><div class="vault-block-head"><div><h2>变量分布概览</h2><p>选择任意字段，按当前筛选条件生成频数或数值区间分布</p></div>
         <select id="chartField" class="vault-select" aria-label="图表字段"></select></div>
         <div id="chartSummary" class="vault-chart-summary"></div><div id="chart" class="vault-chart">请选择数据</div></div>
      <div class="vault-block"><div class="vault-block-head"><div><h2>数据概况</h2><p>仅展示本地计算结果，不进行任何云端同步</p></div></div>
       <div id="overviewNotes" class="vault-notes"></div></div>
    </section>
    <section data-pane="records" class="vault-pane">
      <div class="vault-block"><div class="vault-block-head"><div><h2>多条件数据检索</h2><p>字段可自由选择；多个条件之间为“且”关系</p></div>
        <button class="vault-outline" id="addFilter">+ 添加筛选条件</button></div>
        <div id="filterRows"></div>
        <div class="vault-search-actions"><button class="vault-primary" id="applyFilters">应用筛选</button><button class="vault-outline" id="resetFilters">清空条件</button></div></div>
      <div class="vault-block"><div class="vault-block-head"><div><h2>原始记录浏览</h2><p>每页只渲染少量数据，不加载完整宽表到页面</p></div>
       <label>每页 <select id="pageSize" class="vault-select"><option>20</option><option selected>30</option><option>50</option><option>100</option></select> 条</label></div>
       <div class="vault-options"><label>显示字段 <select id="addColumn" class="vault-select"><option value="">+ 添加字段</option></select></label>
         <div id="visibleColumns" class="vault-chips"></div></div>
       <div class="vault-options"><label>排序字段 <select id="sortField" class="vault-select"><option value="-1">原始顺序</option></select></label>
         <label class="vault-check"><input type="checkbox" id="sortDesc"> 降序</label><button id="exportPage" class="vault-outline">下载当前页 CSV（仅本机）</button></div>
       <div class="vault-table-scroll"><table class="vault-table"><thead id="resultHead"></thead><tbody id="resultBody"></tbody></table></div>
       <div class="vault-pagination"><span id="pageLabel">—</span><div><button id="prevPage" class="vault-outline">上一页</button><button id="nextPage" class="vault-outline">下一页</button></div></div></div>
    </section>
    <section data-pane="dictionary" class="vault-pane">
     <div class="vault-block"><div class="vault-block-head"><div><h2>完整字段字典</h2><p>自动从你选择的文件生成，无需预先公开字段定义</p></div></div>
       <input id="dictSearch" class="vault-input" type="search" placeholder="搜索字段名…">
       <div class="vault-table-scroll"><table class="vault-table"><thead><tr><th>#</th><th>字段</th><th>本地识别类型</th><th>缺失数量</th><th>缺失率</th></tr></thead><tbody id="dictBody"></tbody></table></div></div>
    </section>
    <section data-pane="quality" class="vault-pane">
     <div class="vault-block"><div class="vault-block-head"><div><h2>数据质量检查</h2><p>只作结构、类型和缺失检查；不对医学数据自动修正</p></div></div>
       <div id="qualityNotes" class="vault-notes"></div></div>
    </section>
   </div>
   <footer class="vault-footer">GBD Research Hub · Local Clinical Vault · 无患者数据上传 · 浏览器会话结束即释放</footer>
  </main>
 </div>`;
 holder.querySelectorAll(".vault-nav").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.view)));
 byId("vaultFile").addEventListener("change",e=>{if(e.target.files?.[0])load(e.target.files[0]);});
 byId("clearData").addEventListener("click",()=>{if(confirm("确定清除当前浏览器中的所有临床数据？此操作不删除你的原 CSV 文件。")){worker();state.ready=false;state.columns=[];state.result=null;byId("datasetContent").hidden=true;byId("uploader").hidden=false;byId("loadStatus").textContent="本地数据已清除。";byId("vaultFile").value="";byId("clearData").disabled=true;}});
 byId("chartField").addEventListener("change",e=>{state.chart=Number(e.target.value);query();});
 byId("addFilter").addEventListener("click",()=>{if(state.filters.length>=8)return;state.filters.push({c:0,op:"eq",v:""});renderFilters();});
 byId("applyFilters").addEventListener("click",()=>{readFilters();state.page=1;query();});
 byId("resetFilters").addEventListener("click",()=>{state.filters=[];renderFilters();state.page=1;query();});
 byId("filterRows").addEventListener("click",e=>{if(e.target.closest("[data-remove]")){const idx=Number(e.target.closest("[data-remove]").dataset.remove);state.filters.splice(idx,1);renderFilters();state.page=1;query();}});
 byId("pageSize").addEventListener("change",e=>{state.pageSize=Number(e.target.value);state.page=1;query();});
 byId("sortField").addEventListener("change",e=>{state.sort=Number(e.target.value);state.page=1;query();});
 byId("sortDesc").addEventListener("change",e=>{state.desc=e.target.checked;query();});
 byId("prevPage").addEventListener("click",()=>{state.page=Math.max(1,state.page-1);query();});
 byId("nextPage").addEventListener("click",()=>{state.page=Math.min(state.result?.pages||1,state.page+1);query();});
 byId("addColumn").addEventListener("change",e=>{const v=Number(e.target.value);if(e.target.value!==""&&!state.visible.includes(v)&&state.visible.length<16)state.visible.push(v);e.target.value="";renderChips();query();});
 byId("visibleColumns").addEventListener("click",e=>{const x=e.target.closest("[data-col]");if(x&&state.visible.length>1){state.visible=state.visible.filter(k=>k!==Number(x.dataset.col));renderChips();query();}});
 byId("dictSearch").addEventListener("input",renderDictionary);
 byId("exportPage").addEventListener("click",exportPage);
 worker();
}
function switchView(view){
 state.active=view;byId("pageName").textContent=({overview:"数据总览",records:"数据检索",dictionary:"字段字典",quality:"质量核验"})[view]||view;
 document.querySelectorAll(".vault-nav").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 document.querySelectorAll(".vault-pane").forEach(p=>p.classList.toggle("active",p.dataset.pane===view));
}
function load(file){
 if(!/\.csv$/i.test(file.name)){fail("请选择 CSV 格式文件。");return;}
 if(file.size>900*1024*1024){fail("目前单次本地加载建议不超过900MB。");return;}
 worker();state.loading=true;state.ready=false;state.columns=[];state.filters=[];state.result=null;
 byId("datasetContent").hidden=true;byId("uploader").hidden=false;
 byId("loadStatus").classList.remove("has-error");
 byId("loadStatus").textContent="正在本机解析 "+file.name+"，数据不会上传…";
 byId("progressWrap").hidden=false;byId("progressBar").style.width="0%";
 state.worker.postMessage({type:"load",file});
}
function message(e){
 const m=e.data;if(m.type==="progress"){const percentage=Math.min(99,Math.round(m.loaded/m.size*100));byId("progressBar").style.width=percentage+"%";byId("loadStatus").textContent="本机解析中 "+percentage+"% · 已处理约 "+number(m.rows)+" 行";return;}
 if(m.type==="error"){fail(m.message);return;}
 if(m.type==="loaded"){
  state.ready=true;state.loading=false;state.columns=m.columns;state.rowCount=m.rows;state.missing=m.missing;state.badRows=m.badRows;state.bytes=m.bytes;
  state.visible=[...new Set([0,1,2,3,4,Math.max(0,m.width-3),Math.max(0,m.width-2),m.width-1])].slice(0,10);
  state.chart=state.columns.find(c=>c.kind==="category"&&c.unique>1)?.index ?? 0;
  byId("progressBar").style.width="100%";byId("loadStatus").textContent="解析完成 · 数据仅保留在此浏览器内存";
  byId("datasetContent").hidden=false;byId("uploader").hidden=true;byId("clearData").disabled=false;
  byId("rowCount").textContent=number(m.rows);byId("colCount").textContent=number(m.width);
  byId("missingCount").textContent=number(m.missing);byId("missingRate").textContent=pct(m.missing,m.rows*m.width)+" 空缺";
  initControls();renderDictionary();renderQuality();renderNotes();query();return;
 }
 if(m.type==="result"&&m.id===state.requestId){
  state.result=m;byId("matchedCount").textContent=number(m.total);renderTable();renderChart();return;
 }
}
function selectOptions(includeBlank){
 return (includeBlank?'<option value="">选择字段</option>':"")+state.columns.map(c=>'<option value="'+c.index+'">'+escapeHtml(c.name)+'</option>').join("");
}
function initControls(){
 byId("chartField").innerHTML=selectOptions();byId("chartField").value=String(state.chart);
 byId("addColumn").innerHTML='<option value="">+ 添加字段</option>'+selectOptions();
 byId("sortField").innerHTML='<option value="-1">原始顺序</option>'+selectOptions();
 renderChips();renderFilters();
}
function renderChips(){
 byId("visibleColumns").innerHTML=state.visible.map(k=>'<button data-col="'+k+'" title="移除此显示字段">'+escapeHtml(state.columns[k]?.name||"")+' ×</button>').join("");
}
function renderFilters(){
 byId("filterRows").innerHTML=state.filters.map((f,i)=>'<div class="vault-filter"><select data-filter-col="'+i+'" class="vault-select">'+state.columns.map(c=>'<option value="'+c.index+'"'+(c.index===f.c?' selected':'')+'>'+escapeHtml(c.name)+'</option>').join("")+'</select>'+
 '<select data-filter-op="'+i+'" class="vault-select">'+[['eq','等于'],['ne','不等于'],['contains','包含'],['gt','大于'],['gte','大于等于'],['lt','小于'],['lte','小于等于'],['missing','缺失'],['present','非缺失']].map(([op,label])=>'<option value="'+op+'"'+(op===f.op?' selected':'')+'>'+label+'</option>').join("")+'</select>'+
 '<input data-filter-val="'+i+'" class="vault-input" type="text" value="'+escapeHtml(f.v||"")+'" placeholder="请输入筛选值"><button class="vault-outline" data-remove="'+i+'" title="删除条件">×</button></div>').join("")||'<p class="vault-muted">尚未设置筛选条件。默认显示全部数据。</p>';
}
function readFilters(){
 state.filters=state.filters.map((f,i)=>({c:Number(document.querySelector('[data-filter-col="'+i+'"]').value),
 op:document.querySelector('[data-filter-op="'+i+'"]').value,
 v:document.querySelector('[data-filter-val="'+i+'"]').value}));
}
function query(){
 if(!state.ready)return;state.requestId++;
 state.worker.postMessage({type:"query",id:state.requestId,filters:state.filters,page:state.page,pageSize:state.pageSize,
  visible:state.visible,chart:state.chart,order:state.sort,desc:state.desc});
}
function renderTable(){
 const r=state.result;if(!r)return;state.page=Math.min(state.page,r.pages);
 byId("resultHead").innerHTML='<tr><th>行号</th>'+state.visible.map(k=>'<th>'+escapeHtml(state.columns[k].name)+'</th>').join("")+'</tr>';
 byId("resultBody").innerHTML=r.rows.map(row=>'<tr><td class="vault-rowid">'+number(row.row)+'</td>'+row.values.map(v=>'<td title="'+escapeHtml(v===null?'':v)+'">'+(v===null?'<em class="vault-na">缺失</em>':escapeHtml(v))+'</td>').join("")+'</tr>').join("")||'<tr><td colspan="'+(state.visible.length+1)+'" class="vault-muted">无匹配记录。请调整筛选条件。</td></tr>';
 byId("pageLabel").textContent=number(r.total)+" 条匹配 · 第 "+r.page+" / "+r.pages+" 页";
 byId("prevPage").disabled=r.page<=1;byId("nextPage").disabled=r.page>=r.pages;
}
function renderChart(){
 const out=byId("chart"),info=byId("chartSummary");const data=state.result?.chart;
 if(!data){out.textContent="请选择字段。";return;}
 const name=state.columns[state.chart]?.name||"";
 if(data.type==="numeric"&&data.n){
  info.textContent="数值型 · 有效 "+number(data.n)+" · 平均 "+data.mean.toLocaleString('zh-CN',{maximumFractionDigits:3})+" · 最小 "+data.min.toPrecision(4)+" · 最大 "+data.max.toPrecision(4);
 }else info.textContent="频数统计 · 按当前筛选后 "+number(state.result.total)+" 条记录计算";
 const items=data.items||[];
 if(!items.length){out.textContent="没有可展示的数据";return;}
 const max=Math.max(...items.map(x=>x.value),1);
 out.innerHTML='<div class="vault-plot">'+items.map(item=>'<div class="vault-bar"><span title="'+escapeHtml(item.label)+'">'+escapeHtml(item.label)+'</span><div class="vault-bar-track"><div style="width:'+Math.max(0.35,item.value/max*100).toFixed(2)+'%"></div></div><strong>'+number(item.value)+'</strong></div>').join("")+'</div>'+
 (data.other?'<p class="vault-muted">其余类别累计 '+number(data.other)+' 条。</p>':"");
}
function renderDictionary(){
 const q=(byId("dictSearch")?.value||"").trim().toLowerCase();const filtered=state.columns.filter(c=>!q||c.name.toLowerCase().includes(q));
 byId("dictBody").innerHTML=filtered.map(c=>'<tr><td>'+number(c.index+1)+'</td><td>'+escapeHtml(c.name)+'</td><td>'+(c.kind==="number"?"数值":"分类文本")+'</td><td>'+number(c.missing)+'</td><td>'+pct(c.missing,state.rowCount)+'</td></tr>').join("");
}
function renderQuality(){
 const invalid=state.columns.reduce((n,c)=>n+c.invalid,0),numeric=state.columns.filter(c=>c.kind==="number").length;
 const rows=[["原始 CSV 字段数",number(state.columns.length),"字段名自动识别"],
 ["原始 CSV 行数",number(state.rowCount),"跳过标题行"],
 ["长度不一致的记录",number(state.badRows),state.badRows?"建议检查":"结构检查通过"],
 ["缺失单元格",number(state.missing),"包括空值、NA及其他常见缺失标记"],
 ["数值列中的非数值",number(invalid),invalid?"以缺失记录，未自动修正":"数值解析通过"],
 ["识别出的数值字段",number(numeric),"基于文件前1100行的自动推断，可与实际字典核对"],
 ["分类字段",number(state.columns.length-numeric),"自动压缩并保留原始分类标签"]];
 byId("qualityNotes").innerHTML=rows.map(([a,b,c])=>'<div class="vault-note"><strong>'+escapeHtml(a)+'</strong><b>'+escapeHtml(b)+'</b><small>'+escapeHtml(c)+'</small></div>').join("");
}
function renderNotes(){
 byId("overviewNotes").innerHTML='<div class="vault-note"><strong>原始文件大小</strong><b>'+(state.bytes/1048576).toFixed(1)+' MiB</b><small>本地文件，不发送到服务器</small></div>'+
 '<div class="vault-note"><strong>处理模式</strong><b>Web Worker</b><small>列式编码、分页渲染</small></div>'+
 '<div class="vault-note"><strong>记录保存方式</strong><b>仅内存</b><small>网页关闭后自动释放，未写入浏览器数据库</small></div>';
}
function exportPage(){
 const r=state.result;if(!r||!r.rows.length)return;
 const quote=v=>'"'+String(v===null?"":v).replace(/"/g,'""')+'"';
 const lines=[["行号",...state.visible.map(k=>state.columns[k].name)].map(quote).join(",")];
 for(const row of r.rows)lines.push([row.row,...row.values].map(quote).join(","));
 const blob=new Blob(["\uFEFF",lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="local_query_page_"+r.page+".csv";document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
}
makeLayout();
})();