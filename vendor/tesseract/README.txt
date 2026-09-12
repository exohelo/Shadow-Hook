Shadow Hook — self-hosted docket reader (Tesseract.js 5.1.1 + tesseract.js-core 5.1.1 + @tesseract.js-data/eng 4.0.0_best_int)

Upload this whole folder so these paths exist next to index.html:
  vendor/tesseract/tesseract.min.js
  vendor/tesseract/worker.min.js
  vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js   (phones with WebAssembly SIMD — most Android, iOS 16.4+)
  vendor/tesseract/core/tesseract-core-lstm.wasm.js        (older iPhones without SIMD)
  vendor/tesseract/lang/eng.traineddata.gz                 (the same model the CDN fallback serves today)

index.html (ensureTess) tries these first and only falls back to cdn.jsdelivr.net if tesseract.min.js is missing.
The .wasm.js files carry their wasm inside them — no separate .wasm files are needed.
Same-origin means the service worker caches them after the first scan, so later scans need no signal at all.
