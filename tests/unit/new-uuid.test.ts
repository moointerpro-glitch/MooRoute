import assert from "node:assert/strict";
import {test} from "node:test";
import {newUuid} from "../../src/lib/new-uuid";
const v4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
test("D240: identifiers are still valid version 4 where crypto.randomUUID is missing (plain-HTTP network address)",()=>{
  assert.match(newUuid(),v4);
  const original=Object.getOwnPropertyDescriptor(globalThis.crypto,"randomUUID")??Object.getOwnPropertyDescriptor(Object.getPrototypeOf(globalThis.crypto),"randomUUID");
  Object.defineProperty(globalThis.crypto,"randomUUID",{value:undefined,configurable:true});
  try{
    const ids=Array.from({length:200},()=>newUuid());
    for(const id of ids)assert.match(id,v4);
    assert.equal(new Set(ids).size,ids.length);
  }finally{if(original)Object.defineProperty(globalThis.crypto,"randomUUID",original);}
});
