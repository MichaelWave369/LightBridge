import React, {useCallback,useEffect,useRef,useState} from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import {
  Radio, ShieldCheck, Send, ScanLine, Layers3, BookOpen, Github, ExternalLink,
  UploadCloud, ArrowRight, Play, Pause, RotateCcw, Camera, CameraOff,
  Copy, Download, LockKeyhole, UnlockKeyhole, CheckCircle2, AlertTriangle,
  Monitor, WifiOff, FileCheck2, Activity, Fingerprint, Eye, Shield, FileText
} from "lucide-react";
import {BLOCK_SIZE,MAX_FILE_BYTES,createTransfer,Receiver,finalizeTransfer} from "./protocol.js";

const SOURCE = "https://github.com/MichaelWave369/LightBridge";
const fmt = bytes => bytes < 1024 ? bytes + " B" : bytes < 1048576 ? (bytes / 1024).toFixed(1) + " KiB" : (bytes / 1048576).toFixed(2) + " MiB";

function saveText(filename, value) {
  const blob = new Blob([JSON.stringify(value,null,2)],{type:"application/json"});
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;anchor.download = filename;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(href),1000);
}
function Status({kind="info",children}) {
  return <div className={"status " + kind}><span className="status-dot"/>{children}</div>;
}
function Heading({eyebrow,title,description}) {
  return <div className="section-heading"><div className="eyebrow">{eyebrow}</div><h2>{title}</h2><p>{description}</p></div>;
}
function Bar({value}) {return <div className="progress"><div style={{width:(Math.min(value,1)*100)+"%"}}/></div>;}

export default function App() {
  const [tab,setTab]=useState("send");
  const [file,setFile]=useState(null);
  const [encrypted,setEncrypted]=useState(true);
  const [password,setPassword]=useState("");
  const [rxPassword,setRxPassword]=useState("");
  const [fps,setFps]=useState(2);
  const [tx,setTx]=useState(null);
  const [running,setRunning]=useState(false);
  const [seq,setSeq]=useState(0);
  const [qrSrc,setQrSrc]=useState("");
  const [rawFrame,setRawFrame]=useState("");
  const [txBusy,setTxBusy]=useState(false);
  const [txError,setTxError]=useState("");
  const [rxSnapshot,setRxSnapshot]=useState({session:null,received:0,total:0,accepted:0,redundant:0,complete:false,progress:0});
  const [rxError,setRxError]=useState("");
  const [lastSeen,setLastSeen]=useState("");
  const [manual,setManual]=useState("");
  const [result,setResult]=useState(null);
  const [verifying,setVerifying]=useState(false);
  const [cameraOn,setCameraOn]=useState(false);
  const [camError,setCamError]=useState("");
  const inputRef=useRef(null);
  const videoRef=useRef(null);
  const streamRef=useRef(null);
  const frameIdRef=useRef(null);
  const activeRef=useRef(false);
  const lastScanRef=useRef(0);
  const detectorRef=useRef(null);
  const rxRef=useRef(new Receiver());
  const resultUrlRef=useRef(null);
  const workingRef=useRef(false);

  const stopCamera = useCallback(()=>{
    activeRef.current=false;
    if(frameIdRef.current!==null) cancelAnimationFrame(frameIdRef.current);
    frameIdRef.current=null;
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current=null;
    detectorRef.current=null;
    setCameraOn(false);
  },[]);

  useEffect(()=>()=>{stopCamera(); if(resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);},[stopCamera]);
  useEffect(()=>{if(tab!=="receive")stopCamera();if(tab!=="send")setRunning(false);},[tab,stopCamera]);
  useEffect(()=>{
    if(!tx) {setQrSrc("");setRawFrame("");return;}
    let valid=true;
    async function paint(){
      try{
        const text=tx.makeFrame(seq);
        const url=await QRCode.toDataURL(text,{width:560,margin:3,errorCorrectionLevel:"L",color:{dark:"#071a27",light:"#f4fafc"}});
        if(valid){setRawFrame(text);setQrSrc(url);setTxError("");}
      } catch(e){if(valid){setTxError("QR encoding failed: "+e.message);setRunning(false);}}
    }
    paint();
    return ()=>{valid=false;};
  },[tx,seq]);
  useEffect(()=>{
    if(!running || !tx || tab!=="send") return;
    const id=setInterval(()=>setSeq(n=>n+1),1000/fps);
    return ()=>clearInterval(id);
  },[running,tx,tab,fps]);

  const selectFile = file => {
    if(!file)return;
    setFile(file);setTx(null);setQrSrc("");setRunning(false);setSeq(0);setTxError("");
    if(!file.size || file.size>MAX_FILE_BYTES)setTxError("Select a nonempty file up to 2 MiB.");
  };
  async function prepare(){
    if(!file)return;
    setTxBusy(true);setTxError("");setRunning(false);
    try{
      const prepared=await createTransfer(file,{encrypt:encrypted,passphrase:password,blockSize:BLOCK_SIZE});
      setTx(prepared);setSeq(0);
    }catch(e){setTx(null);setTxError(e.message);}finally{setTxBusy(false);}
  }
  const resetTx=()=>{setTx(null);setRunning(false);setSeq(0);setFile(null);setPassword("");setTxError("");if(inputRef.current)inputRef.current.value="";};

  const ingest=useCallback(value=>{
    const cleaned=String(value||"").trim();
    if(!cleaned)return;
    try{
      const snapshot=rxRef.current.addFrame(cleaned);
      setRxSnapshot({...snapshot});setLastSeen(cleaned.slice(0,70)+"...");
      setRxError("");
      if(snapshot.complete)stopCamera();
    }catch(e){
      // Repeated scans and isolated decoding errors should not erase valid work.
      setRxError(e.message);
    }
  },[stopCamera]);
  const receiveRef=useRef(ingest);
  receiveRef.current=ingest;

  async function scanLoop(){
    if(!activeRef.current)return;
    const video=videoRef.current;
    if(video && video.readyState>=2 && Date.now()-lastScanRef.current>=180 && !workingRef.current){
      lastScanRef.current=Date.now();
      workingRef.current=true;
      try{
        let text="";
        if(detectorRef.current){
          const found=await detectorRef.current.detect(video);
          text=found.find(x=>x.rawValue?.startsWith("PLB1|"))?.rawValue || "";
        }
        if(!text){
          const canvas=document.createElement("canvas");
          const w=video.videoWidth,h=video.videoHeight;
          if(w>0 && h>0){
            const scale=Math.min(1,720/w);
            canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
            const ctx=canvas.getContext("2d",{willReadFrequently:true});
            ctx.drawImage(video,0,0,canvas.width,canvas.height);
            const frame=ctx.getImageData(0,0,canvas.width,canvas.height);
            const decoded=jsQR(frame.data,frame.width,frame.height,{inversionAttempts:"dontInvert"});
            text=decoded?.data || "";
          }
        }
        if(text?.startsWith("PLB1|"))receiveRef.current(text);
      }catch(e){setCamError("Camera decoding: "+e.message);}
      finally{workingRef.current=false;}
    }
    if(activeRef.current) frameIdRef.current=requestAnimationFrame(scanLoop);
  }
  async function startCamera(){
    setCamError("");
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw Error("Camera requires HTTPS and a supported browser.");
      const media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}});
      streamRef.current=media;
      if(!videoRef.current){media.getTracks().forEach(t=>t.stop());throw Error("Receiver video unavailable");}
      videoRef.current.srcObject=media;
      await videoRef.current.play();
      if("BarcodeDetector" in window){
        try{
          const formats=await window.BarcodeDetector.getSupportedFormats();
          if(formats.includes("qr_code"))detectorRef.current=new window.BarcodeDetector({formats:["qr_code"]});
        }catch{detectorRef.current=null;}
      }
      activeRef.current=true;setCameraOn(true);frameIdRef.current=requestAnimationFrame(scanLoop);
    }catch(e){stopCamera();setCamError(e.message);}
  }
  function resetRx(){
    stopCamera();rxRef.current=new Receiver();setRxSnapshot(rxRef.current.snapshot());
    setRxError("");setCamError("");setLastSeen("");setManual("");setRxPassword("");setResult(null);
    if(resultUrlRef.current)URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current=null;
  }
  async function verify(){
    setVerifying(true);setRxError("");
    try{
      const data=await finalizeTransfer(rxRef.current,rxPassword);
      if(resultUrlRef.current)URL.revokeObjectURL(resultUrlRef.current);
      const href=URL.createObjectURL(new Blob([data.bytes],{type:data.mimeType}));
      resultUrlRef.current=href;
      setResult({...data,href});
    }catch(e){setRxError(e.message);}finally{setVerifying(false);}
  }
  const navigation=[
    ["send","Transmit",Send],["receive","Receive",ScanLine],
    ["stack","STACK-21",Layers3],["about","Protocol",BookOpen]
  ];
  return <div className="shell">
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
    <header className="topbar">
      <a className="brand" href={SOURCE} target="_blank" rel="noreferrer" aria-label="LightBridge GitHub">
        <span className="brandmark"><Radio size={23} strokeWidth={1.7}/></span>
        <span className="brandword">PARALLAX <strong>LIGHTBRIDGE</strong><small>OPTICAL COMMUNICATIONS LAB</small></span>
      </a>
      <div className="toplinks"><span className="top-status"><span className="pulse"/> LOCAL FIRST</span><a href={SOURCE} target="_blank" rel="noreferrer" className="github-link"><Github size={17}/> SOURCE <ExternalLink size={12}/></a></div>
    </header>
    <main className="main">
      <section className="hero">
        <div className="hero-copy">
          <div className="kicker"><span className="kicker-mark"/> V0.1 REACT FIELD CONSOLE <span className="kicker-rule"/></div>
          <h1>Move data.<br/><span>Not dependence.</span></h1>
          <p>Send a file from one screen to another camera using animated QR frames. No transfer server, account, Wi-Fi or Bluetooth connection required between the devices.</p>
          <div className="hero-pills"><span><WifiOff size={14}/> Offline-capable transport</span><span><ShieldCheck size={14}/> SHA-256 integrity</span><span><LockKeyhole size={14}/> Optional AES-GCM</span></div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit a"/><div className="art-orbit b"/><div className="art-orbit c"/>
          <div className="art-center"><Radio size={70} strokeWidth={0.95}/></div>
          <span className="art-node n1"/><span className="art-node n2"/><span className="art-node n3"/>
          <div className="art-caption">AIR GAP <span>→</span> VERIFIED BYTES</div>
        </div>
      </section>
      <div className="notice"><AlertTriangle size={17}/><div><strong>Experimental software.</strong> Browser and physical-camera performance are not yet independently validated. Optical frames can be recorded by observers. Receipts are not identity signatures.</div></div>
      <section className="workspace">
        <nav className="tabs" aria-label="Workspace views">
          {navigation.map(([key,label,Icon])=><button key={key} className={tab===key?"tab active":"tab"} onClick={()=>setTab(key)} aria-current={tab===key?"page":undefined}><Icon size={17}/>{label}</button>)}
        </nav>

        {tab==="send" && <div className="panel-grid">
          <section className="panel"><Heading eyebrow="01 / SENDER" title="Prepare optical transfer" description="Your file stays on this device. Only animated optical frames are presented."/>
            <input ref={inputRef} className="sr-only" type="file" id="fileInput" onChange={e=>selectFile(e.target.files?.[0])}/>
            <div className={"dropzone" + (file?" has-file":"")} onClick={()=>inputRef.current?.click()}
              onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();selectFile(e.dataTransfer.files?.[0]);}}>
              <UploadCloud size={28}/><strong>{file?file.name:"Drop a file or browse"}</strong>
              <span>{file?fmt(file.size)+" • Ready to prepare":"Any file type · Maximum 2 MiB"}</span>
            </div>
            <div className="form-row"><span className="form-label"><LockKeyhole size={15}/> Encrypt transfer</span>
              <button className={"toggle"+(encrypted?" on":"")} onClick={()=>{setEncrypted(v=>!v);setTx(null);setRunning(false);}} aria-pressed={encrypted}><span/></button></div>
            {encrypted && <label className="form-block"><span>Shared passphrase <small>Give it to the receiver separately</small></span><input type="password" autoComplete="off" value={password} onChange={e=>{setPassword(e.target.value);setRunning(false);setTx(null);}} placeholder="Enter a strong passphrase"/></label>}
            <label className="form-block"><span>QR animation speed <b>{fps} frames/sec</b></span>
              <input type="range" min="1" max="5" value={fps} onChange={e=>setFps(Number(e.target.value))}/></label>
            {txError && <Status kind="error">{txError}</Status>}
            <div className="button-pair"><button className="primary" disabled={!file||txBusy||file.size>MAX_FILE_BYTES||(encrypted&&!password)} onClick={prepare}>{txBusy?"Preparing…":<><Fingerprint size={17}/> Prepare transfer</>}</button><button className="secondary" onClick={resetTx}><RotateCcw size={16}/> Reset</button></div>
            {tx && <div className="receipt-mini"><div><span>SESSION</span><code>{tx.session}</code></div><div><span>FRAMES PER CYCLE</span><strong>{tx.count*2}</strong></div><div><span>ENCRYPTION</span><strong>{tx.encrypted?"AES-256-GCM":"None"}</strong></div><button onClick={()=>saveText("LightBridge_"+tx.session+"_sender.json",tx.receipt())}><Download size={15}/> Sender receipt</button></div>}
          </section>
          <section className="panel output-panel"><Heading eyebrow="02 / LIGHT OUTPUT" title="Transmitting display" description="Point the receiving device's camera at this panel. Keep the whole QR visible."/>
            <div className="qr-stage">
              {qrSrc?<img className="qr-preview" src={qrSrc} alt={"Optical PLB1 frame "+seq}/>:
                <div className="qr-placeholder"><Radio size={50}/><strong>Waiting for a transfer</strong><span>Prepare a file to generate QR frames.</span></div>}
              <div className="stage-corners c1"/><div className="stage-corners c2"/><div className="stage-corners c3"/><div className="stage-corners c4"/>
            </div>
            <div className="stage-metrics"><div><small>FRAME</small><strong>{tx?(seq+1).toLocaleString():"—"}</strong></div><div><small>BLOCKS</small><strong>{tx?tx.count:"—"}</strong></div><div><small>STATUS</small><strong className={running?"glow-text":""}>{running?"BROADCASTING":tx?"PAUSED":"IDLE"}</strong></div></div>
            <div className="button-pair">
              <button className="primary" disabled={!tx||!qrSrc} onClick={()=>setRunning(v=>!v)}>{running?<><Pause size={17}/> Pause frames</>:<><Play size={17}/> Start frames</>}</button>
              <button className="secondary" disabled={!rawFrame} onClick={()=>navigator.clipboard.writeText(rawFrame).catch(()=>setTxError("Clipboard not available; use HTTPS"))}><Copy size={16}/> Copy frame</button>
            </div>
            <p className="footnote">Sender receipt means the file was prepared, not that another device received it. Use receiver verification for completion.</p>
          </section>
        </div>}

        {tab==="receive" && <div className="panel-grid">
          <section className="panel"><Heading eyebrow="01 / RECEIVER" title="Capture optical frames" description="Scan the transmitting QR display or paste a PLB1 frame manually."/>
            <div className="camera-shell"><video ref={videoRef} muted playsInline autoPlay className={cameraOn?"camera-feed":"camera-feed hidden"}/>
              {!cameraOn && <div className="camera-empty"><ScanLine size={56}/><strong>Camera standby</strong><span>Permission is only requested when you start scanning.</span></div>}
              {cameraOn && <div className="camera-overlay"><div className="scan-window"/><span>ALIGN QR INSIDE FRAME</span></div>}</div>
            <div className="button-pair"><button className="primary" disabled={rxSnapshot.complete} onClick={cameraOn?stopCamera:startCamera}>{cameraOn?<><CameraOff size={17}/> Stop camera</>:<><Camera size={17}/> Start camera</>}</button><button className="secondary" onClick={resetRx}><RotateCcw size={16}/> Reset</button></div>
            {camError && <Status kind="warning">{camError}</Status>}
            <label className="form-block"><span>Manual PLB1 frame input <small>Fallback for unsupported cameras</small></span><textarea value={manual} rows={3} onChange={e=>setManual(e.target.value)} placeholder="PLB1|session|sequence|…"/></label>
            <button className="subtle-btn" disabled={!manual.trim()} onClick={()=>{ingest(manual);setManual("");}}><ArrowRight size={15}/> Add pasted frame</button>
          </section>
          <section className="panel output-panel"><Heading eyebrow="02 / INTEGRITY" title="Reconstruction status" description="Received blocks are checked and reconstructed locally. No server sees the transfer."/>
            <div className="receive-visual"><div className="receive-dial" style={{"--angle":(rxSnapshot.progress*360)+"deg"}}><div><span>{Math.round(rxSnapshot.progress*100)}%</span><small>RECONSTRUCTED</small></div></div>
            <div className="receive-metrics"><div><small>BLOCKS SOLVED</small><b>{rxSnapshot.received} / {rxSnapshot.total||"—"}</b></div><div><small>FRAMES ACCEPTED</small><b>{rxSnapshot.accepted}</b></div><div><small>REDUNDANT</small><b>{rxSnapshot.redundant}</b></div></div></div>
            <Bar value={rxSnapshot.progress}/>
            <div className="rx-session"><span>SESSION ID</span><code>{rxSnapshot.session || "No frames received"}</code></div>
            {lastSeen && <div className="last-frame"><FileText size={14}/> Last optical frame: <code>{lastSeen}</code></div>}
            {rxError && <Status kind="error">{rxError}</Status>}
            {rxSnapshot.complete && !result && <Status kind="success">All blocks reconstructed. Verify cryptographic hashes to recover the file.</Status>}
            {rxSnapshot.complete && !result && <label className="form-block"><span>Sender passphrase <small>Only required for encrypted transfers</small></span><input type="password" autoComplete="off" value={rxPassword} onChange={e=>setRxPassword(e.target.value)} placeholder="Leave blank if unencrypted"/></label>}
            {rxSnapshot.complete && !result && <button className="primary full" disabled={verifying} onClick={verify}><ShieldCheck size={18}/>{verifying?"Verifying…":"Verify & recover file"}</button>}
            {result && <div className="result-card"><Status kind="success">SHA-256 integrity verified</Status><strong>{result.filename}</strong><small>{fmt(result.bytes.length)} · Local file ready</small><div className="button-pair"><a className="primary" href={result.href} download={result.filename}><Download size={17}/> Download file</a><button className="secondary" onClick={()=>saveText("LightBridge_"+rxSnapshot.session+"_receiver.json",result.receipt)}><FileCheck2 size={16}/> Export receipt</button></div></div>}
            <p className="footnote">SHA-256 confirms recovered bytes. It does not authenticate the sender or certify files as safe to open.</p>
          </section>
        </div>}

        {tab==="stack" && <section className="panel standalone">
          <Heading eyebrow="EXPERIMENTAL / STACK-21 V0.2" title="Twenty lanes. One control." description="A separate optical multiplexing experiment recovered alongside LightBridge. This is an architecture visualization, not a running physical receiver."/>
          <div className="stack-layout">
            <div className="stack-visual"><div className="stack-title"><Activity size={16}/> LOGICAL CHANNEL ARRAY <span>SIMULATION CONCEPT</span></div><div className="lane-grid">{Array.from({length:21},(_,i)=><div className={"lane "+(i===20?"control-lane":"")} key={i}><span>{i===20?"CTRL":String(i+1).padStart(2,"0")}</span><i/></div>)}</div><p>20 payload lanes + 1 control lane. Four Walsh-coded subchannels were explored in the recovered v0.2 prototype.</p></div>
            <div className="stack-facts"><div><small>ARCHITECTURE</small><strong>STACK-21</strong></div><div><small>MODE</small><strong>Experimental</strong></div><div><small>PHYSICAL VERIFICATION</small><strong className="warn-text">Not established</strong></div><div><small>REQUIRED NEXT GATE</small><strong>Measured device-to-device tests</strong></div><a className="secondary" href={SOURCE+"/blob/main/docs/PHYSICAL-TEST-GATES.md"} target="_blank" rel="noreferrer">Read physical test gates <ExternalLink size={16}/></a></div>
          </div>
        </section>}

        {tab==="about" && <section className="panel standalone"><Heading eyebrow="PROTOCOL / RELEASE BOUNDARIES" title="Optical transfer without a middleman." description="Designed for independently owned devices. This React implementation targets the recovered PLB1 file and frame structure."/>
          <div className="about-grid">
            <div><Monitor size={24}/><h3>01. Sender</h3><p>Local file becomes a length-prefixed manifest, an optional encrypted payload, and QR frames carrying systematic plus XOR parity blocks.</p></div>
            <div><Eye size={24}/><h3>02. Visible channel</h3><p>Display-to-camera transfer needs line of sight. Anyone who can record optical frames may capture those transmitted bytes.</p></div>
            <div><ShieldCheck size={24}/><h3>03. Receiver</h3><p>Camera and manual input feed local reconstruction. CRC checks frame contents. SHA-256 checks both packaged and original bytes.</p></div>
            <div><Fingerprint size={24}/><h3>04. Identity later</h3><p>PorchTalk pairing, sender signatures, replay defenses, trust negotiation and permissions are future work, not active features here.</p></div>
          </div>
          <div className="about-actions"><a className="primary" href={SOURCE} target="_blank" rel="noreferrer"><Github size={17}/> Browse repository</a><a className="secondary" href={SOURCE+"/blob/main/docs/PORCHTALK-TRANSPORT-CONTRACT.md"} target="_blank" rel="noreferrer"><BookOpen size={17}/> PorchTalk proposal</a></div>
        </section>}
      </section>
      <section className="feature-ribbon"><div><WifiOff size={21}/><span><strong>No transfer server</strong><small>Optical link between devices</small></span></div><div><Shield size={21}/><span><strong>Local integrity checks</strong><small>CRC32 and SHA-256</small></span></div><div><LockKeyhole size={21}/><span><strong>Optional encryption</strong><small>AES-GCM with shared passphrase</small></span></div></section>
      <footer><span>PARALLAX LIGHTBRIDGE <span className="footer-dot">◆</span> HUMAN-GOVERNED RESEARCH CANDIDATE</span><span>LEDGER ABOVE EGO · <a href={SOURCE} target="_blank" rel="noreferrer">MIT SOURCE <ExternalLink size={11}/></a></span></footer>
    </main>
  </div>;
}
