import "dotenv/config";
import { randomBytes } from "node:crypto";
import { appendFileSync,existsSync,readFileSync,writeFileSync,mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { parseDatabaseUrl } from "../src/server/config/environment";
import { createDatabase } from "../src/server/persistence/database";
import { installRoles } from "../src/server/auth/permissions";
import { provisionAccount } from "../src/server/auth/provision";
import { runtimeGrants } from "./runtime-grants";

let db:ReturnType<typeof createDatabase>|undefined;
try{
  const config=parseDatabaseUrl(process.env.MIGRATION_DATABASE_URL),app=parseDatabaseUrl(process.env.DATABASE_URL);
  if(config.host!=="127.0.0.1"||config.port!==3307||config.database!=="moointer_dev"||app.user!=="moointer_app"||app.database!==config.database||app.host!==config.host||app.port!==config.port)throw new Error("LOCAL_ONLY");
  const env=readFileSync(".env","utf8");
  if(!/^APP_ENV=/m.test(env))appendFileSync(".env","\nAPP_ENV=local\n");else if(process.env.APP_ENV!=="local")throw new Error("LOCAL_ONLY");
  if(!/^BETTER_AUTH_URL=/m.test(env))appendFileSync(".env","BETTER_AUTH_URL=http://127.0.0.1:3010\n");
  if(!/^BETTER_AUTH_SECRET=/m.test(env))appendFileSync(".env",`BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\n`);
  db=createDatabase(config);await installRoles(db);
  const email="local.admin@moointer.test",existing=await db.user.findUnique({where:{email}});
  if(!existing){
    const password=randomBytes(24).toString("base64url");
    await provisionAccount(db,{email,name:"ผู้ดูแลระบบพัฒนา",password,role:"ADMINISTRATOR",scope:"GLOBAL"});
    mkdirSync(".local/auth",{recursive:true});writeFileSync(".local/auth/admin-credentials.txt",`LOCAL DEVELOPMENT ONLY\nEmail: ${email}\nPassword: ${password}\n`,{flag:"wx"});
  }else if(!existsSync(".local/auth/admin-credentials.txt"))console.log("Existing administrator preserved. Use the documented local password recovery process if required.");
  for(const [code,role,name] of [["dispatcher","DISPATCHER","ผู้จัดรถระบบพัฒนา"],["supervisor","SUPERVISOR","หัวหน้างานระบบพัฒนา"]]){
    const email=`local.${code}@moointer.test`;
    if(!await db.user.findUnique({where:{email}})){
      const password=randomBytes(24).toString("base64url");
      await provisionAccount(db,{email,name,password,role,scope:"GLOBAL"});
      mkdirSync(".local/auth",{recursive:true});writeFileSync(`.local/auth/${code}-credentials.txt`,`LOCAL DEVELOPMENT ONLY\nEmail: ${email}\nPassword: ${password}\n`,{flag:"wx"});
    }
  }
  const grants=runtimeGrants("moointer_dev","moointer_app");
  const result=spawnSync(resolve(".local/tools/mysql-8.4.11-winx64/bin/mysql.exe"),[`--defaults-file=${resolve(".local/mysql/root-client.ini")}`,"--batch"],{input:grants.join("\n"),encoding:"utf8"});if(result.status!==0)throw new Error("GRANT_FAILED");
  console.log("PASS: secure local account and seven roles installed; scoped runtime grants applied. Credentials are only in ignored .local/auth/*-credentials.txt. No signup or authentication bypass.");
}catch{console.error("AUTH_SETUP_FAILED (existing accounts and data retained)");process.exitCode=1;}finally{await db?.$disconnect();}
