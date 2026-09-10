import test from "node:test";
import assert from "node:assert/strict";
import {apiError} from "./apiError.js";

test("database initialization failures return 503 without exposing Prisma details",()=>{
  const result=apiError({name:"PrismaClientInitializationError",message:"Invalid prisma.sale.findMany() invocation: Can't reach database server at private-host:28285"});
  assert.equal(result.status,503);
  assert.match(result.message,/database connection is unavailable/i);
  assert.doesNotMatch(result.message,/prisma|private-host|28285/i);
});

test("connection errors support both Prisma code and errorCode shapes",()=>{
  for(const code of ["P1000","P1001","P1002","P1008","P1011","P1017"]){
    assert.equal(apiError({code}).status,503);
    assert.equal(apiError({errorCode:code}).status,503);
  }
});

test("transaction and validation messages keep existing behavior",()=>{
  assert.match(apiError({code:"P2028"}).message,/same bill will not be charged twice/);
  assert.equal(apiError({code:"P2002"}).status,409);
  assert.equal(apiError({message:"Select at least one item to return."}).status,400);
});
