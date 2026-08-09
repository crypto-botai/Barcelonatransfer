const B="https://www.elitebcn.info", UA={"User-Agent":"EliteBCN-deepaudit/1.0"};
const get=async(u,o={})=>{try{return await fetch(u,{headers:UA,...o});}catch(e){return{status:0,err:e.message,headers:new Map(),text:async()=>""};}};

const sm=await (await get(B+"/sitemap.xml")).text();
const urls=[...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
console.log(`crawling ${urls.length} pages…\n`);

const titles=new Map(), descs=new Map(), canon=new Map();
const issues=[]; const imgs=new Set(); const slow=[];

for(const u of urls){
  const t0=Date.now();
  const r=await get(u);
  const ms=Date.now()-t0;
  if(r.status!==200){ issues.push([`HTTP ${r.status}`,u]); continue; }
  const html=await r.text();
  if(ms>3000) slow.push([ms,u]);

  const title=html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim()??"";
  const desc =html.match(/<meta name="description" content="([^"]*)"/)?.[1]?.trim()??"";
  const can  =html.match(/<link rel="canonical" href="([^"]*)"/)?.[1]??"";
  if(title){(titles.get(title)??titles.set(title,[]).get(title)).push(u);}
  if(desc){(descs.get(desc)??descs.set(desc,[]).get(desc)).push(u);}

  // canonical must be self-referential and absolute
  if(!can) issues.push(["no canonical",u]);
  else {
    if(!can.startsWith("https://")) issues.push([`relative canonical (${can})`,u]);
    const cn=can.replace(/\/$/,""), un=u.replace(/\/$/,"");
    if(cn!==un) canon.set(u,can);
  }

  // noindex on a page we submitted to Google
  if(/<meta name="robots"[^>]*noindex/i.test(html)) issues.push(["noindex but IS in sitemap",u]);

  // lang attribute
  if(!/<html[^>]+lang=/i.test(html)) issues.push(["<html> has no lang",u]);

  // mixed content
  for(const m of html.matchAll(/(?:src|href)="(http:\/\/[^"]+)"/g)) issues.push([`insecure http resource: ${m[1].slice(0,60)}`,u]);

  // JSON-LD validity
  for(const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)){
    try{ JSON.parse(m[1]); }catch{ issues.push(["INVALID JSON-LD",u]); }
  }

  // images
  for(const m of html.matchAll(/<img[^>]*>/g)){
    const tag=m[0];
    const src=tag.match(/src="([^"]+)"/)?.[1];
    if(src && !src.startsWith("data:")) imgs.add(src.startsWith("http")?src:B+src);
    if(!/alt="/.test(tag)) issues.push([`img without alt: ${(src??"?").slice(0,50)}`,u]);
  }
}

console.log("=== duplicate <title> across pages ===");
let dup=0;
for(const [t,us] of titles) if(us.length>1){dup++;console.log(`  "${t.slice(0,60)}"\n     ${us.map(x=>x.replace(B,"")).join(", ")}`);}
if(!dup) console.log("  none");

console.log("\n=== duplicate meta descriptions ===");
dup=0;
for(const [d,us] of descs) if(us.length>1){dup++;console.log(`  "${d.slice(0,60)}…"\n     ${us.map(x=>x.replace(B,"")).join(", ")}`);}
if(!dup) console.log("  none");

console.log("\n=== canonical pointing elsewhere ===");
if(!canon.size) console.log("  none");
for(const [u,c] of canon) console.log(`  ${u.replace(B,"")}  ->  ${c}`);

console.log(`\n=== images referenced: ${imgs.size} — checking each ===`);
const badImg=[];
for(const i of imgs){
  const r=await get(i,{method:"HEAD"});
  if(r.status>=400||r.status===0) badImg.push([r.status,i]);
}
console.log(badImg.length?badImg.map(([s,i])=>`  ${s}  ${i.replace(B,"")}`).join("\n"):"  all images OK");

console.log(`\n=== pages slower than 3s: ${slow.length} ===`);
slow.sort((a,b)=>b[0]-a[0]).slice(0,5).forEach(([ms,u])=>console.log(`  ${ms}ms  ${u.replace(B,"")}`));

console.log(`\n=== other issues: ${issues.length} ===`);
const grouped=new Map();
for(const [k,u] of issues){ const key=k.split(":")[0]; (grouped.get(key)??grouped.set(key,[]).get(key)).push([k,u]); }
for(const [k,list] of grouped){ console.log(`  ${k} (${list.length})`); list.slice(0,4).forEach(([kk,u])=>console.log(`     ${u.replace(B,"")}  ${kk.length>40?kk:""}`)); }
