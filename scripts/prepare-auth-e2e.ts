import "dotenv/config";
import {randomBytes} from "node:crypto";
import {mkdirSync,writeFileSync} from "node:fs";
import {createDatabase} from "../src/server/persistence/database";
import {testDatabaseConfiguration} from "../src/server/config/environment";
import {seedSynthetic,synthetic} from "../tests/fixtures/synthetic";
import {installRoles} from "../src/server/auth/permissions";
import {provisionAccount} from "../src/server/auth/provision";
const db=createDatabase(testDatabaseConfiguration(process.env));
try{
  await seedSynthetic(db);await installRoles(db);
  const password=randomBytes(24).toString("base64url");
  await provisionAccount(db,{departmentId:"synthetic-department",email:"admin@e2e.synthetic.test",name:"ผู้ดูแลสังเคราะห์",password,role:"ADMINISTRATOR",scope:"GLOBAL"});
  await provisionAccount(db,{departmentId:"synthetic-department",email:"branch@e2e.synthetic.test",name:"ผู้รับสาขาสังเคราะห์",password,role:"BRANCH_RECEIVER",scope:"BRANCH",scopeId:synthetic.branchIds[0]});
  await provisionAccount(db,{departmentId:"synthetic-department",email:"dispatcher@e2e.synthetic.test",name:"ผู้จัดรถสังเคราะห์",password,role:"DISPATCHER",scope:"GLOBAL"});
  await provisionAccount(db,{departmentId:"synthetic-department",email:"supervisor@e2e.synthetic.test",name:"หัวหน้างานสังเคราะห์",password,role:"SUPERVISOR",scope:"GLOBAL"});
  mkdirSync(".local/auth",{recursive:true});writeFileSync(".local/auth/e2e.json",JSON.stringify({password,dispatcher:"dispatcher@e2e.synthetic.test",supervisor:"supervisor@e2e.synthetic.test",admin:"admin@e2e.synthetic.test",branch:"branch@e2e.synthetic.test"}));
  console.log("PASS: isolated browser fixture accounts created; credentials retained only in ignored local file.");
}catch{console.error("BROWSER_FIXTURE_FAILED");process.exitCode=1;}finally{await db.$disconnect();}
