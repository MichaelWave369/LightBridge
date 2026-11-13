import test from "node:test";
import assert from "node:assert/strict";
import {trialBytes} from "../src/trialPacket.js";
import {createTransfer,Receiver,finalizeTransfer} from "../src/protocol.js";
test("standard packet sizes are exact and repeatable",()=>{
  for(const size of [256,1024]){
    const a=trialBytes(size),b=trialBytes(size);
    assert.equal(a.byteLength,size);
    assert.deepEqual(a,b);
    assert.match(new TextDecoder().decode(a),/LIGHTBRIDGE PUBLIC TRIAL V1/);
    assert.match(new TextDecoder().decode(a),/SYNTHETIC DATA ONLY/);
  }
});
test("rejects unsupported packet sizes",()=>{
  for(const size of [-1,0,1,255,257,2097152,"256",NaN]){
    assert.throws(()=>trialBytes(size),/size/);
  }
});
test("public trial packet completes existing PLB1 SHA-256 roundtrip",async()=>{
  const bytes=trialBytes(256);
  const file={name:"lightbridge-trial-256B.txt",type:"text/plain",size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(0)};
  const transfer=await createTransfer(file,{encrypt:false,blockSize:128});
  const receiver=new Receiver();
  for(let i=0;i<transfer.count;i++)receiver.addFrame(transfer.makeFrame(i));
  assert.ok(receiver.complete);
  const recovered=await finalizeTransfer(receiver);
  assert.deepEqual(recovered.bytes,bytes);
});
