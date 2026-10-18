// Chạy trên mọi trang khi bật "Bỏ chặn copy"; chạy lại = bật lại
if (!window.__ptUnblock) {
  const u = (window.__ptUnblock = { on: true, style: document.createElement('style') });
  u.style.textContent = '*{user-select:text!important;-webkit-user-select:text!important}';
  // Chặn handler của trang ngay từ window (capture) nhưng giữ hành vi mặc định của trình duyệt
  for (const ev of ['copy', 'cut', 'contextmenu', 'selectstart', 'dragstart'])
    window.addEventListener(ev, (e) => u.on && e.stopImmediatePropagation(), true);
}
window.__ptUnblock.on = true;
document.documentElement.append(window.__ptUnblock.style);
