import assert from "node:assert/strict";
import {test} from "node:test";
import {authConfiguration} from "../../src/server/auth/config";
test("local authentication never silently becomes a deployed production fallback",()=>{
  const env={APP_ENV:"local",BETTER_AUTH_URL:"http://127.0.0.1:3010",BETTER_AUTH_SECRET:"test-only-random-equivalent-secret-1234567890"};
  assert.equal(authConfiguration(env).baseURL,env.BETTER_AUTH_URL);
  for(const changes of [{APP_ENV:"production"},{APP_ENV:undefined},{BETTER_AUTH_URL:"https://example.com"},{BETTER_AUTH_SECRET:"placeholder"}])assert.throws(()=>authConfiguration({...env,...changes}));
});
