const HEADERS={ "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };
const MAX_IMAGE_DATA=7*1024*1024;
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:HEADERS});}
function authorized(request,env){
 const expected=env.APP_TEST_KEY||"",supplied=request.headers.get("x-app-access-key")||"";
 if(!expected||supplied.length!==expected.length)return false;
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^supplied.charCodeAt(i);
 return diff===0;
}
function validTaskId(value){return /^[0-9a-f-]{20,64}$/i.test(value||"");}
function safeTask(task){
 return {taskId:task.id,status:task.status,progress:Number(task.progress||0),taskError:task.task_error?.message||null};
}
async function meshyRequest(env,path,init={}){
 if(!env.MESHY_API_KEY)throw new Error("后台尚未配置 MESHY_API_KEY。请管理员先配置服务端 Secret；不会向客户索取 GLB 文件。");
 return fetch("https://api.meshy.ai/openapi/v1"+path,{...init,headers:{authorization:"Bearer "+env.MESHY_API_KEY,"content-type":"application/json",...(init.headers||{})}});
}
export async function onRequestPost({request,env}){
 if(!authorized(request,env))return json({error:"未授权。请先填写内部测试口令。"},401);
 if(!env.MESHY_API_KEY)return json({error:"3D 生成服务尚未配置。需要管理员在 Cloudflare Worker Secrets 添加 MESHY_API_KEY；目前不会扣费，也不会假装生成成功。"},503);
 let body;try{body=await request.json();}catch{return json({error:"请求格式不正确。"},400);}
 const images=body?.imageUrls;
 if(!Array.isArray(images)||images.length<1||images.length>4)return json({error:"请提供 1 至 4 张照片或视频关键帧。"},400);
 for(const image of images){
  if(typeof image!=="string"||image.length>MAX_IMAGE_DATA||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))return json({error:"图片格式无效或过大。请使用 JPG、PNG、WEBP，每张压缩后不超过约 5 MB。"},400);
 }
 let upstream;
 try{
  upstream=await meshyRequest(env,"/multi-image-to-3d",{method:"POST",body:JSON.stringify({
   image_urls:images,ai_model:"meshy-7.1",should_texture:true,enable_pbr:true,target_formats:["glb"],pose_mode:"a-pose",image_enhancement:false,moderation:true
  })});
 }catch(error){console.error("Meshy create request failed",error);return json({error:"无法连接 3D 生成服务。"},502);}
 if(!upstream.ok){
  const detail=await upstream.text();console.error("Meshy create error",upstream.status,detail.slice(0,800));
  if(upstream.status===402)return json({error:"3D 服务账户没有可用额度，或当前套餐不支持 API。尚未创建任务；请先确认费用与套餐。"},402);
  if(upstream.status===401)return json({error:"3D 服务密钥无效，请管理员检查 MESHY_API_KEY。"},503);
  return json({error:"3D 服务暂时拒绝了请求（"+upstream.status+"）。请检查照片格式或服务商账户。"},502);
 }
 let data;try{data=await upstream.json();}catch{return json({error:"3D 服务返回格式异常。"},502);}
 if(!data?.result)return json({error:"3D 服务没有返回任务编号。"},502);
 return json({ok:true,taskId:data.result,status:"PENDING",provider:"meshy"});
}
export async function onRequestGet({request,env,params}){
 if(!authorized(request,env))return json({error:"未授权。"},401);
 const taskId=String(params?.taskId||"");
 if(!validTaskId(taskId))return json({error:"任务编号无效。"},400);
 try{
  const upstream=await meshyRequest(env,"/multi-image-to-3d/"+encodeURIComponent(taskId),{method:"GET",headers:{}});
  if(!upstream.ok)return json({error:"读取生成进度失败（"+upstream.status+"）。"},502);
  const task=await upstream.json();return json(safeTask(task));
 }catch(error){console.error("Meshy status error",error);return json({error:"暂时无法读取生成进度。"},502);}
}
export async function onRequestGetModel({request,env,params}){
 if(!authorized(request,env))return json({error:"未授权。"},401);
 const taskId=String(params?.taskId||"");
 if(!validTaskId(taskId))return json({error:"任务编号无效。"},400);
 try{
  const taskResponse=await meshyRequest(env,"/multi-image-to-3d/"+encodeURIComponent(taskId),{method:"GET",headers:{}});
  if(!taskResponse.ok)return json({error:"读取模型任务失败。"},502);
  const task=await taskResponse.json();
  if(task.status!=="SUCCEEDED"||!task.model_urls?.glb)return json({error:"模型尚未生成完成。"},409);
  const modelResponse=await fetch(task.model_urls.glb,{headers:{accept:"model/gltf-binary"}});
  if(!modelResponse.ok)return json({error:"下载生成模型失败。"},502);
  const bytes=await modelResponse.arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>50*1024*1024)return json({error:"生成的模型超过 50 MB 或文件为空。"},413);
  return new Response(bytes,{status:200,headers:{"content-type":"model/gltf-binary","content-disposition":"attachment; filename=xinling-generated-avatar.glb","cache-control":"private, no-store","x-content-type-options":"nosniff"}});
 }catch(error){console.error("Meshy model download error",error);return json({error:"暂时无法下载生成模型。"},502);}
}

export async function onRequestRigPost({request,env}){
 if(!authorized(request,env))return json({error:"未授权。"},401);
 let body;try{body=await request.json();}catch{return json({error:"请求格式不正确。"},400);}
 const sourceTaskId=String(body?.taskId||"");
 if(!validTaskId(sourceTaskId))return json({error:"3D 生成任务编号无效。"},400);
 try{
  const source=await meshyRequest(env,"/multi-image-to-3d/"+encodeURIComponent(sourceTaskId),{method:"GET",headers:{}});
  if(!source.ok)return json({error:"读取基础模型任务失败。"},502);
  const sourceTask=await source.json();
  if(sourceTask.status!=="SUCCEEDED")return json({error:"基础 3D 模型尚未生成完成。"},409);
  const upstream=await meshyRequest(env,"/rigging",{method:"POST",body:JSON.stringify({
   input_task_id:sourceTaskId,skeleton_template:"mixamo",include_fingers:false,height_meters:1.65
  })});
  if(!upstream.ok){
   const detail=await upstream.text();console.error("Meshy rig create error",upstream.status,detail.slice(0,800));
   if(upstream.status===402)return json({error:"骨骼绑定额度不足或套餐不支持 API。基础 3D 模型已生成，但尚未绑定骨骼。"},402);
   return json({error:"骨骼绑定服务暂时未能接受任务（"+upstream.status+"）。基础 3D 模型仍可查看。"},502);
  }
  const data=await upstream.json();if(!data?.result)return json({error:"骨骼绑定服务没有返回任务编号。"},502);
  return json({ok:true,taskId:data.result,status:"PENDING"});
 }catch(error){console.error("Meshy rig create failed",error);return json({error:"无法连接骨骼绑定服务。"},502);}
}
export async function onRequestRigGet({request,env,params}){
 if(!authorized(request,env))return json({error:"未授权。"},401);
 const taskId=String(params?.taskId||"");if(!validTaskId(taskId))return json({error:"骨骼任务编号无效。"},400);
 try{
  const upstream=await meshyRequest(env,"/rigging/"+encodeURIComponent(taskId),{method:"GET",headers:{}});
  if(!upstream.ok)return json({error:"读取骨骼绑定进度失败（"+upstream.status+"）。"},502);
  const task=await upstream.json();return json({taskId:task.id,status:task.status,progress:Number(task.progress||0),taskError:task.task_error?.message||null});
 }catch(error){console.error("Meshy rig status error",error);return json({error:"暂时无法读取骨骼绑定进度。"},502);}
}


// Serve Meshy's bundled walking animation through the Worker so the signed provider URL stays private.
export async function onRequestRigWalkModelGet({request,env,params}){
 if(!authorized(request,env))return json({error:"未授权。"},401);
 const taskId=String(params?.taskId||"");if(!validTaskId(taskId))return json({error:"骨骼任务编号无效。"},400);
 try{
  const upstream=await meshyRequest(env,"/rigging/"+encodeURIComponent(taskId),{method:"GET",headers:{}});
  if(!upstream.ok)return json({error:"读取动作模型任务失败。"},502);
  const task=await upstream.json(),url=task.result?.basic_animations?.walking_glb_url;
  if(task.status!=="SUCCEEDED"||!url)return json({error:"服务商未提供行走动画模型。"},404);
  const model=await fetch(url,{headers:{accept:"model/gltf-binary"}});
  if(!model.ok)return json({error:"下载行走动画模型失败。"},502);
  const bytes=await model.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>50*1024*1024)return json({error:"行走动画模型超过 50 MB 或文件为空。"},413);
  return new Response(bytes,{status:200,headers:{"content-type":"model/gltf-binary","content-disposition":"attachment; filename=xinling-walking-avatar.glb","cache-control":"private, no-store","x-content-type-options":"nosniff"}});
 }catch(error){console.error("Meshy walking animation download error",error);return json({error:"暂时无法下载行走动画模型。"},502);}
}
export async function onRequestRigModelGet({request,env,params}){
 if(!authorized(request,env))return json({error:"未授权。"},401);
 const taskId=String(params?.taskId||"");if(!validTaskId(taskId))return json({error:"骨骼任务编号无效。"},400);
 try{
  const upstream=await meshyRequest(env,"/rigging/"+encodeURIComponent(taskId),{method:"GET",headers:{}});
  if(!upstream.ok)return json({error:"读取骨骼模型任务失败。"},502);
  const task=await upstream.json(),url=task.result?.rigged_character_glb_url;
  if(task.status!=="SUCCEEDED"||!url)return json({error:"骨骼模型尚未生成完成。"},409);
  const model=await fetch(url,{headers:{accept:"model/gltf-binary"}});
  if(!model.ok)return json({error:"下载骨骼模型失败。"},502);
  const bytes=await model.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>50*1024*1024)return json({error:"骨骼模型超过 50 MB 或文件为空。"},413);
  return new Response(bytes,{status:200,headers:{"content-type":"model/gltf-binary","content-disposition":"attachment; filename=xinling-rigged-avatar.glb","cache-control":"private, no-store","x-content-type-options":"nosniff"}});
 }catch(error){console.error("Meshy rig model download error",error);return json({error:"暂时无法下载骨骼模型。"},502);}
}
