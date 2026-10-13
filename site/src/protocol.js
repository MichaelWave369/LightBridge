// Original, independent PLB1-compatible React transport implementation.
// The recovered historic archives remain unmodified and are not bundled here.
// No security, identity, or physical-device certification is implied.
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const PROTOCOL = "PLB1";
export const BLOCK_SIZE = 256;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const MAX_CONTAINER = 16 * 1024 * 1024;
const CRC = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let j = 0; j < 8; j++) c = (c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1) >>> 0;
  return c;
});

export function base64url(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export function fromBase64url(s) {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw Error("Invalid base64url payload");
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}
export function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}
function sha256(bytes) {
  return crypto.subtle.digest("SHA-256", bytes).then(b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""));
}
function random(length) { return crypto.getRandomValues(new Uint8Array(length)); }
function join(...parts) {
  const data = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) { data.set(p, at); at += p.length; }
  return data;
}
function withMetadata(info, bytes) {
  const header = textEncoder.encode(JSON.stringify(info));
  const size = new Uint8Array(4);
  new DataView(size.buffer).setUint32(0, header.length, false);
  return join(size, header, bytes);
}
function parseMetadata(bytes) {
  if (bytes.length < 6) throw Error("Incomplete metadata header");
  const n = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, false);
  if (n < 2 || n > bytes.length - 4 || n > 65536) throw Error("Invalid metadata length");
  return {meta: JSON.parse(textDecoder.decode(bytes.subarray(4, n + 4))), data: bytes.slice(n + 4)};
}
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
function xorshift(seed) {
  let s = seed || 0x6d2b79f5;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}
export function indicesFor(session, sequence, count) {
  const pos = sequence % (2 * count);
  if (pos < count) return [pos];
  if (count === 1) return [0];
  const rand = xorshift(fnv1a(session + ":" + sequence + ":" + count));
  const r = rand();
  let degree = r < 0.44 ? 2 : r < 0.74 ? 3 : r < 0.91 ? 4 : r < 0.98 ? 5 : 6;
  degree = Math.min(degree, count);
  const out = new Set();
  while (out.size < degree) out.add(Math.floor(rand() * count));
  return [...out].sort((a, b) => a - b);
}
function xor(dst, src) { for (let i = 0; i < dst.length; i++) dst[i] ^= src[i]; }
function isZero(data) { return data.every(v => v === 0); }
export function encodeFrame({session, sequence, count, size, length, payload}) {
  return [PROTOCOL, session, sequence.toString(36), count.toString(36), size.toString(36), length.toString(36), crc32(payload), base64url(payload)].join("|");
}
export function decodeFrame(text) {
  const parts = text.trim().split("|");
  if (parts.length !== 8 || parts[0] !== PROTOCOL) throw Error("Not a PLB1 frame");
  const [,session,a,b,c,d,checksum,data] = parts;
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(session)) throw Error("Invalid transfer session");
  if (![a,b,c,d].every(x => /^[0-9a-z]+$/i.test(x))) throw Error("Invalid frame number");
  const [sequence,count,size,length] = [a,b,c,d].map(x => parseInt(x, 36));
  if (![sequence,count,size,length].every(Number.isSafeInteger) ||
    sequence < 0 || count < 1 || count > 100000 || size < 64 || size > 2048 ||
    length < 1 || length > MAX_CONTAINER || count * size < length) throw Error("Frame outside limits");
  const payload = fromBase64url(data);
  if (payload.length !== size || crc32(payload) !== checksum.toLowerCase()) throw Error("Frame CRC mismatch");
  return {session, sequence, count, size, length, payload};
}
async function aesKey(passphrase, salt, iterations, use) {
  if (!passphrase) throw Error("Passphrase required");
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations,hash:"SHA-256"},key,{name:"AES-GCM",length:256},false,[use]);
}
export async function createTransfer(file, {encrypt = true, passphrase = "", blockSize = BLOCK_SIZE} = {}) {
  if (!file || !file.size || file.size > MAX_FILE_BYTES) throw Error("Select a nonempty file up to 2 MiB");
  if (encrypt && !passphrase) throw Error("Enter a passphrase to enable encryption");
  if (!Number.isInteger(blockSize) || blockSize < 64 || blockSize > 2048) throw Error("Invalid block size");
  const original = new Uint8Array(await file.arrayBuffer());
  const session = base64url(random(9));
  const createdAt = new Date().toISOString();
  const inner = withMetadata({
    schema:"parallax-lightbridge-inner-v1", filename:file.name, mimeType:file.type || "application/octet-stream",
    originalSize:original.length, originalSha256:await sha256(original), createdAt
  }, original);
  let protectedData = inner;
  let encryption = {enabled:false};
  if (encrypt) {
    const salt = random(16), iv = random(12), iterations = 150000;
    const key = await aesKey(passphrase,salt,iterations,"encrypt");
    protectedData = new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,inner));
    encryption = {enabled:true,algorithm:"AES-GCM-256",kdf:"PBKDF2-SHA-256",iterations,salt:base64url(salt),iv:base64url(iv)};
  }
  const outer = withMetadata({
    schema:"parallax-lightbridge-outer-v1",protocol:PROTOCOL,appVersion:"0.1.0",
    sessionId:session,createdAt,encryption,payloadSize:protectedData.length,
    payloadSha256:await sha256(protectedData),blockSize
  }, protectedData);
  const count = Math.ceil(outer.length / blockSize);
  const blocks = Array.from({length:count},(_,i)=>{
    const b = new Uint8Array(blockSize);
    b.set(outer.subarray(i*blockSize,(i+1)*blockSize));
    return b;
  });
  return {
    session, count, originalSha256: await sha256(original), createdAt, filename:file.name, encrypted:encrypt,
    makeFrame(sequence) {
      const payload = new Uint8Array(blockSize);
      for(const index of indicesFor(session,sequence,count)) xor(payload,blocks[index]);
      return encodeFrame({session,sequence,count,size:blockSize,length:outer.length,payload});
    },
    receipt() {
      return {receiptType:"Parallax LightBridge Sender Receipt", protocol:PROTOCOL,sessionId:session,
        createdAt,sourceFilename:file.name,originalSize:original.length,originalSha256:this.originalSha256,
        encryptionEnabled:encrypt,blockSize,blockCount:count,
        status:"Prepared locally; optical reception not independently confirmed"};
    }
  };
}
export class Receiver {
  constructor() {
    this.session = null; this.count = 0; this.size = 0; this.length = 0;
    this.known = new Map(); this.equations = []; this.sequences = new Set();
    this.accepted = 0; this.redundant = 0;
  }
  get progress() { return this.count ? this.known.size / this.count : 0; }
  get complete() { return this.count > 0 && this.known.size === this.count; }
  addFrame(text) {
    const f = decodeFrame(text);
    if (!this.session) { this.session=f.session;this.count=f.count;this.size=f.size;this.length=f.length; }
    else if (this.session !== f.session || this.count!==f.count || this.size!==f.size || this.length!==f.length) {
      throw Error("Different transfer session: reset receiver first");
    }
    if(this.sequences.has(f.sequence)){this.redundant++;return this.snapshot();}
    this.sequences.add(f.sequence);
    const remaining = new Set(indicesFor(f.session,f.sequence,f.count));
    const data = f.payload.slice();
    for(const i of remaining) if(this.known.has(i)){xor(data,this.known.get(i));remaining.delete(i);}
    if(!remaining.size) {
      if(!isZero(data)) throw Error("Inconsistent frame equation");
      this.redundant++;
    } else if(remaining.size===1) this.solve([...remaining][0],data);
    else {
      this.equations.push({remaining,data});
      if(this.equations.length > Math.max(128,this.count*4)) this.equations.shift();
    }
    this.accepted++;
    return this.snapshot();
  }
  solve(index,data) {
    const queue = [[index,data]];
    while(queue.length) {
      const [i,b] = queue.shift();
      if(this.known.has(i)) {
        const other=b.slice();xor(other,this.known.get(i));
        if(!isZero(other)) throw Error("Conflicting frame payload");
        continue;
      }
      this.known.set(i,b.slice());
      for(let j=this.equations.length-1;j>=0;j--) {
        const e=this.equations[j];
        if(!e.remaining.has(i)) continue;
        xor(e.data,b);e.remaining.delete(i);
        if(!e.remaining.size) {
          this.equations.splice(j,1);
          if(!isZero(e.data)) throw Error("Inconsistent parity");
        } else if(e.remaining.size===1) {
          this.equations.splice(j,1);
          queue.push([[...e.remaining][0],e.data]);
        }
      }
    }
  }
  snapshot() {return {session:this.session,received:this.known.size,total:this.count,accepted:this.accepted,redundant:this.redundant,complete:this.complete,progress:this.progress};}
  getBytes() {
    if(!this.complete)throw Error("Transfer incomplete");
    const buf=new Uint8Array(this.count*this.size);
    for(let i=0;i<this.count;i++)buf.set(this.known.get(i),i*this.size);
    return buf.slice(0,this.length);
  }
}
export async function finalizeTransfer(receiver,passphrase="") {
  const {meta:outer,data:protectedData}=parseMetadata(receiver.getBytes());
  if(outer.schema!=="parallax-lightbridge-outer-v1" || outer.protocol!==PROTOCOL || outer.sessionId!==receiver.session)throw Error("Unsupported outer package");
  if(protectedData.length!==outer.payloadSize || await sha256(protectedData)!==outer.payloadSha256)throw Error("Protected SHA-256 mismatch");
  let innerBytes=protectedData;
  if(outer.encryption?.enabled){
    if(!passphrase)throw Error("Enter sender passphrase");
    const cfg=outer.encryption;
    if(cfg.algorithm!=="AES-GCM-256" || cfg.kdf!=="PBKDF2-SHA-256" || cfg.iterations<10000 || cfg.iterations>1000000) throw Error("Unsupported encryption parameters");
    try {
      const key=await aesKey(passphrase,fromBase64url(cfg.salt),cfg.iterations,"decrypt");
      innerBytes=new Uint8Array(await crypto.subtle.decrypt({name:"AES-GCM",iv:fromBase64url(cfg.iv)},key,protectedData));
    } catch{throw Error("Decryption failed: wrong passphrase or damaged payload");}
  }
  const {meta:inner,data:fileBytes}=parseMetadata(innerBytes);
  if(inner.schema!=="parallax-lightbridge-inner-v1" || fileBytes.length!==inner.originalSize ||
     fileBytes.length>MAX_FILE_BYTES || await sha256(fileBytes)!==inner.originalSha256)throw Error("Original file SHA-256 mismatch");
  const filename=String(inner.filename || "received-file.bin").replace(/[\\/\x00-\x1F]/g,"_").slice(0,200) || "received-file.bin";
  return {
    bytes:fileBytes,filename,mimeType:inner.mimeType || "application/octet-stream",
    receipt:{receiptType:"Parallax LightBridge Receiver Receipt",protocol:PROTOCOL,sessionId:receiver.session,
      completedAt:new Date().toISOString(),filename,originalSize:fileBytes.length,
      originalSha256:inner.originalSha256,protectedPayloadSha256:outer.payloadSha256,
      encryptionEnabled:Boolean(outer.encryption?.enabled),
      integrityStatus:"PASS - protected payload and reconstructed file hashes matched",
      claimBoundary:"Local software receipt; no sender signature or security certification"}
  };
}
