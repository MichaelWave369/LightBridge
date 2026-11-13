import React,{useState} from "react";
import {Activity,AlertTriangle,Download,FileJson,ShieldAlert,GitCompareArrows} from "lucide-react";
import {compareFieldLogs} from "./fieldCompare.js";
import "./fieldCompare.css";
const MAX_BYTES=4*1024*1024;
const pct=x=>x==null?"N/A":(x*100).toFixed(1)+"%";
function saveReport(value){
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:"application/json"}));
  const a=document.createElement("a");
  a.href=url;a.download="LightBridge_field_pair_comparison.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function FieldCompare(){
  const [sender,setSender]=useState(null);
  const [receiver,setReceiver]=useState(null);
  const [synthetic,setSynthetic]=useState(null);
  const [report,setReport]=useState(null);
  const [error,setError]=useState("");
  async function pick(file,setter){
    setter(null);setReport(null);setError("");
    if(!file)return;
    try{
      if(file.size<1||file.size>MAX_BYTES)throw Error("Nonempty JSON exports must be at most 4 MiB.");
      if(!file.name.toLowerCase().endsWith(".json"))throw Error("Please select a JSON export.");
      setter({name:file.name,data:JSON.parse(await file.text())});
    }catch(e){setError("Could not read "+file.name+": "+(e?.message||String(e)));}
  }
  function run(){
    setError("");setReport(null);
    try{
      if(!sender||!receiver)throw Error("Select a sender log and receiver log.");
      setReport(compareFieldLogs(sender.data,receiver.data,synthetic?.data??null));
    }catch(e){setError(e?.message||String(e));}
  }
  function clear(){
    setSender(null);setReceiver(null);setSynthetic(null);setReport(null);setError("");
  }
  const inputs=[
    {key:"send",name:"Sender field log",data:sender,set:setSender},
    {key:"receive",name:"Receiver field log",data:receiver,set:setReceiver},
    {key:"sim",name:"Synthetic Lab report (optional)",data:synthetic,set:setSynthetic}
  ];
  return <section className="panel standalone compare-panel">
    <div className="section-heading"><div className="eyebrow">RUNG 11 / LOCAL EVIDENCE REVIEW</div>
      <h2>Field Compare</h2>
      <p>Compare sender and receiver logs from a real-device attempt. Optionally show a separate synthetic trial report alongside them.</p></div>
    <div className="compare-warning"><ShieldAlert size={18}/><div><strong>Unsigned, user-editable evidence.</strong> Files stay in the browser; no upload is performed by this tool. Camera-path claims and sequence overlap do not independently prove physical reception, packet loss or one-way latency.</div></div>
    <div className="compare-inputs">
      {inputs.map(item=><label key={item.key} className="compare-input">
        <span><FileJson size={17}/><strong>{item.name}</strong></span>
        <input type="file" accept=".json,application/json" onChange={e=>pick(e.target.files?.[0],item.set)}/>
        <small>{item.data?.name??"Choose JSON export"}</small>
      </label>)}
    </div>
    <div className="button-pair"><button className="primary" disabled={!sender||!receiver} onClick={run}><GitCompareArrows size={16}/> Compare logs</button>
      <button className="secondary" onClick={clear}><Activity size={16}/> Clear</button></div>
    {error&&<p className="compare-error" role="alert">{error}</p>}
    {report&&<div className="compare-result" aria-live="polite">
      <div className="compare-header"><strong>Recorded sequence analysis</strong><code>Session {report.sessionId}</code></div>
      <div className="compare-metrics">
        <div><span>Sender generated sequences</span><strong>{report.sender.uniqueSequences}</strong><small>Generated for display, not exposure proof</small></div>
        <div><span>Camera-path sequences</span><strong>{report.receiver.cameraUnique}</strong><small>{report.receiver.cameraMatches} found in sender log</small></div>
        <div><span>Manual input sequences</span><strong>{report.receiver.manualUnique}</strong><small>Excluded from optical-path count</small></div>
        <div><span>Recorded camera overlap</span><strong>{pct(report.receiver.cameraRecordedOverlap)}</strong><small>Not actual optical delivery rate</small></div>
      </div>
      <div className="compare-summary">
        <div><span>Receiver verification claim</span><strong>{report.receiver.receiverClaimsVerified?report.receiver.receiverClaimsVerifiedBytes+" B":"Not recorded"}</strong></div>
        <div><span>Camera frames missing from sender log</span><strong>{report.receiver.cameraNotInSender}</strong></div>
        <div><span>Receiver rejected events</span><strong>{report.receiver.rejectionEvents}</strong></div>
        <div><span>Truncated events (sender / receiver)</span><strong>{report.sender.droppedLogEvents} / {report.receiver.droppedLogEvents}</strong></div>
      </div>
      {report.synthetic&&<div className="compare-synthetic"><strong>Separate simulated channel results</strong>
        <div className="compare-metrics">
          <div><span>Modelled scheduled frame drops</span><strong>{pct(report.synthetic.modeledDropFraction)}</strong><small>Simulation parameter outcome, not physical loss</small></div>
          <div><span>Verified model trials</span><strong>{report.synthetic.verifiedTrials} / {report.synthetic.trials}</strong><small>Software-only simulated runs</small></div>
        </div>
      </div>}
      <div className="compare-cautions"><strong><AlertTriangle size={16}/> Interpretation boundaries</strong>
        {report.warnings.map((message,i)=><p key={i}>{message}</p>)}
      </div>
      <button className="secondary compare-export" onClick={()=>saveReport(report)}><Download size={16}/> Export comparison JSON</button>
      <p className="footnote">The summary contains derived counts only. Preserve original logs separately; this tool does not rehash the recovered file.</p>
    </div>}
  </section>;
}
