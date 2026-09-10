import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import analytics from './analytics.js';
test('analytics enforces existing session and profit permissions, validates filters before DB access',async()=>{
  process.env.JWT_SECRET='analytics-local-test-only';
  const app=express();app.use(cookieParser());app.use('/analytics',analytics);
  const server=await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server))});
  const url=`http://127.0.0.1:${server.address().port}/analytics/overview`;
  try {
    assert.equal((await fetch(url)).status,401);
    const cashier=jwt.sign({id:1,role:'CASHIER'},process.env.JWT_SECRET);
    assert.equal((await fetch(url,{headers:{cookie:`sc_admin_token=${cashier}`}})).status,403);
    const admin=jwt.sign({id:1,role:'ADMIN'},process.env.JWT_SECRET);
    const invalid=await fetch(url+'?from=2026-02-30',{headers:{cookie:`sc_admin_token=${admin}`}});
    assert.equal(invalid.status,400);assert.match((await invalid.json()).error,/valid/);
  } finally {await new Promise(resolve=>server.close(resolve))}
});
