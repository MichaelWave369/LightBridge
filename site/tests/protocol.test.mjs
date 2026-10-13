import test from "node:test";
import assert from "node:assert/strict";
import {createTransfer,Receiver,finalizeTransfer,decodeFrame,encodeFrame,crc32,indicesFor} from "../src/protocol.js";

function sample(size=1100) {
  const bytes = Uint8Array.from({length:size},(_,i)=>(i*17+9)%256);
  return {name:"sample.bin",type:"application/octet-stream",size:bytes.length,arrayBuffer:async()=>bytes.buffer,bytes};
}
test("PLB1 header and CRC reject corruption", () => {
  const payload=new Uint8Array(128);
  const text=encodeFrame({session:"12345678",sequence:0,count:1,size:128,length:40,payload});
  assert.equal(decodeFrame(text).session,"12345678");
  assert.equal(crc32(payload),"c2a8fa9d");
  assert.throws(()=>decodeFrame(text.replace("|"+crc32(payload)+"|","|00000000|")),/CRC/);
});
test("systematic transfer reconstructs and validates original sha", async () => {
  const file=sample();
  const tx=await createTransfer(file,{encrypt:false,blockSize:128});
  const rx=new Receiver();
  for(let i=tx.count-1;i>=0;i--)rx.addFrame(tx.makeFrame(i));
  assert.equal(rx.complete,true);
  const decoded=await finalizeTransfer(rx);
  assert.deepEqual(decoded.bytes,file.bytes);
  assert.equal(decoded.filename,"sample.bin");
  assert.match(decoded.receipt.integrityStatus,/PASS/);
});
test("encrypted transport rejects wrong passphrase, then succeeds",async()=>{
 const file=sample(630);
 const tx=await createTransfer(file,{encrypt:true,passphrase:"test passphrase 123",blockSize:128});
 const rx=new Receiver();
 for(let i=0;i<tx.count;i++)rx.addFrame(tx.makeFrame(i));
 await assert.rejects(()=>finalizeTransfer(rx,"wrong"),/Decryption failed/);
 const got=await finalizeTransfer(rx,"test passphrase 123");
 assert.deepEqual(got.bytes,file.bytes);
});
test("parity frame solves a lost systematic block",async()=>{
 const file=sample(1010);
 const tx=await createTransfer(file,{encrypt:false,blockSize:128});
 const rx=new Receiver();
 // Supply several rounds of parity and missing systematic block; recovery remains bounded.
 for(let i=1;i<tx.count;i++)rx.addFrame(tx.makeFrame(i));
 for(let i=tx.count;i<tx.count*12 && !rx.complete;i++)rx.addFrame(tx.makeFrame(i));
 assert.equal(rx.complete,true);
 assert.deepEqual((await finalizeTransfer(rx)).bytes,file.bytes);
});
test("rejects mixed session and large/empty files",async()=>{
 const tx=await createTransfer(sample(130),{encrypt:false});
 const rx=new Receiver();rx.addFrame(tx.makeFrame(0));
 const other=await createTransfer(sample(130),{encrypt:false});
 assert.throws(()=>rx.addFrame(other.makeFrame(0)),/Different transfer session/);
 await assert.rejects(()=>createTransfer(sample(2*1024*1024+1),{encrypt:false}),/2 MiB/);
 await assert.rejects(()=>createTransfer(sample(0),{encrypt:false}),/2 MiB/);
});
test("fountain indices use original PLB1 systematic window",()=>{
 assert.deepEqual(indicesFor("AABBCCDDEE",0,5),[0]);
 assert.deepEqual(indicesFor("AABBCCDDEE",4,5),[4]);
 assert.ok(indicesFor("AABBCCDDEE",5,5).length>=2);
});
