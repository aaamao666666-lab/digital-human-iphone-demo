const JSON_HEADERS = { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };
const PREFIX = "testing/";
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});}
function authorized(request,env){
  const expected=env.APP_TEST_KEY||"", supplied=request.headers.get("x-app-access-key")||"";
  if(!expected||supplied.length!==expected.length)return false;
  let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^supplied.charCodeAt(i);
  return diff===0;
}
function objectKey(id){return /^[0-9a-f-]{36}$/i.test(id||"") ? PREFIX+id : null;}

export async function onRequestGet({request,env,params}){
  if(!authorized(request,env))return json({error:"未授权。"},401);
  if(!env.XINLING_MEDIA)return json({error:"云端素材库未绑定。"},503);
  const key=objectKey(params.assetId);if(!key)return json({error:"素材编号无效。"},400);
  try{
    const object=await env.XINLING_MEDIA.get(key);
    if(!object)return json({error:"找不到这份素材。"},404);
    const headers=new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control","private, no-store");
    headers.set("X-Content-Type-Options","nosniff");
    headers.set("Content-Disposition","inline");
    headers.set("ETag",object.httpEtag);
    return new Response(object.body,{headers});
  }catch(error){console.error("R2 download failed",error);return json({error:"读取云端素材失败。"},500);}
}
export async function onRequestDelete({request,env,params}){
  if(!authorized(request,env))return json({error:"未授权。"},401);
  if(!env.XINLING_MEDIA)return json({error:"云端素材库未绑定。"},503);
  const key=objectKey(params.assetId);if(!key)return json({error:"素材编号无效。"},400);
  try{await env.XINLING_MEDIA.delete(key);return json({ok:true});}
  catch(error){console.error("R2 delete failed",error);return json({error:"删除云端素材失败。"},500);}
}
