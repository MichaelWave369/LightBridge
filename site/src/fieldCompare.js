// Paired Rung 10 log analysis. Unsigned user-editable logs are not attestations.
// All metrics describe *recorded sequence overlap*, not physical loss or latency.
export const PAIR_SCHEMA="lightbridge.field-pair-comparison-v1";
const validObj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const uint=v=>Number.isSafeInteger(v)&&v>=0;
function validate(log,role){
  if(!validObj(log)||log.schema!=="lightbridge-field-log-v1"||log.role!==role)
    throw Error("Expected a "+role+" lightbridge-field-log-v1 export.");
  if(!Array.isArray(log.events)||log.events.length>20000)
    throw Error("Invalid or oversized "+role+" event list.");
  if(log.sessionId!==null&&(typeof log.sessionId!=="string"||!/^[A-Za-z0-9_-]{6,40}$/.test(log.sessionId)))
    throw Error("Invalid "+role+" session ID.");
  if(!uint(log.droppedEvents??0))throw Error("Invalid log truncation count.");
  for(const e of log.events){
    if(!validObj(e)||!uint(e.elapsedMs))throw Error("Invalid event or elapsed time.");
    if(e.type==="qr_generated_for_display"||e.type==="frame_observed"){
      if(!uint(e.sequence)||e.sequence>1e9)throw Error("Invalid frame sequence.");
      if(e.type==="frame_observed"&&!["camera","manual"].includes(e.method))throw Error("Invalid observation method.");
    }
  }
  if(log.verified!=null){
    if(!validObj(log.verified)||!/^[a-f0-9]{64}$/.test(log.verified.sha256)||
      !uint(log.verified.bytes)||log.verified.bytes<1||log.verified.bytes>2097152)
      throw Error("Invalid verified-file claim.");
  }
  return log;
}
function inspectSynthetic(sim){
  if(sim==null)return null;
  if(!validObj(sim)||sim.schema!=="lightbridge.synthetic-channel-v1"||
    sim.evidence!=="SOFTWARE_SIMULATION_ONLY"||!validObj(sim.config)||
    !Array.isArray(sim.results)||!uint(sim.config.trials)||sim.config.trials<1||
    sim.config.trials>30||sim.results.length!==sim.config.trials||
    !uint(sim.config.frameCount)||sim.config.frameCount<1||sim.config.frameCount>4096||
    !uint(sim.verifiedCount))throw Error("Invalid synthetic-channel report.");
  for(const r of sim.results){
    if(!validObj(r)||typeof r.verified!=="boolean"||
      !uint(r.modeledDropped)||r.modeledDropped>sim.config.frameCount)throw Error("Invalid synthetic trial.");
  }
  const verified=sim.results.filter(r=>r.verified).length;
  if(verified!==sim.verifiedCount)throw Error("Synthetic verified-count mismatch.");
  return {evidence:"SOFTWARE_SIMULATION_ONLY",trials:sim.config.trials,
    verifiedTrials:verified,modeledDropFraction:sim.results.reduce((a,r)=>a+r.modeledDropped,0)/
      (sim.config.frameCount*sim.config.trials)};
}
export function compareFieldLogs(senderLog,receiverLog,simReport=null){
  const sender=validate(senderLog,"sender"),receiver=validate(receiverLog,"receiver");
  if(!sender.sessionId)throw Error("Sender log has no session.");
  if(receiver.sessionId&&sender.sessionId!==receiver.sessionId)throw Error("Sender and receiver have different sessions.");
  const sentEvents=sender.events.filter(e=>e.type==="qr_generated_for_display");
  const cameraEvents=receiver.events.filter(e=>e.type==="frame_observed"&&e.method==="camera");
  const manualEvents=receiver.events.filter(e=>e.type==="frame_observed"&&e.method==="manual");
  const sent=new Set(sentEvents.map(e=>e.sequence));
  const camera=new Set(cameraEvents.map(e=>e.sequence));
  const manual=new Set(manualEvents.map(e=>e.sequence));
  const overlap=set=>[...set].filter(x=>sent.has(x)).length;
  const matchedCamera=overlap(camera),matchedManual=overlap(manual);
  const synthetic=inspectSynthetic(simReport);
  const warnings=[
    "Unsigned and editable browser event logs are not independent physical attestations.",
    "A generated QR does not guarantee screen exposure; absent camera sequences do not prove optical frame loss.",
    "Sender and receiver clocks are unsynchronized. One-way latency is not measurable from these exports."
  ];
  if(!receiver.sessionId)warnings.push("Receiver has no recorded session; incomplete attempt.");
  if(!sent.size)warnings.push("No logged sender frames; overlap is undefined.");
  if(!camera.size)warnings.push("No camera frames logged; manual observations must not be called optical reception.");
  if((sender.droppedEvents??0)||(receiver.droppedEvents??0))warnings.push("Log event capacity was exceeded; the sequence records are incomplete.");
  if(camera.size>matchedCamera||manual.size>matchedManual)warnings.push("Receiver has observations absent from sender's logged frame sequences.");
  if(camera.size&&manual.size)warnings.push("Manual and camera paths coexist; results are deliberately separate.");
  if(synthetic)warnings.push("Modelled frame-drop fraction and recorded camera overlap are not interchangeable measurements.");
  return {schema:PAIR_SCHEMA,evidence:"UNSIGNED_LOCAL_LOG_COMPARISON",sessionId:sender.sessionId,
    sender:{generatedEvents:sentEvents.length,uniqueSequences:sent.size,droppedLogEvents:sender.droppedEvents??0},
    receiver:{hasSession:Boolean(receiver.sessionId),cameraEvents:cameraEvents.length,cameraUnique:camera.size,
      manualEvents:manualEvents.length,manualUnique:manual.size,
      cameraMatches:matchedCamera,manualMatches:matchedManual,
      cameraNotInSender:camera.size-matchedCamera,manualNotInSender:manual.size-matchedManual,
      cameraRecordedOverlap:sent.size?matchedCamera/sent.size:null,
      rejectionEvents:receiver.events.filter(e=>e.type==="frame_rejected").length,
      receiverClaimsVerified:Boolean(receiver.verified),
      receiverClaimsVerifiedBytes:receiver.verified?.bytes??null,
      droppedLogEvents:receiver.droppedEvents??0},
    synthetic,warnings,
    physicalPacketLossMeasured:false,oneWayLatencyMeasured:false,
    physicalTransferIndependentlyVerified:false,identityAuthenticated:false};
}
