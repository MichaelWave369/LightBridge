import test from "node:test";
import assert from "node:assert/strict";
import {compareFieldLogs} from "../src/fieldCompare.js";
import {FieldRecorder} from "../src/field-log.js";
import {encodeFrame} from "../src/protocol.js";

const frame=n=>encodeFrame({session:"session_369",sequence:n,count:3,size:128,length:256,payload:new Uint8Array(128)});
function pair(){
  const sender=new FieldRecorder("sender"),receiver=new FieldRecorder("receiver");
  sender.begin("session_369");
  [0,1,2,3].forEach(n=>sender.shown(frame(n)));
  receiver.received(frame(0),"camera",{received:1});
  receiver.received(frame(0),"camera",{received:1});
  receiver.received(frame(2),"camera",{received:2});
  receiver.received(frame(3),"manual",{received:3});
  return [sender.exportLog(),receiver.exportLog()];
}
test("camera and manual evidence stay separate with real PLB1 frame IDs",()=>{
  const [tx,rx]=pair(),r=compareFieldLogs(tx,rx);
  assert.equal(r.sender.uniqueSequences,4);
  assert.equal(r.receiver.cameraEvents,3);
  assert.equal(r.receiver.cameraUnique,2);
  assert.equal(r.receiver.manualUnique,1);
  assert.equal(r.receiver.cameraMatches,2);
  assert.equal(r.receiver.cameraRecordedOverlap,.5);
  assert.equal(r.physicalPacketLossMeasured,false);
  assert.equal(r.oneWayLatencyMeasured,false);
});
test("mismatched session IDs must be rejected",()=>{
  const [tx,rx]=pair();rx.sessionId="other_369";
  assert.throws(()=>compareFieldLogs(tx,rx),/different sessions/);
});
test("receiver can have no observed session after failed attempt",()=>{
  const [tx]=pair(),rx=new FieldRecorder("receiver").exportLog();
  const r=compareFieldLogs(tx,rx);
  assert.equal(r.receiver.hasSession,false);
  assert.equal(r.receiver.cameraUnique,0);
  assert.equal(r.receiver.cameraRecordedOverlap,0);
  assert.ok(r.warnings.some(w=>w.includes("no recorded session")));
});
test("unknown camera observations are counted, not called physical packet loss",()=>{
  const [tx,rx]=pair();
  rx.events.push({type:"frame_observed",elapsedMs:1,sequence:900,method:"camera"});
  const r=compareFieldLogs(tx,rx);
  assert.equal(r.receiver.cameraNotInSender,1);
  assert.equal(r.physicalPacketLossMeasured,false);
});
test("truncated event logs keep warnings",()=>{
  const [tx,rx]=pair();tx.droppedEvents=5;rx.droppedEvents=2;
  assert.ok(compareFieldLogs(tx,rx).warnings.some(w=>w.includes("capacity")));
});
test("bad inputs and unbounded event lists fail",()=>{
  const [tx,rx]=pair();
  assert.throws(()=>compareFieldLogs({...tx,events:Array(20001).fill({})},rx),/oversized/);
  assert.throws(()=>compareFieldLogs({...tx,role:"receiver"},rx),/sender/);
  assert.throws(()=>compareFieldLogs(tx,{...rx,verified:{sha256:"invalid",bytes:2}}),/verified/);
  assert.throws(()=>compareFieldLogs(tx,{...rx,events:[{type:"frame_observed",elapsedMs:0,sequence:-1,method:"camera"}]}),/sequence/);
});
test("optional model comparison explicitly labels separate metrics",()=>{
  const [tx,rx]=pair();
  const sim={schema:"lightbridge.synthetic-channel-v1",evidence:"SOFTWARE_SIMULATION_ONLY",
    config:{trials:2,frameCount:10},verifiedCount:1,
    results:[{verified:true,modeledDropped:2},{verified:false,modeledDropped:6}]};
  const r=compareFieldLogs(tx,rx,sim);
  assert.equal(r.synthetic.modeledDropFraction,.4);
  assert.equal(r.synthetic.verifiedTrials,1);
  assert.ok(r.warnings.some(w=>w.includes("not interchangeable")));
});
test("inconsistent synthetic verification claims are rejected",()=>{
  const [tx,rx]=pair();
  const sim={schema:"lightbridge.synthetic-channel-v1",evidence:"SOFTWARE_SIMULATION_ONLY",
    config:{trials:1,frameCount:10},verifiedCount:1,results:[{verified:false,modeledDropped:0}]};
  assert.throws(()=>compareFieldLogs(tx,rx,sim),/mismatch/);
});
