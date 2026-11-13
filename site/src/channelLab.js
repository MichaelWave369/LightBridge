// Synthetic channel research only. No camera, light or device telemetry.
const MAX_FRAMES = 4096;
const MAX_TRIALS = 30;

function probability(value, name) {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError(name + " must be 0..100");
}
function integer(value, lo, hi, name) {
  if (!Number.isInteger(value) || value < lo || value > hi) throw new RangeError(name + " must be " + lo + ".." + hi);
}
function random32(seed) {
  let state = (seed >>> 0) || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

/**
 * Model a finite, precomputed sequence of PLB1 frame opportunities.
 * dropStartPct is a per-frame probability of beginning a loss burst; the
 * actual lost fraction may be higher. Duplicates model repeated observations.
 * Reordering is confined to small windows of surviving observations.
 */
export function opticalChannelPlan({
  frameCount, dropStartPct = 15, duplicatePct = 5, burstLength = 2,
  reorderWindow = 3, seed = 369
}) {
  integer(frameCount, 1, MAX_FRAMES, "frameCount");
  integer(burstLength, 1, 12, "burstLength");
  integer(reorderWindow, 1, 12, "reorderWindow");
  integer(seed, 0, 4294967295, "seed");
  probability(dropStartPct, "dropStartPct");
  probability(duplicatePct, "duplicatePct");

  const next = random32(seed);
  const survived = [];
  let burstRemaining = 0;
  let dropped = 0;
  let duplicates = 0;
  for (let sequence = 0; sequence < frameCount; sequence++) {
    if (burstRemaining > 0) {
      burstRemaining--;
      dropped++;
      continue;
    }
    if (next() * 100 < dropStartPct) {
      dropped++;
      burstRemaining = burstLength - 1;
      continue;
    }
    survived.push(sequence);
    if (next() * 100 < duplicatePct) {
      survived.push(sequence);
      duplicates++;
    }
  }
  const observedSequences = survived.slice();
  // Window-limited arrival disorder, rather than arbitrary global shuffling.
  for (let start = 0; start < observedSequences.length; start += reorderWindow) {
    const end = Math.min(start + reorderWindow, observedSequences.length);
    for (let i = end - 1; i > start; i--) {
      const j = start + Math.floor(next() * (i - start + 1));
      [observedSequences[i], observedSequences[j]] = [observedSequences[j], observedSequences[i]];
    }
  }
  const reorderedPositions = observedSequences.reduce((n, s, i) => n + (s !== survived[i] ? 1 : 0), 0);
  return {
    frameCount, dropped, duplicates, reorderedPositions,
    observedSequences,
    actualDropPct: (100 * dropped) / frameCount
  };
}

/**
 * Run independent synthetic receive attempts using an actual PLB1 transfer,
 * receiver, and finalized integrity checks. Reuses the transfer session across
 * isolated receiver instances; it neither scans a camera nor measures photons.
 */
export async function runOpticalBatch({transfer, ReceiverClass, finalize, config = {}}) {
  if (!transfer || typeof transfer.makeFrame !== "function" || !Number.isInteger(transfer.count) || transfer.count < 1) {
    throw new TypeError("A prepared PLB1 transfer is required");
  }
  if (typeof ReceiverClass !== "function" || typeof finalize !== "function") throw new TypeError("PLB1 receiver and verifier required");
  const {trials = 10, seed = 369, dropStartPct = 15, duplicatePct = 5, burstLength = 2, reorderWindow = 3} = config;
  integer(trials, 1, MAX_TRIALS, "trials");
  integer(seed, 0, 4294967295, "seed");
  const frameCount = Math.min(MAX_FRAMES, transfer.count * 10);
  const results = [];
  for (let trialIndex = 0; trialIndex < trials; trialIndex++) {
    const trialSeed = (seed + Math.imul(trialIndex, 9973)) >>> 0;
    const plan = opticalChannelPlan({frameCount, dropStartPct, duplicatePct, burstLength, reorderWindow, seed:trialSeed});
    const receiver = new ReceiverClass();
    let scanned = 0;
    let error = null;
    for (const sequence of plan.observedSequences) {
      if (receiver.complete) break;
      try {
        receiver.addFrame(transfer.makeFrame(sequence));
        scanned++;
      } catch (err) {
        error = "Frame rejected: " + (err?.message || String(err));
      }
    }
    let verified = false;
    if (receiver.complete) {
      try {
        // PLB1 finalizeTransfer checks protected and original SHA-256 values.
        await finalize(receiver);
        verified = true;
        error = null;
      } catch (err) {
        error = "Integrity verification failed: " + (err?.message || String(err));
      }
    }
    const snapshot = typeof receiver.snapshot === "function" ? receiver.snapshot() : {};
    results.push({
      trial: trialIndex + 1, seed: trialSeed, verified,
      reconstructed: Boolean(receiver.complete),
      scanned, scheduledFrames: frameCount,
      modeledDropped: plan.dropped, modeledDuplicates: plan.duplicates,
      reorderedPositions: plan.reorderedPositions,
      blocksSolved: snapshot.received ?? null,
      blocksTotal: snapshot.total ?? transfer.count,
      error
    });
  }
  return {
    schema: "lightbridge.synthetic-channel-v1",
    evidence: "SOFTWARE_SIMULATION_ONLY",
    protocol: "PLB1",
    config: {trials, seed, dropStartPct, duplicatePct, burstLength, reorderWindow, frameCount, blocks: transfer.count},
    verifiedCount: results.filter(r => r.verified).length,
    results
  };
}
