// Trang ẩn giữ Tesseract worker sống để các lần OCR sau nhanh hơn
let worker, workerLang;

chrome.runtime.onMessage.addListener((msg, _, reply) => {
  if (msg.target !== 'offscreen') return;
  recognize(msg).then((v) => reply({ ok: true, v }), (e) => reply({ ok: false, error: e.message }));
  return true;
});

async function recognize({ dataUrl, crop, vw, lang }) {
  if (workerLang !== lang) {
    await worker?.terminate();
    worker = await Tesseract.createWorker(lang, 1, {
      workerPath: chrome.runtime.getURL('lib/worker.min.js'),
      corePath: chrome.runtime.getURL('lib/core'),
      workerBlobURL: false,
    });
    workerLang = lang;
  }
  const img = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const k = crop ? img.width / vw : 1;
  const { x, y, w, h } = crop || { x: 0, y: 0, w: img.width, h: img.height };
  const c = document.createElement('canvas');
  c.width = w * k;
  c.height = h * k;
  c.getContext('2d').drawImage(img, x * k, y * k, w * k, h * k, 0, 0, w * k, h * k);
  return (await worker.recognize(c)).data.text.trim();
}
