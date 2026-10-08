/** Only the originating list and its approved filters can be used as a return destination. */
export function adminReturnHref(value:unknown,fallback:string){
 if(typeof value!=="string"||!value.startsWith("/")||value.startsWith("//"))return fallback;
 try{const url=new URL(value,"https://admin.invalid");if(url.origin!=="https://admin.invalid"||url.pathname!==fallback)return fallback;
  const query=new URLSearchParams();for(const key of ["q","status","page","type"])if(url.searchParams.has(key))query.set(key,url.searchParams.get(key)!.slice(0,100));
  return fallback+(query.size?`?${query}`:"");
 }catch{return fallback;}
}
