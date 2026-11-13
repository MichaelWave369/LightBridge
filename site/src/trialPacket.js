// Public deterministic test material. No secrets or user-provided data.
const SIZES=[256,1024];
const pattern="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ\n";
export function trialBytes(size=256){
  if(!SIZES.includes(size))throw new RangeError("Trial packet size must be 256 or 1024 bytes.");
  const prefix="LIGHTBRIDGE PUBLIC TRIAL V1 | "+size+" BYTES | SYNTHETIC DATA ONLY\n";
  return new TextEncoder().encode((prefix+pattern.repeat(Math.ceil(size/pattern.length)+1)).slice(0,size));
}
export function makeTrialFile(size=256){
  return new File([trialBytes(size)],"lightbridge-trial-"+size+"B.txt",{type:"text/plain"});
}
