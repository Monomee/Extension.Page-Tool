const $ = (id) => document.getElementById(id);
const canvas = $('c'), ctx = canvas.getContext('2d');
const status = (t) => ($('status').textContent = t);
const call = async (msg) => {
  const r = await chrome.runtime.sendMessage(msg);
  if (!r.ok) throw new Error(r.error);
  return r.v;
};
const loadImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });

let base; // ảnh gốc chưa vẽ, dùng cho OCR
const history = [];

(async () => {
  const p = await call({ type: 'get-pending' });
  if (!p) return status('Không có ảnh chụp.');
  const imgs = await Promise.all(p.shots.map((s) => loadImg(s.dataUrl)));
  const k = imgs[0].width / p.vw; // tỉ lệ pixel ảnh / pixel CSS
  if (p.crop) {
    const { x, y, w, h } = p.crop;
    canvas.width = w * k;
    canvas.height = h * k;
    ctx.drawImage(imgs[0], x * k, y * k, w * k, h * k, 0, 0, w * k, h * k);
  } else {
    canvas.width = imgs[0].width;
    canvas.height = (p.shots.at(-1).y + imgs[0].height / k) * k;
    p.shots.forEach((s, i) => ctx.drawImage(imgs[i], 0, s.y * k));
  }
  canvas.style.width = canvas.width / k + 'px'; // hiển thị đúng kích thước thật, không phóng theo DPI màn hình
  base = canvas.toDataURL();
})();

// --- Vẽ ghi chú ---
let tool = 'pen', start, snap;
for (const b of document.querySelectorAll('[data-tool]')) {
  b.onclick = () => {
    tool = b.dataset.tool;
    document.querySelectorAll('[data-tool]').forEach((x) => x.classList.toggle('on', x === b));
  };
}
const pos = (e) => ({ x: (e.offsetX * canvas.width) / canvas.clientWidth, y: (e.offsetY * canvas.height) / canvas.clientHeight });
const lineW = () => Math.max(2, canvas.width / 400);

canvas.onmousedown = (e) => {
  start = pos(e);
  snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
  history.push(snap);
  ctx.strokeStyle = ctx.fillStyle = $('color').value;
  ctx.lineWidth = lineW();
  ctx.lineCap = 'round';
  if (tool === 'text') {
    const t = prompt('Nội dung ghi chú:');
    if (t) {
      ctx.font = `bold ${lineW() * 8}px system-ui`;
      ctx.fillText(t, start.x, start.y);
    } else history.pop();
    start = null;
  } else if (tool === 'pen') {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
  }
};
canvas.onmousemove = (e) => {
  if (!start) return;
  const p = pos(e);
  if (tool === 'pen') {
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  } else {
    ctx.putImageData(snap, 0, 0);
    ctx.strokeRect(start.x, start.y, p.x - start.x, p.y - start.y);
  }
};
onmouseup = () => (start = null);
$('undo').onclick = () => history.length && ctx.putImageData(history.pop(), 0, 0);

// --- Xuất ảnh ---
const blob = () => new Promise((ok) => canvas.toBlob(ok, 'image/png'));
$('copy').onclick = async () => {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': await blob() })]);
  status('Đã copy ảnh.');
};
$('save').onclick = async () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await blob());
  a.download = `screenshot-${Date.now()}.png`;
  a.click();
};

// --- OCR ---
async function ocr() {
  if (!base) return;
  status('Đang trích chữ… (lần đầu tải dữ liệu ngôn ngữ hơi lâu)');
  const text = await call({ type: 'ocr', dataUrl: base, lang: $('lang').value });
  $('side').style.display = 'block';
  $('text').value = text;
  status('Xong.');
}
$('ocr').onclick = () => ocr().catch((e) => status('Lỗi OCR: ' + e.message));

$('copyText').onclick = () => navigator.clipboard.writeText($('text').value);
for (const [id, action] of [['tr', 'translate'], ['sum', 'summarize']]) {
  $(id).onclick = async () => {
    status('Đang xử lý…');
    try {
      $('text').value = await call({ type: 'ai', action, text: $('text').value });
      status('Xong.');
    } catch (e) {
      status('Lỗi: ' + e.message);
    }
  };
}
