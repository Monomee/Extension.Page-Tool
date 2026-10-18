if (!window.__pageTools) {
  window.__pageTools = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const call = async (msg) => {
    const r = await chrome.runtime.sendMessage(msg);
    if (!r.ok) throw new Error(r.error);
    return r.v;
  };
  const fail = (e) => bubble('Lỗi: ' + e.message);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'region' || msg.type === 'ocr') region(msg.type);
    else if (msg.type === 'fullpage') fullpage().catch(fail);
    else if (msg.type === 'bubble') bubble(msg.text);
  });

  function region(mode) {
    closeBubble(); // không để khung kết quả cũ lọt vào ảnh
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,.25)';
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;border:2px dashed #fff;background:rgba(255,255,255,.15);pointer-events:none';
    o.append(box);
    document.documentElement.append(o);

    let sx = null, sy, r;
    const close = () => { o.remove(); removeEventListener('keydown', esc, true); };
    const esc = (e) => e.key === 'Escape' && close();
    addEventListener('keydown', esc, true);

    o.onmousedown = (e) => { sx = e.clientX; sy = e.clientY; e.preventDefault(); };
    o.onmousemove = (e) => {
      if (sx === null) return;
      r = { x: Math.min(sx, e.clientX), y: Math.min(sy, e.clientY), w: Math.abs(e.clientX - sx), h: Math.abs(e.clientY - sy) };
      Object.assign(box.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    };
    o.onmouseup = async () => {
      close();
      if (!r || r.w < 5 || r.h < 5) return;
      await frame(); // đợi overlay biến mất khỏi màn hình
      try {
        const dataUrl = await call({ type: 'capture' });
        if (mode === 'region') return call({ type: 'open-editor', payload: { shots: [{ y: 0, dataUrl }], vw: innerWidth, crop: r } });
        bubble('Đang trích chữ… (lần đầu tải dữ liệu ngôn ngữ hơi lâu)', { buttons: [] });
        const text = await call({ type: 'ocr', dataUrl, crop: r, vw: innerWidth });
        if (!text) return bubble('Không tìm thấy chữ trong vùng đã chọn.', { timeout: 2500, buttons: [] });
        bubble(text, {
          buttons: [copyBtn(text), ['Dịch', () => {
            bubble('Đang dịch…', { buttons: [] });
            call({ type: 'ai', action: 'translate', text }).then(bubble, fail);
          }], closeBtn],
        });
      } catch (e) {
        fail(e);
      }
    };
  }

  // ponytail: chỉ cuộn được trang chính, trang cuộn trong khung riêng (Gmail, Notion) sẽ chỉ chụp 1 màn hình
  let busy = false;
  async function fullpage() {
    if (busy) return;
    busy = true;
    let cancel = false;
    const stop = () => (cancel = true);
    const esc = (e) => e.key === 'Escape' && stop();
    addEventListener('keydown', esc, true);

    const startY = scrollY, vh = innerHeight;
    const total = (document.scrollingElement || document.documentElement).scrollHeight;
    const maxH = 32000 / devicePixelRatio; // giới hạn chiều cao canvas của Chrome
    const est = Math.ceil(Math.min(total, maxH) / vh);
    const shots = [];
    let hidden = [];
    try {
      for (let y = 0; !cancel; y += vh) {
        bubble(`Đang chụp ${shots.length + 1}/${est}… (Esc để hủy)`, { buttons: [['Hủy', stop]] });
        scrollTo({ top: y, behavior: 'instant' });
        await sleep(600); // captureVisibleTab bị giới hạn ~2 lần/giây, đồng thời chờ ảnh lazy-load
        if (cancel) break;
        host.style.visibility = 'hidden'; // ẩn khung tiến độ khỏi ảnh
        await frame();
        shots.push({ y: scrollY, dataUrl: await call({ type: 'capture' }) });
        host.style.visibility = '';
        if (shots.length === 1) hidden = hideFixed(); // header/thanh dính chỉ xuất hiện ở ảnh đầu
        if (scrollY + vh >= total || scrollY + 2 * vh > maxH) break;
      }
    } finally {
      hidden.forEach(([e, v]) => (e.style.visibility = v));
      scrollTo({ top: startY, behavior: 'instant' });
      removeEventListener('keydown', esc, true);
      host.style.visibility = '';
      busy = false;
    }
    if (cancel) return bubble('Đã hủy chụp toàn trang.', { timeout: 2000, buttons: [] });
    closeBubble();
    call({ type: 'open-editor', payload: { shots, vw: innerWidth } });
  }

  const hideFixed = () =>
    [...document.querySelectorAll('body *')]
      .filter((e) => /fixed|sticky/.test(getComputedStyle(e).position))
      .map((e) => {
        const v = e.style.visibility;
        e.style.visibility = 'hidden';
        return [e, v];
      });

  // --- Khung kết quả góc phải trên ---
  let host, timer;
  const closeBubble = () => host?.remove();
  const closeBtn = ['Đóng', closeBubble];
  const copyBtn = (text) => ['Copy', (e) => navigator.clipboard.writeText(text).then(() => (e.target.textContent = 'Đã copy'))];

  function bubble(text, { timeout, buttons } = {}) {
    if (!host) {
      host = document.createElement('div');
      host.style.cssText = 'position:fixed;z-index:2147483647;top:16px;right:16px';
      host.attachShadow({ mode: 'open' });
    }
    document.documentElement.append(host);
    host.shadowRoot.innerHTML = `<style>
      .b{font:14px/1.5 system-ui,sans-serif;background:#1f2328;color:#f0f3f6;padding:12px 14px;border-radius:10px;user-select:text;
         max-width:380px;max-height:60vh;overflow:auto;box-shadow:0 8px 24px rgba(0,0,0,.35);white-space:pre-wrap}
      .r{display:flex;gap:6px;justify-content:flex-end}
      .r:not(:empty){margin-top:8px}
      button{font:inherit;font-size:12px;background:#30363d;color:inherit;border:0;border-radius:6px;padding:3px 10px;cursor:pointer}
    </style><div class="b"><div class="t"></div><div class="r"></div></div>`;
    host.shadowRoot.querySelector('.t').textContent = text;
    for (const [label, fn] of buttons ?? [copyBtn(text), closeBtn]) {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = fn;
      host.shadowRoot.querySelector('.r').append(b);
    }
    clearTimeout(timer);
    if (timeout) timer = setTimeout(closeBubble, timeout);
  }
}
