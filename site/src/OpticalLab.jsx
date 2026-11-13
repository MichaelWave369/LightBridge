import React, {useState} from "react";
import {Activity, Download, FlaskConical, RotateCcw, ShieldCheck, AlertTriangle} from "lucide-react";
import {createTransfer, Receiver, finalizeTransfer, BLOCK_SIZE} from "./protocol.js";
import {runOpticalBatch} from "./channelLab.js";
import "./opticalLab.css";

const SAMPLE_SIZES = [512, 2048, 8192];

function exportReport(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "LightBridge_synthetic_channel_report.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function OpticalLab() {
  const [size, setSize] = useState(2048);
  const [dropStartPct, setDropStartPct] = useState(15);
  const [duplicatePct, setDuplicatePct] = useState(5);
  const [burstLength, setBurstLength] = useState(2);
  const [reorderWindow, setReorderWindow] = useState(3);
  const [trials, setTrials] = useState(10);
  const [seed, setSeed] = useState(369);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  async function run() {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const bytes = Uint8Array.from({length: size}, (_, i) => (i * 17 + (i >> 3) * 11 + 37) & 255);
      const sample = {
        name: "lightbridge-synthetic-sample.bin",
        type: "application/octet-stream",
        size: bytes.length,
        arrayBuffer: async () => bytes.buffer.slice(0)
      };
      const transfer = await createTransfer(sample, {encrypt: false, blockSize: BLOCK_SIZE});
      const next = await runOpticalBatch({
        transfer, ReceiverClass: Receiver, finalize: finalizeTransfer,
        config: {trials, seed, dropStartPct, duplicatePct, burstLength, reorderWindow}
      });
      setReport({...next, sampleBytes: size, disclaimer: "No optical hardware involved. This is not evidence of physical frame loss or device throughput."});
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDropStartPct(15);
    setDuplicatePct(5);
    setBurstLength(2);
    setReorderWindow(3);
    setTrials(10);
    setSeed(369);
    setSize(2048);
    setReport(null);
    setError("");
  }

  return <section className="panel standalone optical-lab">
    <div className="section-heading">
      <div className="eyebrow">SYNTHETIC TESTING / NO CAMERA</div>
      <h2>Optical Channel Lab</h2>
      <p>Test the actual PLB1 receiver against seeded, simulated frame loss, bursts, duplicates and limited reordering. Every result is software-only evidence.</p>
    </div>
    <div className="lab-warning"><AlertTriangle size={18}/><div><strong>Not a physical experiment.</strong> These controls model scheduled frame impairment, not glare, photons, distance, camera frame rate, security, or measured optical throughput. PR #6 handles the separate real-device telemetry pathway.</div></div>
    <div className="lab-columns">
      <div className="lab-controls">
        <label className="lab-field">Sample payload <select value={size} onChange={e=>setSize(Number(e.target.value))}>{SAMPLE_SIZES.map(n=><option key={n} value={n}>{n.toLocaleString()} bytes</option>)}</select></label>
        <label className="lab-field">Drop-burst start probability <strong>{dropStartPct}%</strong><input type="range" min="0" max="100" step="5" value={dropStartPct} onChange={e=>setDropStartPct(Number(e.target.value))}/><small>A triggered loss also drops the next {burstLength-1} scheduled frame(s); actual loss can exceed this percentage.</small></label>
        <label className="lab-field">Repeated observation probability <strong>{duplicatePct}%</strong><input type="range" min="0" max="100" step="5" value={duplicatePct} onChange={e=>setDuplicatePct(Number(e.target.value))}/></label>
        <div className="lab-small-controls">
          <label className="lab-field">Burst length <select value={burstLength} onChange={e=>setBurstLength(Number(e.target.value))}>{[1,2,3,4,6,8].map(n=><option key={n} value={n}>{n} frame(s)</option>)}</select></label>
          <label className="lab-field">Reorder window <select value={reorderWindow} onChange={e=>setReorderWindow(Number(e.target.value))}>{[1,2,3,4,6,8].map(n=><option key={n} value={n}>{n} observation(s)</option>)}</select></label>
          <label className="lab-field">Trials <select value={trials} onChange={e=>setTrials(Number(e.target.value))}>{[1,10,20,30].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
          <label className="lab-field">Seed <input type="number" min="0" max="4294967295" value={seed} onChange={e=>setSeed(Number(e.target.value))}/></label>
        </div>
        <div className="button-pair">
          <button className="primary" disabled={busy} onClick={run}><FlaskConical size={17}/>{busy?"Running tests…":"Run simulated trials"}</button>
          <button className="secondary" disabled={busy} onClick={reset}><RotateCcw size={16}/> Reset</button>
        </div>
        {error && <p className="lab-error" role="alert">{error}</p>}
      </div>
      <div className="lab-results" aria-live="polite">
        {!report ? <div className="lab-empty"><Activity size={42}/><strong>Awaiting first simulation</strong><span>The protocol is exercised entirely within this browser, with generated sample bytes. No camera or network request is used for data transfer.</span></div> :
          <>
            <div className="lab-stat">
              <span>SHA-256 verified reconstructions</span>
              <strong>{report.verifiedCount} / {report.config.trials}</strong>
              <div className="lab-meter"><div style={{width:(100*report.verifiedCount/report.config.trials)+"%"}}/></div>
              <small>Software trials, not physical link success rate</small>
            </div>
            <div className="lab-stat-grid">
              <div><span>Sample</span><strong>{report.sampleBytes.toLocaleString()} B</strong></div>
              <div><span>PLB1 blocks</span><strong>{report.config.blocks}</strong></div>
              <div><span>Frame opportunities / trial</span><strong>{report.config.frameCount}</strong></div>
              <div><span>Modeled loss, mean</span><strong>{(report.results.reduce((s,r)=>s+r.modeledDropped,0)*100/(report.config.trials*report.config.frameCount)).toFixed(1)}%</strong></div>
            </div>
            <div className="lab-trial-list"><strong>Trial outcomes</strong><div className="lab-trial-grid">
              {report.results.map(r=><div key={r.trial} className={"lab-trial "+(r.verified?"pass":"fail")} title={"Seed "+r.seed+" · scanned "+r.scanned+" observations · modeled dropped "+r.modeledDropped}><span>{r.trial}</span>{r.verified?<ShieldCheck size={15}/>:<AlertTriangle size={15}/>}</div>)}
            </div></div>
            <button className="secondary" onClick={()=>exportReport(report)}><Download size={15}/> Export simulation report</button>
            <p className="footnote">Seeded results are repeatable for the same PLB1 session and inputs. Reports contain no source bytes or passphrases. Failures remain part of the record.</p>
          </>}
      </div>
    </div>
  </section>;
}
