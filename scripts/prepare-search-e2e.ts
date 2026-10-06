import "dotenv/config";
import {randomBytes} from "node:crypto";
import {mkdirSync,writeFileSync} from "node:fs";
import {createDatabase} from "../src/server/persistence/database";
import {testDatabaseConfiguration} from "../src/server/config/environment";
import {synthetic} from "../tests/fixtures/synthetic";
import {seedSearchFixture} from "../tests/fixtures/search";
import {installRoles} from "../src/server/auth/permissions";
import {provisionAccount} from "../src/server/auth/provision";
// Disposable test database only (testDatabaseConfiguration rejects other targets).
const db=createDatabase(testDatabaseConfiguration(process.env));
try{
  await seedSearchFixture(db);await installRoles(db);
  const password=randomBytes(24).toString("base64url"),accounts={requester:"requester@e2e.synthetic.test",branch:"branch@e2e.synthetic.test",supervisor:"supervisor@e2e.synthetic.test",admin:"admin@e2e.synthetic.test",dispatcher:"dispatcher@e2e.synthetic.test",warehouse:"warehouse@e2e.synthetic.test"};
  await provisionAccount(db,{email:accounts.requester,name:"ผู้ฝากส่งสังเคราะห์",password,role:"REQUESTER",scope:"DEPARTMENT",scopeId:"synthetic-department"});
  await provisionAccount(db,{email:accounts.branch,name:"ผู้รับสาขาสังเคราะห์",password,role:"BRANCH_RECEIVER",scope:"BRANCH",scopeId:synthetic.branchIds[0]});
  await provisionAccount(db,{email:accounts.supervisor,name:"หัวหน้างานสังเคราะห์",password,role:"SUPERVISOR",scope:"GLOBAL"});
  await provisionAccount(db,{email:accounts.dispatcher,name:"ผู้จัดรถสังเคราะห์",password,role:"DISPATCHER",scope:"GLOBAL"});
  await provisionAccount(db,{email:accounts.warehouse,name:"เจ้าหน้าที่คลังสังเคราะห์",password,role:"WAREHOUSE",scope:"WAREHOUSE",scopeId:"synthetic-warehouse"});
  await provisionAccount(db,{email:accounts.admin,name:"ผู้ดูแลสังเคราะห์",password,role:"ADMINISTRATOR",scope:"GLOBAL"});
  mkdirSync(".local/auth",{recursive:true});writeFileSync(".local/auth/e2e-search.json",JSON.stringify({password,...accounts}));
  console.log("PASS: synthetic search fixture and isolated browser accounts created; credentials retained only in ignored local file.");
}catch{console.error("SEARCH_FIXTURE_FAILED");process.exitCode=1;}finally{await db.$disconnect();}
