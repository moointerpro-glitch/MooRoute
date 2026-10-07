import "dotenv/config";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,relative,isAbsolute} from "node:path";
import {randomBytes} from "node:crypto";
import {hashPassword} from "better-auth/crypto";
import {createDatabase} from "../src/server/persistence/database";
import {parseDatabaseUrl} from "../src/server/config/environment";
import {provisionAccount,assignAccountDepartment} from "../src/server/auth/provision";
import {installRoles} from "../src/server/auth/permissions";
let db:ReturnType<typeof createDatabase>|undefined;
try{
  if(process.env.APP_ENV!=="local")throw new Error("LOCAL_ONLY");
  const config=parseDatabaseUrl(process.env.MIGRATION_DATABASE_URL);if(config.host!=="127.0.0.1"||config.port!==3307||config.database!=="moointer_dev")throw new Error("LOCAL_ONLY");
  const root=resolve(".local/auth"),path=resolve(process.argv[2]??".local/auth/account-request.json"),rel=relative(root,path);
  if(rel.startsWith("..")||isAbsolute(rel))throw new Error("LOCAL_INPUT_REQUIRED");
  const input=JSON.parse(readFileSync(path,"utf8"));if(!["create","reset-password","disable","assign-department"].includes(input.action)||typeof input.email!=="string")throw new Error("INVALID_ACCOUNT_REQUEST");
  db=createDatabase(config);await installRoles(db);const password=randomBytes(24).toString("base64url");let id:string;
  if(input.action==="create")id=(await provisionAccount(db,{...input,password})).id;
  else if(input.action==="assign-department") id=await assignAccountDepartment(db,input.email,input.departmentId,input.reason);
  else{
    const user=await db.user.findUniqueOrThrow({where:{email:input.email.toLowerCase()}});id=user.id;
    const hash=input.action==="reset-password"?await hashPassword(password):null;
    await db.$transaction(async tx=>{
      await tx.authSession.deleteMany({where:{userId:user.id}});
      if(hash)await tx.authAccount.updateMany({where:{userId:user.id,providerId:"credential"},data:{password:hash}});
      else await tx.user.update({where:{id:user.id},data:{active:false,version:{increment:1}}});
      await tx.auditLog.create({data:{actorId:user.id,entityType:"User",entityId:user.id,action:input.action==="disable"?"LOCAL_OPERATOR_DISABLED":"LOCAL_OPERATOR_PASSWORD_RESET",reason:"Local operator CLI",before:{active:user.active},after:{active:input.action!=="disable"&&user.active,sessionsRevoked:true}}});
    });
  }
  if(["create","reset-password"].includes(input.action)){mkdirSync(root,{recursive:true});writeFileSync(resolve(root,`credentials-${id}.txt`),`LOCAL DEVELOPMENT ONLY\nEmail: ${input.email}\nPassword: ${password}\n`);}
  console.log(`PASS: local account ${input.action}; credential output (only for create/reset-password) is in ignored .local/auth/credentials-${id}.txt. Values not printed.`);
}catch{console.error("LOCAL_ACCOUNT_OPERATION_FAILED");process.exitCode=1;}finally{await db?.$disconnect();}
