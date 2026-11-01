/* Local Vault outbound network allow-list.
 * Only the existing login/TOTP workflow and synthetic-demo RPCs may make network requests.
 * Authorized administrators may upload CSV chunks only to the protected import_batch RPC.
 */
(function(){
"use strict";
const original=window.fetch.bind(window);
const base=String(window.TJ_CV_COHORT_CONFIG?.url||"");
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base))throw Error("Invalid authentication service configuration");
const allowed=[
 /^\/auth\/v1\/token$/,
 /^\/auth\/v1\/user$/,
 /^\/auth\/v1\/factors$/,
 /^\/auth\/v1\/factors\/[^/]+\/(?:challenge|verify)$/,
 /^\/auth\/v1\/logout$/,
 /^\/rest\/v1\/rpc\/secure_my_membership$/,
 /^\/rest\/v1\/rpc\/secure_has_verified_mfa$/,
 /^\/rest\/v1\/rpc\/clinical_preview_(?:summary|search|distribution)$/,
 /^\/rest\/v1\/rpc\/tj_cv_cohort_status$/,
 /^\/rest\/v1\/rpc\/tj_cv_(?:import_progress|import_begin|import_batch|import_finish|fields|admin_set_visible_v2|search|distribution)$/
];
Object.defineProperty(window,"fetch",{configurable:false,writable:false,value:function(input,options){
 const address=typeof input==="string"?input:input instanceof URL?input.toString():input?.url||"";
 const url=new URL(address,location.href);
 const method=String(options?.method||input?.method||"GET").toUpperCase();
 if(url.origin!==base||!allowed.some(re=>re.test(url.pathname))||!["GET","POST"].includes(method)){
  return Promise.reject(new Error("此本地数据页面禁止非身份认证的网络请求"));
 }
 return original(input,options);
}});
try{window.XMLHttpRequest=function(){throw Error("本地患者数据页面禁止 XMLHttpRequest");};}catch(e){}
try{window.WebSocket=function(){throw Error("本地患者数据页面禁止 WebSocket");};}catch(e){}
try{window.EventSource=function(){throw Error("本地患者数据页面禁止 EventSource");};}catch(e){}
})();
