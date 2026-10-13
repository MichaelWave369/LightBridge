# LightBridge React Console

A functional, local-first PLB1 optical sender/receiver experience built with React and Vite. The original archived candidates remain independent; this is a **new React PLB1 implementation** based on their documented wire format and package structure, not an unverified claim that the recovered ZIPs were deployed.

## Test and run

Use Node.js 22+:

~~~bash
cd site
npm install
npm run check
npm run dev
~~~

Visit the Vite local address. GitHub Pages uses the base path `/LightBridge/`.

## What works in this version

- Browser-local file preparation (2 MiB limit) and optional AES-256-GCM encryption via Web Crypto PBKDF2-SHA-256.
- Systematic and deterministic XOR parity PLB1 frames.
- Animated QR rendering from `qrcode`.
- Live camera receiver with `BarcodeDetector` when available and `jsQR` fallback.
- Manual frame input, reconstruction and file download.
- CRC32 frame integrity, protected-payload SHA-256, reconstructed-file SHA-256.
- Locally generated JSON transfer receipts.
- A clearly labeled informational view for experimental STACK-21.

## Critical limitations

- A page successfully deploying is **not evidence of a completed optical hardware test**.
- No sender authentication, signed identity, PorchTalk pairing, mesh connectivity, trust federation, or automatic authorization.
- Encryption keys depend on passphrase quality. Anyone can photograph displayed QR frames; weak/missing encryption can expose content.
- Video processing happens locally in the browser. No web app backend or telemetry.
- Receiver browser support, camera lighting/line-of-sight, frame size, and throughput require testing.
- This React console implements the recovered candidate's PLB1 grammar independently; compatibility with **both exact archival apps** still needs a cross-implementation interop test after the originals are imported.
- Software never executes received files; treat all downloads as untrusted input.
- No remote fonts, tracking scripts or advertisements.

## Deploy

The repository workflow `.github/workflows/react-pages.yml` builds on PR and deploys on `main`. In GitHub repository **Settings → Pages**, select **GitHub Actions** as the source. After this PR merges and Pages is enabled, the expected location is:

https://michaelwave369.github.io/LightBridge/

Do not describe the URL as live before a successful Pages deployment is visible in GitHub Actions.

## Licensing

Original LightBridge project code: root MIT license. Node packages have separate upstream licenses and must retain appropriate attribution. The recovered candidate's historical license notices remain archival artifacts; neither UI presentation nor MIT claims physical security certification.
