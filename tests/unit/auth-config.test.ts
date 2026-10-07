import assert from "node:assert/strict";
import {test} from "node:test";
import {authConfiguration,peerAddress} from "../../src/server/auth/config";
test("local authentication never silently becomes a deployed production fallback",()=>{
  const env={APP_ENV:"local",BETTER_AUTH_URL:"http://127.0.0.1:3010",BETTER_AUTH_SECRET:"test-only-random-equivalent-secret-1234567890"};
  assert.equal(authConfiguration(env).baseURL,env.BETTER_AUTH_URL);
  for(const changes of [{APP_ENV:"production"},{APP_ENV:undefined},{BETTER_AUTH_URL:"https://example.com"},{BETTER_AUTH_SECRET:"placeholder"}])assert.throws(()=>authConfiguration({...env,...changes}));
});

test("D227: production accounts need an HTTPS origin on a real host name and a real secret",()=>{
  const env={APP_ENV:"production",BETTER_AUTH_URL:"https://transport.example.co.th",BETTER_AUTH_SECRET:"test-only-random-equivalent-secret-1234567890"};
  assert.deepEqual([authConfiguration(env).baseURL,authConfiguration(env).mode],["https://transport.example.co.th","production"]);
  for(const url of ["http://transport.example.co.th","https://127.0.0.1","https://localhost","https://203.0.113.10","https://intranet","https://transport.example.co.th/app","https://user:pw@transport.example.co.th",""])
    assert.throws(()=>authConfiguration({...env,BETTER_AUTH_URL:url}),Error,url);
  assert.throws(()=>authConfiguration({...env,BETTER_AUTH_SECRET:"short"}));
  assert.throws(()=>authConfiguration({...env,APP_ENV:"staging"}));
});
test("D227: the sign-in throttle key comes from a trusted proxy header only when the operator names one",()=>{
  const headers=new Headers({"x-forwarded-for":"198.51.100.7, 203.0.113.9","x-real-ip":"203.0.113.9"});
  assert.equal(peerAddress({APP_ENV:"local",TRUSTED_PROXY_HEADER:"x-forwarded-for"},headers),"127.0.0.1","local never trusts forwarded headers");
  assert.equal(peerAddress({APP_ENV:"production"},headers),"127.0.0.1","no trusted header configured: one shared bucket");
  assert.equal(peerAddress({APP_ENV:"production",TRUSTED_PROXY_HEADER:"X-Forwarded-For"},headers),"203.0.113.9","the entry written by the nearest proxy, not the client-supplied one");
  assert.equal(peerAddress({APP_ENV:"production",TRUSTED_PROXY_HEADER:"x-forwarded-for",TRUSTED_PROXY_HOPS:"2"},headers),"198.51.100.7");
  assert.equal(peerAddress({APP_ENV:"production",TRUSTED_PROXY_HEADER:"x-real-ip"},headers),"203.0.113.9");
  assert.equal(peerAddress({APP_ENV:"production",TRUSTED_PROXY_HEADER:"x-client-ip"},new Headers({"x-client-ip":"198.51.100.7"})),"127.0.0.1","unknown header names are not trusted");
  assert.equal(peerAddress({APP_ENV:"production",TRUSTED_PROXY_HEADER:"x-forwarded-for"},new Headers({"x-forwarded-for":"not-an-address"})),"127.0.0.1");
  assert.equal(peerAddress({APP_ENV:"production",TRUSTED_PROXY_HEADER:"x-forwarded-for"},new Headers()),"127.0.0.1");
});
