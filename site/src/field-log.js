// LightBridge Rung 10 / local, privacy-conscious optical field event recorder.
// These logs are USER-REPORTED and can be edited. They are not cryptographic
// proof of physical camera reception, timing calibration or peer identity.
import {decodeFrame} from "./protocol.js";
export const FIELD_SCHEMA="lightbridge-field-log-v1";
export const MAX_LOG_EVENTS=20000;
const now=()=>typeof performance!=="undefined"?performance.now():Date.now();
const utc=()=>new Date().toISOString();
const clean=s=>String(s??"").replace(/[\u0000-\u001f]/g," ").slice(0,160);
export class FieldRecorder {
  constructor(role,{clock=now,utcClock=utc}={}){
    if(!["sender","receiver"].includes(role))throw new Error("Invalid field-log role");
    this.role=role;this.clock=clock;this.utcClock=utcClock;this.begin(null);
  }
  begin(sessionId=null){
    this.startedAtUtc=this.utcClock();
    this.startedMs=this.clock();
    this.sessionId=sessionId;
    this.events=[];
    this.counters={displayed:0,observed:0,observedCamera:0,observedManual:0,
      duplicate:0,rejected:0,scanAttempts:0,scanQrDecoded:0,
      cameraStarts:0,verificationSucceeded:0,verificationFailed:0};
    this.verified=null;this.droppedEvents=0;this.observedSequences=new Set();
  }
  #push(event){
    if(this.events.length>=MAX_LOG_EVENTS){this.droppedEvents++;return;}
    this.events.push({elapsedMs:Math.max(0,Math.round(this.clock()-this.startedMs)),...event});
  }
  shown(text){
    if(this.role!=="sender")throw new Error("Expected sender");
    const frame=decodeFrame(text);
    if(this.sessionId!==frame.session)throw new Error("Wrong send session");
    this.counters.displayed++;
    // A QR render completed. It does not establish the display was illuminated
    // for a complete frame interval or that another device observed it.
    this.#push({type:"qr_generated_for_display",sequence:frame.sequence});
  }
  scanAttempt(foundQr=false){
    if(this.role!=="receiver")throw new Error("Expected receiver");
    this.counters.scanAttempts++;
    if(foundQr)this.counters.scanQrDecoded++;
  }
  cameraEvent(action){
    if(this.role!=="receiver"||!["camera-start","camera-stop"].includes(action))
      throw new Error("Invalid camera event");
    if(action==="camera-start")this.counters.cameraStarts++;
    this.#push({type:action});
  }
  received(frameText,method,snapshot){
    if(this.role!=="receiver"||!["camera","manual"].includes(method))throw new Error("Invalid capture method");
    const frame=decodeFrame(frameText);
    if(this.sessionId===null)this.sessionId=frame.session;
    if(frame.session!==this.sessionId)throw new Error("Unmatched received session");
    const duplicate=this.observedSequences.has(frame.sequence);
    this.observedSequences.add(frame.sequence);
    this.counters.observed++;
    if(method==="camera")this.counters.observedCamera++;
    else this.counters.observedManual++;
    if(duplicate)this.counters.duplicate++;
    this.#push({type:"frame_observed",sequence:frame.sequence,method,
      duplicate,blocksSolved:Math.max(0,Number(snapshot?.received)||0)});
  }
  rejected(method,reason){
    if(this.role!=="receiver"||!["camera","manual"].includes(method))throw new Error("Invalid rejection method");
    this.counters.rejected++;
    this.#push({type:"frame_rejected",method,reason:clean(reason)});
  }
  verification(status,{sha256=null,bytes=null}={}){
    if(this.role!=="receiver"||!["success","failure"].includes(status))
      throw new Error("Invalid verification state");
    if(status==="success"){
      if(!/^[0-9a-f]{64}$/.test(sha256)||!Number.isSafeInteger(bytes)||bytes<1||bytes>2097152)
        throw new Error("Invalid verified file metadata");
      this.verified={sha256,bytes};
      this.counters.verificationSucceeded++;
    }else this.counters.verificationFailed++;
    this.#push({type:"verification_"+status,...(status==="success"?this.verified:{})});
  }
  exportLog(conditions={}){
    const cleanConditions={};
    for(const name of ["distanceCm","lighting","deviceLabel","notes"]){
      cleanConditions[name]=clean(conditions?.[name]);
    }
    return {
      schema:FIELD_SCHEMA,role:this.role,sessionId:this.sessionId,
      startedAtUtc:this.startedAtUtc,
      timestamps:"monotonic milliseconds relative to this device's own start; not synchronized between devices",
      source:"self-reported browser event log, editable JSON, not a signed measurement",
      observationBoundary:this.role==="sender"?
        "qr_generated_for_display is not optical emission or receipt proof":
        "camera means the browser camera scan path was used; not independently verified",
      conditions:cleanConditions,counters:{...this.counters},
      events:this.events.map(e=>({...e})),droppedEvents:this.droppedEvents,
      verified:this.verified?{...this.verified}:null,
      physicalCameraTransferIndependentlyVerified:false,
      senderIdentityAuthenticated:false,receiverConsentCryptographicallyVerified:false,
      physicalPowerDelivered:false
    };
  }
}
