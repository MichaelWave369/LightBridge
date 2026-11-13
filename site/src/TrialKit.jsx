import React,{useState} from "react";
import {Monitor,Camera,FileCheck2,AlertTriangle,FlaskConical,ArrowRight,WifiOff} from "lucide-react";
import "./trialKit.css";
const runs=[
  {title:"Baseline",detail:"Start around 30 cm, with steady indoor light and 1 frame per second. Use the small synthetic test file."},
  {title:"Repeatability",detail:"Repeat with the same conditions and preserve both successful and failed session logs."},
  {title:"Conditions",detail:"Try increasing distance or introducing mild glare. Change one condition at a time and record it."},
  {title:"Interruption",detail:"Briefly obstruct or pause the sender. Record if the receiver recovers, including incomplete runs."}
];
const steps={
 sender:[
  "Open Transmit and click Load public 256-byte test packet.",
  "Confirm encryption is off only for this public packet; keep private files encrypted.",
  "Prepare the transfer, save the sender receipt, and keep the speed at 1 frame per second.",
  "Wait until the receiver camera is ready, then start the animated QR frames.",
  "Export the sender field log after the attempt, including unsuccessful runs."
 ],
 receiver:[
  "On a separate phone or camera-equipped device, open Receive using HTTPS.",
  "Enter optional device label, approximate distance, lighting, and test notes.",
  "Start the camera. Aim at the whole QR on the sender screen before the sender begins.",
  "If blocks reconstruct, click Verify & recover file. Save the receiver receipt.",
  "Always export the receiver field log. Avoid manual frame entry during camera-only trials."
 ],
 review:[
  "Keep the sender receipt and field log together, and retain the receiving device's log.",
  "Open Field Compare and import the sender and receiver field-log JSON files.",
  "Check session matching, camera-only sequences, manual observations, and warnings.",
  "Record successes AND failures. Compare repeat runs before changing a test condition.",
  "Don't interpret sequence gaps as measured photon loss or unsynchronized clocks as one-way latency."
 ]
};
export default function TrialKit({onNavigate}){
  const [role,setRole]=useState("sender");
  const [checked,setChecked]=useState({});
  const tabs=[{id:"sender",name:"Sender",Icon:Monitor},{id:"receiver",name:"Receiver",Icon:Camera},{id:"review",name:"Compare",Icon:FileCheck2}];
  const nav=role==="sender"?"send":role==="receiver"?"receive":"compare";
  return <section className="panel standalone trial-kit">
    <div className="section-heading"><div className="eyebrow">RUNG 12 / REAL-DEVICE TRIAL</div>
      <h2>Physical Link Trial Kit</h2>
      <p>Run a repeatable screen-to-camera experiment with a standardized harmless file, local evidence, and explicit limitations.</p></div>
    <div className="trial-notice"><AlertTriangle size={19}/><div><strong>Physical testing is still pending.</strong> Preparing this workflow does not prove real-device transfer, light emission, loss rate, peer identity, or optical power delivery.</div></div>
    <div className="trial-flow">
      <div><Monitor size={21}/><strong>Screen sender</strong><small>Animated PLB1 QR</small></div>
      <ArrowRight size={21} className="trial-flow-arrow"/>
      <div><Camera size={21}/><strong>Camera receiver</strong><small>Capture + verify</small></div>
      <ArrowRight size={21} className="trial-flow-arrow"/>
      <div><FileCheck2 size={21}/><strong>Compare results</strong><small>Receipts + local logs</small></div>
    </div>
    <div className="trial-rolebar" role="group" aria-label="Trial instruction section">
      {tabs.map(t=><button key={t.id} className={role===t.id?"active":""} onClick={()=>setRole(t.id)}><t.Icon size={16}/>{t.name}</button>)}
    </div>
    <div className="trial-steps"><strong>{role==="sender"?"Sending display":role==="receiver"?"Receiving camera":"Evidence review"}</strong>
      {steps[role].map((instruction,i)=>{
        const key=role+"-"+i;
        return <label className="trial-step" key={key}><input type="checkbox" checked={Boolean(checked[key])} onChange={e=>setChecked(old=>({...old,[key]:e.target.checked}))}/><span>{instruction}</span></label>;
      })}
      <button className="primary" onClick={()=>onNavigate(nav)}><ArrowRight size={16}/>{role==="sender"?"Go to Transmit":role==="receiver"?"Go to Receive":"Go to Field Compare"}</button>
    </div>
    <div className="trial-runs"><strong><FlaskConical size={18}/> Repeatable trial sequence</strong>
      <div className="trial-run-grid">{runs.map((r,i)=><div key={r.title}><span>RUN {i+1}</span><strong>{r.title}</strong><p>{r.detail}</p></div>)}</div>
    </div>
    <div className="trial-footer"><WifiOff size={18}/><p>All packet data is synthetic and public. The sender still requires explicit Prepare and Start actions. The trial checklist exists only in this browser view and is not a signed experiment record.</p></div>
  </section>;
}
