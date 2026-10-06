import "server-only";
import { DomainError } from "./domain/errors";
import { authConfiguration } from "./auth/config";
export function safeFailure(error:unknown){
  if(error instanceof DomainError)return Response.json({code:error.code,message:error.message},{status:error.code==="UNAUTHENTICATED"?401:error.code==="FORBIDDEN"?403:error.code==="NOT_FOUND"?404:["VERSION_CONFLICT","DUPLICATE_MASTER"].includes(error.code)?409:400,headers:{"Cache-Control":"no-store"}});
  return Response.json({code:"UNAVAILABLE",message:"ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแล"},{status:503,headers:{"Cache-Control":"no-store"}});
}
export async function readWriteBody(request:Request){
  if(request.headers.get("origin")!==authConfiguration(process.env).baseURL)throw new DomainError("FORBIDDEN","คำขอไม่ถูกต้อง กรุณาเปิดหน้าเว็บใหม่");
  if(!request.headers.get("content-type")?.startsWith("application/json"))throw new DomainError("INVALID_INPUT","รูปแบบข้อมูลไม่ถูกต้อง");
  const text=await request.text();if(text.length>20000)throw new DomainError("INVALID_INPUT","ข้อมูลมีขนาดเกินกำหนด");
  try{return JSON.parse(text);}catch{throw new DomainError("INVALID_INPUT","ข้อมูลไม่ถูกต้อง");}
}
