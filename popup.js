const $ = (id) => document.getElementById(id);

const key = $('key');
key.value = (await chrome.storage.local.get('apiKey')).apiKey || '';
key.onchange = () => chrome.storage.local.set({ apiKey: key.value.trim() });
$('shortcuts').onclick = () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });

const shortcuts = Object.fromEntries((await chrome.commands.getAll()).map((c) => [c.name, c.shortcut]));
const on = { ...DEFAULTS, ...(await chrome.storage.sync.get('on')).on };

for (const f of FEATURES) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<div class="info"><b></b><small></small></div>
    ${f.auto ? '' : '<button class="go" title="Chạy ngay">▶</button>'}
    <label class="sw" title="Bật/tắt"><input type="checkbox"><span></span></label>`;
  row.querySelector('b').textContent = f.name;
  row.querySelector('small').textContent = f.desc + ' ';
  if (f.id in shortcuts) {
    const k = document.createElement('kbd');
    k.textContent = shortcuts[f.id] || 'chưa đặt phím';
    row.querySelector('small').append(k);
  }

  const toggle = row.querySelector('input');
  const go = row.querySelector('.go');
  toggle.checked = on[f.id];
  if (go) go.disabled = !on[f.id];
  toggle.onchange = () => {
    on[f.id] = toggle.checked;
    if (go) go.disabled = !toggle.checked;
    chrome.storage.sync.set({ on });
    if (f.id === 'doc_helper') {
      const card = $('docHelperSection');
      if (card) card.style.display = toggle.checked ? 'block' : 'none';
    }
  };
  if (go)
    go.onclick = async () => {
      const r = await chrome.runtime.sendMessage({ type: 'run', action: f.id });
      if (r.ok) window.close();
      else $('err').textContent = 'Không chạy được trên trang này: ' + r.error;
    };
  $('list').append(row);
}

/* ============================================================
   STUDOCU & SCRIBD HELPER CONTROLLER (Logic from v2.1.0)
   ============================================================ */
const printButton = document.getElementById('printBtn');
const restoreButton = document.getElementById('restoreBtn');
const statusBox = document.getElementById('status');
const speedRange = document.getElementById('speedRange');
const speedLabel = document.getElementById('speedLabel');
const clearButton = document.getElementById('clearBtn');
const siteLabel = document.getElementById('siteLabel');
const docHelperSection = document.getElementById('docHelperSection');

if (on.doc_helper === false && docHelperSection) {
  docHelperSection.style.display = 'none';
}

const NS = 'studocu-native-print';

const SPEEDS = {
  1: { label: 'Chậm', scrollStep: 0.125, scribdFactor: 2.5 },
  2: { label: 'Vừa', scrollStep: 0.25, scribdFactor: 1 },
  3: { label: 'Nhanh', scrollStep: 0.5, scribdFactor: 0.65 },
  4: { label: 'Rất nhanh', scrollStep: 1, scribdFactor: 0.35 }
};

let currentTab;
let site;
let scribdFrameId;
let pollTimer;

function setStatus(message, error = false) {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.classList.toggle('error', error);
}

function showStudocu(state) {
  if (!state) return;
  setStatus(state.message || 'Sẵn sàng', state.phase === 'error');
  const busy = state.phase === 'printing' || state.phase === 'preparing';
  printButton.disabled = busy;
  speedRange.disabled = busy;
  restoreButton.hidden = state.phase !== 'printing';
  if (state.phase === 'printing' && state.textPageCount !== undefined) {
    statusBox.textContent += ` • Có chữ: ${state.textPageCount} trang`;
    if (state.imageOnlyCount) statusBox.textContent += ` • Chỉ ảnh: ${state.imageOnlyCount} trang`;
  }
}

/* ==============================
   STUDOCU
============================== */

async function injectStudocu() {
  await chrome.scripting.insertCSS({ target: { tabId: currentTab.id }, files: ['native-print.css'] });
  await chrome.scripting.executeScript({ target: { tabId: currentTab.id }, files: ['native-print.js'] });
}

// Gửi lệnh; nếu content script không còn (trang vừa reload) thì inject lại rồi gửi lại.
async function sendStudocu(command, options) {
  const msg = { namespace: NS, command, ...(options ? { options } : {}) };
  try {
    return await chrome.tabs.sendMessage(currentTab.id, msg);
  } catch {
    await injectStudocu();
    return await chrome.tabs.sendMessage(currentTab.id, msg);
  }
}

async function connectStudocu() {
  clearInterval(pollTimer);
  showStudocu(await sendStudocu('status'));
  pollTimer = setInterval(async () => {
    try {
      showStudocu(await chrome.tabs.sendMessage(currentTab.id, { namespace: NS, command: 'status' }));
    } catch {
      clearInterval(pollTimer);
    }
  }, 500);
}

// Reload tab và chờ tải xong (có timeout phòng trường hợp không nhận được sự kiện).
function reloadAndWait(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let sawLoading = false;
    let timer;
    const done = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = (id, info) => {
      if (id !== tabId) return;
      if (info.status === 'loading') sawLoading = true;
      if (info.status === 'complete' && sawLoading) done();
    };
    timer = setTimeout(done, timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.reload(tabId);
  });
}

/* ==============================
   SCRIBD
============================== */

async function getScribdFrames() {
  let frames = await chrome.webNavigation.getAllFrames({ tabId: currentTab.id }).catch(() => []);
  const found = [];
  for (const frame of frames || []) {
    try {
      const response = await chrome.tabs.sendMessage(currentTab.id, { type: 'SNP_PING' }, { frameId: frame.frameId });
      if (response?.pageCount) found.push({ frameId: frame.frameId, pageCount: response.pageCount });
    } catch {
      /* Không phải frame chứa viewer Scribd. */
    }
  }
  return found.sort((a, b) => b.pageCount - a.pageCount);
}

async function connectScribd() {
  const [viewer] = await getScribdFrames();
  if (!viewer) throw new Error('Chưa tìm thấy trang tài liệu Scribd. Hãy mở tài liệu rồi thử lại.');
  scribdFrameId = viewer.frameId;
  setStatus(`Tìm thấy ${viewer.pageCount} trang trong viewer.`);
  printButton.disabled = false;
  restoreButton.hidden = true;
}

/* ==============================
   KHỞI TẠO
============================== */

async function initialize() {
  [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = currentTab?.url || '';
  if (/^https?:\/\/(?:[^/]+\.)?studocu\.(?:com|vn)(?:\/|$)/i.test(url)) {
    site = 'studocu';
    siteLabel.textContent = 'Studocu → PDF';
    siteLabel.classList.add('active');
    clearButton.disabled = false;
    clearButton.title = 'Xóa cookie Studocu và tải lại trang';
    const saved = localStorage.getItem('studocu-print-speed');
    if (saved && SPEEDS[saved]) speedRange.value = saved;
    speedLabel.textContent = SPEEDS[speedRange.value].label;
    await connectStudocu();
  } else if (/^https:\/\/(?:www\.)?scribd\.com\//i.test(url)) {
    site = 'scribd';
    siteLabel.textContent = 'Scribd → PDF';
    siteLabel.classList.add('active');
    clearButton.disabled = true;
    clearButton.title = 'Nút này chỉ dùng trên Studocu';
    const saved = localStorage.getItem('studocu-print-speed');
    if (saved && SPEEDS[saved]) speedRange.value = saved;
    speedLabel.textContent = SPEEDS[speedRange.value].label;
    await connectScribd();
  } else {
    site = null;
    siteLabel.textContent = 'Không khả dụng';
    siteLabel.classList.remove('active');
    clearButton.disabled = true;
    printButton.disabled = true;
    speedRange.disabled = true;
    setStatus('Mở tài liệu trên Studocu hoặc Scribd trước khi dùng.');
  }
}

speedRange.addEventListener('input', () => {
  speedLabel.textContent = SPEEDS[speedRange.value].label;
  localStorage.setItem('studocu-print-speed', speedRange.value);
});

printButton.addEventListener('click', async () => {
  printButton.disabled = true;
  speedRange.disabled = true;
  try {
    if (site === 'studocu') {
      const selected = SPEEDS[speedRange.value] || SPEEDS[2];
      showStudocu(await sendStudocu('start', { scrollStep: selected.scrollStep }));
    } else if (site === 'scribd') {
      setStatus('Đang nạp các trang và chuẩn bị bố cục…');
      const selected = SPEEDS[speedRange.value] || SPEEDS[2];
      const prepared = await chrome.tabs.sendMessage(
        currentTab.id,
        {
          type: 'SNP_START',
          options: { speedFactor: selected.scribdFactor }
        },
        { frameId: scribdFrameId }
      );
      if (!prepared?.ok) throw new Error(prepared?.error || 'Không chuẩn bị được các trang Scribd.');
      restoreButton.hidden = false;
      setStatus(`Đã chuẩn bị ${prepared.pageCount} trang. Đang mở Print…`);
      await chrome.tabs.sendMessage(currentTab.id, { type: 'SNP_PRINT' }, { frameId: scribdFrameId });
      printButton.disabled = false;
    }
  } catch (error) {
    setStatus(error.message || 'Không thể chuẩn bị trang.', true);
    printButton.disabled = false;
    speedRange.disabled = false;
  } finally {
    if (site === 'scribd') speedRange.disabled = false;
  }
});

restoreButton.addEventListener('click', async () => {
  restoreButton.disabled = true;
  try {
    if (site === 'studocu') {
      showStudocu(await sendStudocu('restore'));
    } else if (site === 'scribd') {
      const frames = await chrome.webNavigation.getAllFrames({ tabId: currentTab.id });
      for (const frame of frames || []) {
        try {
          await chrome.tabs.sendMessage(currentTab.id, { type: 'SNP_RESTORE' }, { frameId: frame.frameId });
        } catch {
          /* Ignore unrelated frames. */
        }
      }
      setStatus('Đã khôi phục trang Scribd.');
    }
  } catch (error) {
    setStatus(error.message || 'Không thể khôi phục trang.', true);
  } finally {
    restoreButton.disabled = false;
  }
});

clearButton.addEventListener('click', async () => {
  clearButton.disabled = true;
  printButton.disabled = true;
  setStatus('Đang quét và xóa cookie…');
  try {
    const result = await chrome.runtime.sendMessage({ type: 'CLEAR_COOKIES_OLD_LOGIC' });
    if (!result?.ok) throw new Error(result?.error || 'Không xóa được cookie.');
    clearInterval(pollTimer);
    setStatus(`Đã xóa ${result.count} cookie. Đang tải lại…`);
    await reloadAndWait(currentTab.id);
    await connectStudocu(); // inject lại script + bật lại poll
    clearButton.disabled = false;
  } catch (error) {
    setStatus(`Lỗi: ${error.message}`, true);
    clearButton.disabled = false;
    printButton.disabled = false;
  }
});

window.addEventListener('pagehide', () => clearInterval(pollTimer));

initialize().catch((error) => {
  printButton.disabled = true;
  speedRange.disabled = true;
  setStatus(error.message || 'Không thể kết nối với trang.', true);
});
