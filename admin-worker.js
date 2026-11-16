export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname!=="/"&&url.pathname!=="/index.html") return new Response("Not Found",{status:404});
  return env.ASSETS.fetch(new Request(new URL("/index.html",request.url),request));
 }
};
