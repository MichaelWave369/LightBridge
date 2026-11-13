import test from "node:test";
import assert from "node:assert/strict";
import {opticalChannelPlan, runOpticalBatch} from "../src/channelLab.js";
import {createTransfer, Receiver, finalizeTransfer} from "../src/protocol.js";

function sample(size = 800) {
  const bytes = Uint8Array.from({length:size}, (_, i) => (i * 19 + 11) & 255);
  return {name:"test.bin",type:"application/octet-stream",size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(0)};
}

test("channel model is reproducible and bounded", () => {
  const config={frameCount:100,seed:369,dropStartPct:25,burstLength:3,duplicatePct:20,reorderWindow:4};
  assert.deepEqual(opticalChannelPlan(config),opticalChannelPlan(config));
  const plan=opticalChannelPlan(config);
  assert.equal(plan.dropped+new Set(plan.observedSequences).size,100);
  assert.equal(plan.observedSequences.length,100-plan.dropped+plan.duplicates);
  assert.ok(plan.actualDropPct>=0 && plan.actualDropPct<=100);
});
test("zero impairment preserves all ordered frames",()=>{
  const plan=opticalChannelPlan({frameCount:10,dropStartPct:0,duplicatePct:0,burstLength:1,reorderWindow:1});
  assert.deepEqual(plan.observedSequences,[0,1,2,3,4,5,6,7,8,9]);
  assert.equal(plan.dropped,0);
});
test("100 percent drop prevents observations",()=>{
  const plan=opticalChannelPlan({frameCount:20,dropStartPct:100,duplicatePct:100,burstLength:4});
  assert.equal(plan.dropped,20);
  assert.deepEqual(plan.observedSequences,[]);
});
test("invalid simulator parameters fail closed",()=>{
  assert.throws(()=>opticalChannelPlan({frameCount:0}),/frameCount/);
  assert.throws(()=>opticalChannelPlan({frameCount:4097}),/frameCount/);
  assert.throws(()=>opticalChannelPlan({frameCount:2,dropStartPct:-1}),/dropStartPct/);
  assert.throws(()=>opticalChannelPlan({frameCount:2,duplicatePct:Infinity}),/duplicatePct/);
  assert.throws(()=>opticalChannelPlan({frameCount:2,burstLength:0}),/burstLength/);
});
test("PLB1 synthetic clean channel verifies file integrity",async()=>{
  const tx=await createTransfer(sample(),{encrypt:false,blockSize:128});
  const report=await runOpticalBatch({transfer:tx,ReceiverClass:Receiver,finalize:finalizeTransfer,config:{trials:4,seed:369,dropStartPct:0,duplicatePct:0,burstLength:1,reorderWindow:1}});
  assert.equal(report.verifiedCount,4);
  assert.equal(report.evidence,"SOFTWARE_SIMULATION_ONLY");
  assert.ok(report.results.every(r=>r.reconstructed && r.verified && r.scanned>0));
});
test("PLB1 synthetic complete loss never claims success",async()=>{
  const tx=await createTransfer(sample(),{encrypt:false,blockSize:128});
  const report=await runOpticalBatch({transfer:tx,ReceiverClass:Receiver,finalize:finalizeTransfer,config:{trials:3,dropStartPct:100,duplicatePct:100,burstLength:4}});
  assert.equal(report.verifiedCount,0);
  assert.ok(report.results.every(r=>!r.reconstructed && !r.verified && r.scanned===0));
});
test("PLB1 accepts duplicate and re-ordered observations with integrity",async()=>{
  const tx=await createTransfer(sample(1500),{encrypt:false,blockSize:128});
  const report=await runOpticalBatch({transfer:tx,ReceiverClass:Receiver,finalize:finalizeTransfer,config:{trials:5,seed:1,dropStartPct:0,duplicatePct:100,burstLength:1,reorderWindow:8}});
  assert.equal(report.verifiedCount,5);
  assert.ok(report.results.every(r=>r.modeledDuplicates>0));
});
