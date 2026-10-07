import "server-only";
import { DomainError } from "./domain/errors";
import { authConfiguration } from "./auth/config";
import { logUnexpected } from "./logging";
import { readBodyWithin, utf8BytesFor } from "./request-body";
export function safeFailure(error:unknown){
  if(error instanceof DomainError)return Response.json({code:error.code,message:error.message},{status:error.code==="UNAUTHENTICATED"?401:["FORBIDDEN","SELF_REVIEW"].includes(error.code)?403:error.code==="NOT_FOUND"?404:["VERSION_CONFLICT","DUPLICATE_MASTER","DUPLICATE_TRIP"].includes(error.code)?409:400,headers:{"Cache-Control":"no-store"}});
  // Unexpected failures are logged for operators without messages, SQL or parameters.
  logUnexpected("api.unexpected_error",error);
  return Response.json({code:"UNAVAILABLE",message:"ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแล"},{status:503,headers:{"Cache-Control":"no-store"}});
}
export async function readWriteBody(request:Request, maxLength=20000){
  if(request.headers.get("origin")!==authConfiguration(process.env).baseURL)throw new DomainError("FORBIDDEN","คำขอไม่ถูกต้อง กรุณาเปิดหน้าเว็บใหม่");
  if(!request.headers.get("content-type")?.startsWith("application/json"))throw new DomainError("INVALID_INPUT","รูปแบบข้อมูลไม่ถูกต้อง");
  const bytes=await readBodyWithin(request,utf8BytesFor(maxLength));if(!bytes)throw new DomainError("INVALID_INPUT","ข้อมูลมีขนาดเกินกำหนด");
  const text=new TextDecoder().decode(bytes);if(text.length>maxLength)throw new DomainError("INVALID_INPUT","ข้อมูลมีขนาดเกินกำหนด");
  try{return JSON.parse(text);}catch{throw new DomainError("INVALID_INPUT","ข้อมูลไม่ถูกต้อง");}
}
/** Multipart upload with a hard byte limit enforced while reading (see request-body.ts). */
export async function readFormDataWithin(request:Request,maxBytes:number,tooLarge:string,missing:string){
  const bytes=await readBodyWithin(request,maxBytes);if(!bytes)throw new DomainError("INVALID_FILE",tooLarge);
  return new Response(bytes,{headers:{"content-type":request.headers.get("content-type")??""}}).formData().catch(()=>{throw new DomainError("INVALID_FILE",missing);});
}
