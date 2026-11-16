import { storageProvider, getAsset, deleteAsset } from "../storage.js";

const JSON_HEADERS = { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
function authorized(request,env){
  const expected=env.APP_TEST_KEY||"", supplied=request.headers.get("x-app-access-key")||"";
  if(!expected||supplied.length!==expected.length)return false;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^supplied.charCodeAt(i);
  return diff===0;
}
function objectId(id){
  const match=String(id||"").match(/^([0-9a-f-]{36})(?:--([A-Za-z0-9._~!$&'()*+,;=:@%+-]{0,480}))?$/i);
  if(!match)return null;
  if(match[2]){try{const decoded=decodeURIComponent(match[2]);if(/[\/\\\u0000-\u001f\u007f]/.test(decoded))return null;}catch{return null;}}
  return String(id);
}
export async function onRequestGet({request,env,params}){
  if(!authorized(request,env))return json({error:"未授权。"},401);
  if(!storageProvider(env))return json({error:"云端素材库未连接。"},503);
  const id=objectId(params.assetId);if(!id)return json({error:"素材编号无效。"},400);
  try{
    const response=await getAsset(env,id);
    if(!response)return json({error:"找不到这份素材。"},404);
    return response;
  }catch(error){console.error("Cloud download failed",error);return json({error:"读取云端素材失败。"},500);}
}
export async function onRequestDelete({request,env,params}){
  if(!authorized(request,env))return json({error:"未授权。"},401);
  if(!storageProvider(env))return json({error:"云端素材库未连接。"},503);
  const id=objectId(params.assetId);if(!id)return json({error:"素材编号无效。"},400);
  try{await deleteAsset(env,id);return json({ok:true});}
  catch(error){console.error("Cloud delete failed",error);return json({error:"删除云端素材失败。"},500);}
}
