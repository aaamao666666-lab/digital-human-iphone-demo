/* Cloudflare production deployment trigger: sync latest merged frontend assets. */
import { onRequestGet as healthGet } from "./functions/api/health.js";
import { onRequestGet as assetsListGet, onRequestPost as assetsUploadPost } from "./functions/api/assets.js";
import { onRequestPost as chatPost } from "./functions/api/chat.js";
import { publicList, publicGet, publishPost } from "./functions/api/public-assets.js";
import { onRequestGet as assetGet, onRequestDelete as assetDelete } from "./functions/api/assets/[assetId].js";
import { onRequestPost as avatarCreatePost, onRequestGet as avatarStatusGet, onRequestGetModel as avatarModelGet, onRequestRigPost, onRequestRigGet, onRequestRigModelGet, onRequestRigWalkModelGet } from "./functions/api/avatar.js";

const JSON_HEADERS={ "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };
const ALLOWED_ORIGINS=new Set([
 "https://aaamao666666-lab.github.io",
 "https://digital-human-iphone-demo.aaamao666666.workers.dev",
 "https://xinling-admin.aaamao666666.workers.dev"
]);
function json(payload,status=404,extraHeaders={}) {
 return new Response(JSON.stringify(payload),{status,headers:{...JSON_HEADERS,...extraHeaders}});
}
function methodNotAllowed(allowed){return json({error:"请求方法不支持。"},405,{allow:allowed.join(", ")});}
function cors(request,response){
 const origin=request.headers.get("Origin")||"";
 const headers=new Headers(response.headers);
 if(ALLOWED_ORIGINS.has(origin)){
  headers.set("Access-Control-Allow-Origin",origin);
  headers.set("Access-Control-Allow-Methods","GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers","Content-Type, Authorization, X-Admin-Key, X-App-Key, X-App-Access-Key, X-File-Name");
  headers.set("Access-Control-Max-Age","86400");
  headers.append("Vary","Origin");
 }
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  const path=url.pathname.replace(/\/+$/,"")||"/";
  if((path==="/api"||path.startsWith("/api/"))&&request.method==="OPTIONS"){
   return cors(request,new Response(null,{status:204}));
  }
  if(path==="/admin"||path==="/admin/"||path==="/admin.html"){
   return json({error:"管理后台已迁移至独立入口。"},404);
  }
  let response;
  if(path==="/api/health"){
   response=request.method==="GET"?await healthGet({request,env,params:{},waitUntil:p=>ctx.waitUntil(p)}):methodNotAllowed(["GET"]);
   return cors(request,response);
  }
  const avatarMatch=path.match(/^\/api\/avatar\/(generate|model|rig|rig-model|rig-walk)(?:\/([^/]+))?$/);
  if(avatarMatch){
   const action=avatarMatch[1],taskId=avatarMatch[2]||"";
   if(action==="generate"&&!taskId){
    response=request.method==="POST"?await avatarCreatePost({request,env}):methodNotAllowed(["POST"]);
    return cors(request,response);
   }
   if(action==="generate"&&taskId){
    response=request.method==="GET"?await avatarStatusGet({request,env,params:{taskId}}):methodNotAllowed(["GET"]);
    return cors(request,response);
   }
   if(action==="model"&&taskId){
    response=request.method==="GET"?await avatarModelGet({request,env,params:{taskId}}):methodNotAllowed(["GET"]);
    return cors(request,response);
   }
   if(action==="rig"&&!taskId){
    response=request.method==="POST"?await onRequestRigPost({request,env,params:{}}):methodNotAllowed(["POST"]);
    return cors(request,response);
   }
   if(action==="rig"&&taskId){
    response=request.method==="GET"?await onRequestRigGet({request,env,params:{taskId}}):methodNotAllowed(["GET"]);
    return cors(request,response);
   }
   if(action==="rig-walk"&&taskId){
    response=request.method==="GET"?await onRequestRigWalkModelGet({request,env,params:{taskId}}):methodNotAllowed(["GET"]);
    return cors(request,response);
   }
   if(action==="rig-model"&&taskId){
    response=request.method==="GET"?await onRequestRigModelGet({request,env,params:{taskId}}):methodNotAllowed(["GET"]);
    return cors(request,response);
   }
  }
  if(path==="/api/chat"){
   response=request.method==="POST"?await chatPost({request,env,params:{},waitUntil:p=>ctx.waitUntil(p)}):methodNotAllowed(["POST"]);
   return cors(request,response);
  }
  if(path==="/api/public/assets"){
   response=request.method==="GET"?await publicList({request,env}):methodNotAllowed(["GET"]);
   return cors(request,response);
  }
  if(path==="/api/assets/publish"){
   response=request.method==="POST"?await publishPost({request,env}):methodNotAllowed(["POST"]);
   return cors(request,response);
  }
  const publicMatch=path.match(/^\\/api\\/public\\/assets\\/([^/]+)$/);
  if(publicMatch){
   let assetId;try{assetId=decodeURIComponent(publicMatch[1]);}catch{return cors(request,json({error:"素材编号无效。"},400));}
   response=request.method==="GET"?await publicGet({request,env,params:{assetId}}):methodNotAllowed(["GET"]);
   return cors(request,response);
  }
  if(path==="/api/assets"){
   if(request.method==="GET")response=await assetsListGet({request,env,params:{},waitUntil:p=>ctx.waitUntil(p)});
   else if(request.method==="POST")response=await assetsUploadPost({request,env,params:{},waitUntil:p=>ctx.waitUntil(p)});
   else response=methodNotAllowed(["GET","POST"]);
   return cors(request,response);
  }
  const match=path.match(/^\/api\/assets\/([^/]+)$/);
  if(match){
   let assetId;try{assetId=decodeURIComponent(match[1]);}catch{return cors(request,json({error:"素材编号无效。"},400));}
   const params={assetId};
   if(request.method==="GET")response=await assetGet({request,env,params,waitUntil:p=>ctx.waitUntil(p)});
   else if(request.method==="DELETE")response=await assetDelete({request,env,params,waitUntil:p=>ctx.waitUntil(p)});
   else response=methodNotAllowed(["GET","DELETE"]);
   return cors(request,response);
  }
  if(path.startsWith("/api/"))return cors(request,json({error:"接口不存在。"},404));
  return env.ASSETS.fetch(request);
 }
};
