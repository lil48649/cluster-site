/* 天津心血管疾病+队列 — SYNTHETIC DATA ONLY.
 * Reads exclusively 3 server-side, allowlisted, read-only RPCs.
 * No raw CSV download, arbitrary SQL, or direct table access.
 */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const number=v=>Number(v??0).toLocaleString("zh-CN");
const fnum=v=>(v===null||v===undefined)?"—":Number(v).toLocaleString("zh-CN",{maximumFractionDigits:1});
const state={page:1,size:20,filters:{p_sex:null,p_cohort:null,p_age_min:null,p_age_max:null},chart:"cohort",active:"overview",summary:null,search:null,requestId:0,chartId:0};
const displayBool=v=>v===true?"是":"否";
const sexName=x=>x==="Male"?"男性":x==="Female"?"女性":"全部";
const cohortName=x=>x||"全部组别";
const schema=[["id","记录编号"],["sex","性别"],["age","年龄"],["cohort","测试分组"],["hypertension","模拟高血压"],["diabetes","模拟糖尿病"],["outcome","模拟结局"],["bmi","模拟 BMI"]];
function renderShell(){
 const app=$("app");app.className="app vault-shell";
 app.innerHTML=
 '<aside class="vault-sidebar"><div class="vault-brand"><div class="vault-logo">♥</div><div><strong>天津心血管疾病+队列</strong><small>CARDIOVASCULAR COHORT</small></div></div>'+
 '<div class="vault-navtitle">项目管理</div>'+
 '<button type="button" class="vault-nav active" data-view="overview">▦　队列概览</button>'+
 '<button type="button" class="vault-nav" data-view="records">☷　队列数据检索</button>'+
 '<div class="vault-bottom"><span class="vault-dot"></span> Supabase · MFA · 只读查询</div></aside>'+
 '<div class="vault-right"><header class="vault-top"><div><small>天津心血管疾病+队列 / 科研数据库</small><strong id="pageTitle">队列概览</strong></div><div class="vault-actions">'+
 '<span class="vault-shield"><span class="vault-dot"></span> 已通过双因素认证</span></div></header>'+
 '<main class="vault-main"><section class="vault-hero"><div><div class="vault-eyebrow">TIANJIN CARDIOVASCULAR COHORT</div><h1>天津心血管疾病+队列</h1>'+
 '<p>心血管队列研究 · 安全检索 · 多设备协作 · 双因素认证</p></div><div class="vault-hero-chip">SYNTHETIC DATA · TEST ONLY</div></section>'+
 '<div class="clinical-caution"><strong>当前为虚构数据测试环境：</strong>全部记录由程序生成，不包含患者数据；正式数据库尚未导入。网页没有整库下载入口，单次查询最多返回50行。</div>'+
 '<div id="dataError" class="clinical-error" hidden></div>'+
 '<div id="loading" class="clinical-loading">正在验证授权并读取测试数据库…</div>'+
 '<section id="workspace" hidden>'+
 '<section class="vault-stats">'+
   '<div class="vault-stat"><small>测试数据库总行数</small><strong id="statTotal">—</strong><span>程序生成的虚构记录</span></div>'+
   '<div class="vault-stat"><small>模拟男性记录</small><strong id="statMale">—</strong><span>仅供界面联调</span></div>'+
   '<div class="vault-stat"><small>模拟女性记录</small><strong id="statFemale">—</strong><span>仅供界面联调</span></div>'+
   '<div class="vault-stat"><small>当前匹配结果</small><strong id="statMatched">—</strong><span>后端筛选 · 单页限额</span></div>'+
 '</section>'+
 '<section class="vault-pane active" data-pane="overview">'+
   '<div class="vault-block"><div class="vault-block-head"><div><h2>模拟变量分布</h2><p>图表直接由数据库端聚合生成，不将整个数据表传输到浏览器</p></div>'+
   '<select id="chartDim" class="vault-select"><option value="cohort">研究分组</option><option value="sex">性别</option><option value="age_group">年龄段</option>'+
   '<option value="hypertension">模拟高血压</option><option value="diabetes">模拟糖尿病</option><option value="outcome">模拟结局</option></select></div>'+
   '<div id="chartStatus" class="clinical-muted">查询统计中…</div><div id="bars" class="vault-plot"></div></div>'+
   '<div class="vault-block"><div class="vault-block-head"><div><h2>测试数据库概览</h2><p>以下结果全部来自虚构记录，仅用于验证界面与权限</p></div></div>'+
   '<div id="moreStats" class="vault-notes"></div></div>'+
 '</section>'+
 '<section class="vault-pane" data-pane="records">'+
   '<div class="vault-block"><div class="vault-block-head"><div><h2>多条件筛选</h2><p>由服务器执行筛选、计数和分页；客户端不会一次读取全部记录</p></div></div>'+
   '<form id="searchForm" class="clinical-filters">'+
     '<label>性别<select id="filterSex" class="vault-select"><option value="">全部性别</option><option value="Male">男性</option><option value="Female">女性</option></select></label>'+
     '<label>分组<select id="filterCohort" class="vault-select"><option value="">全部组别</option><option>Group A</option><option>Group B</option><option>Group C</option></select></label>'+
     '<label>最小年龄<input id="ageMin" type="number" class="vault-input" min="0" max="120" placeholder="不限"></label>'+
     '<label>最大年龄<input id="ageMax" type="number" class="vault-input" min="0" max="120" placeholder="不限"></label>'+
     '<button type="submit" class="vault-primary">执行检索</button><button type="button" class="vault-outline" id="resetFilters">清空</button>'+
   '</form></div>'+
   '<div class="vault-block"><div class="vault-block-head"><div><h2>查询记录</h2><p>普通用户仅能分页浏览，无 CSV / Excel 下载入口</p></div>'+
    '<label>每页 <select id="pageSize" class="vault-select"><option value="10">10</option><option value="20" selected>20</option><option value="50">50</option></select> 条</label></div>'+
    '<div class="vault-table-scroll"><table class="vault-table"><thead><tr id="tableHead"></tr></thead><tbody id="tableBody"></tbody></table></div>'+
    '<div class="vault-pagination"><span id="pageInfo">—</span><div><button class="vault-outline" id="prevPage" type="button">上一页</button>'+
    '<button class="vault-outline" id="nextPage" type="button">下一页</button></div></div></div>'+
 '</section>'+
 '</section><footer class="vault-footer">天津心血管疾病+队列 · 数据管理平台 · 演示环境</footer></main></div>';
 const out=$("logoutBtn");if(out){out.hidden=false;out.className="vault-outline";app.querySelector(".vault-actions").appendChild(out);}
 app.querySelectorAll(".vault-nav").forEach(el=>el.addEventListener("click",()=>navigate(el.dataset.view)));
 $("searchForm").addEventListener("submit",e=>{e.preventDefault();applyFilters();});
 $("resetFilters").addEventListener("click",()=>{["filterSex","filterCohort","ageMin","ageMax"].forEach(id=>$(id).value="");applyFilters();});
 $("chartDim").addEventListener("change",e=>{state.chart=e.target.value;chartQuery();});
 $("pageSize").addEventListener("change",e=>{state.size=Number(e.target.value);state.page=1;recordQuery();});
 $("prevPage").addEventListener("click",()=>{state.page=Math.max(1,state.page-1);recordQuery();});
 $("nextPage").addEventListener("click",()=>{if(state.search&&state.page*state.size<state.search.total){state.page++;recordQuery();}});
}
function navigate(page){
 state.active=page;
 const labels={overview:"队列概览",records:"队列数据检索"};
 $("pageTitle").textContent=labels[page];
 document.querySelectorAll(".vault-nav").forEach(x=>x.classList.toggle("active",x.dataset.view===page));
 document.querySelectorAll(".vault-pane").forEach(x=>x.classList.toggle("active",x.dataset.pane===page));
}
function errorMessage(e){
 const text=String(e?.message||e||"");
 return text.length>180?text.slice(0,180):text;
}
function showError(message){$("dataError").textContent=message;$("dataError").hidden=false;}
async function rpc(name,args){if(typeof window.CLINICAL_PREVIEW_RPC!=="function")throw Error("安全查询组件尚未就绪");return window.CLINICAL_PREVIEW_RPC(name,args);}
async function start(){
 renderShell();
 try{
 const realStatus=await rpc("tj_cv_cohort_status");
 if(!realStatus||realStatus.dataset!=="tj_cv_cohort")throw Error("无法核对正式队列数据库状态");
 if(realStatus.loaded){
   $("loading").hidden=true;
   $("workspace").hidden=true;
   const notice=document.querySelector(".clinical-caution");
   if(notice)notice.textContent="正式队列数据库已导入 "+number(realStatus.rows)+" 条记录，字段元数据 "+number(realStatus.field_metadata_count)+" 项。为保护真实临床数据，个体记录查询在字段权限、审计和安全测试完成前暂不开放。";
   return;
 }
 const summary=await rpc("clinical_preview_summary");
 if(!summary||summary.synthetic!==true)throw Error("服务器未返回合成数据标识，已停止展示");
 state.summary=summary;
 $("loading").hidden=true;$("workspace").hidden=false;
 $("statTotal").textContent=number(summary.total);
 $("statMale").textContent=number(summary.male);
 $("statFemale").textContent=number(summary.female);
 $("moreStats").innerHTML=[
 ["模拟高血压",number(summary.hypertension),"虚构结果"],
 ["模拟糖尿病",number(summary.diabetes),"虚构结果"],
 ["模拟结局",number(summary.outcome),"虚构结果"],
 ["平均年龄",fnum(summary.mean_age),"虚构样本"],
 ["平均 BMI",fnum(summary.mean_bmi),"虚构样本"],
 ["API模式","按需查询","没有整库下载"]].map(x=>'<div class="vault-note"><strong>'+esc(x[0])+'</strong><b>'+esc(x[1])+'</b><small>'+esc(x[2])+'</small></div>').join("");
 await Promise.all([recordQuery(),chartQuery()]);
 }catch(e){$("loading").hidden=true;showError("测试数据库读取失败："+errorMessage(e));}
}
function selectedFilters(){
 return {p_page:state.page,p_page_size:state.size,p_sex:state.filters.p_sex,p_cohort:state.filters.p_cohort,
 p_age_min:state.filters.p_age_min,p_age_max:state.filters.p_age_max};
}
function applyFilters(){
 const min=$("ageMin").value,max=$("ageMax").value;
 if((min!==""&&(Number(min)<0||Number(min)>120))||(max!==""&&(Number(max)<0||Number(max)>120))||
    (min!==""&&max!==""&&Number(min)>Number(max))){
  showError("年龄范围无效，请输入0至120之间的正确年龄。");return;
 }
 $("dataError").hidden=true;
 state.filters={p_sex:$("filterSex").value||null,p_cohort:$("filterCohort").value||null,p_age_min:min===""?null:Number(min),p_age_max:max===""?null:Number(max)};
 state.page=1;recordQuery();chartQuery();
}
async function recordQuery(){
 const id=++state.requestId;
 $("tableBody").innerHTML='<tr><td colspan="8" class="clinical-muted">服务器检索中…</td></tr>';
 try{
  const result=await rpc("clinical_preview_search",selectedFilters());
  if(id!==state.requestId)return;
  if(!result||result.synthetic!==true)throw Error("非测试数据响应被拒绝显示");
  state.search=result;state.page=result.page;
  $("statMatched").textContent=number(result.total);
  $("tableHead").innerHTML=schema.map(x=>'<th>'+esc(x[1])+'</th>').join("");
  $("tableBody").innerHTML=result.rows.length?result.rows.map(row=>'<tr>'+
    '<td class="vault-rowid">'+number(row.id)+'</td><td>'+esc(sexName(row.sex))+'</td>'+
    '<td>'+number(row.age)+'</td><td>'+esc(row.cohort)+'</td>'+
    '<td>'+displayBool(row.hypertension)+'</td><td>'+displayBool(row.diabetes)+'</td>'+
    '<td>'+displayBool(row.outcome)+'</td><td>'+fnum(row.bmi)+'</td></tr>').join(""):
    '<tr><td colspan="8" class="clinical-muted">没有符合条件的测试记录</td></tr>';
  const pages=Math.max(1,Math.ceil(result.total/result.page_size));
  $("pageInfo").textContent="匹配 "+number(result.total)+" 条 · 第 "+result.page+" / "+pages+" 页 · 单页上限50条";
  $("prevPage").disabled=result.page<=1;$("nextPage").disabled=result.page>=pages;
 }catch(e){if(id===state.requestId){showError("查询失败："+errorMessage(e));$("tableBody").innerHTML="";}}
}
async function chartQuery(){
 const id=++state.chartId;
 $("chartStatus").textContent="正在计算分布…";
 try{
 const r=await rpc("clinical_preview_distribution",{p_dimension:state.chart,p_sex:state.filters.p_sex,p_cohort:state.filters.p_cohort});
 if(id!==state.chartId)return;
 if(!r||r.synthetic!==true)throw Error("统计结果没有合成数据标识");
 const bars=r.bars||[];const max=Math.max(1,...bars.map(x=>x.count));
 $("chartStatus").textContent="共 "+bars.length+" 个分组，服务器端汇总";
 $("bars").innerHTML=bars.map(b=>'<div class="vault-bar"><span>'+esc(b.label)+'</span><div class="vault-bar-track"><div style="width:'+(100*b.count/max).toFixed(2)+'%"></div></div><strong>'+number(b.count)+'</strong></div>').join("")||'<div class="clinical-muted">没有可用数据</div>';
 }catch(e){if(id===state.chartId){$("chartStatus").textContent="图表读取失败："+errorMessage(e);$("bars").innerHTML="";}}
}
start();
})();