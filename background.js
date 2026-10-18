importScripts('features.js');

const getOn = async () => ({ ...DEFAULTS, ...(await chrome.storage.sync.get('on')).on });

// Đồng bộ menu chuột phải + script bỏ chặn với trạng thái toggle (xếp hàng để bật/tắt nhanh không bị trùng menu)
let applying = Promise.resolve();
const apply = () => (applying = applying.then(applyNow, applyNow));
async function applyNow() {
  const on = await getOn();
  await chrome.contextMenus.removeAll();
  for (const f of FEATURES)
    if (f.menu && on[f.id]) chrome.contextMenus.create({ id: f.id, title: f.menu, contexts: f.contexts });
  const registered = (await chrome.scripting.getRegisteredContentScripts({ ids: ['unblock'] })).length > 0;
  if (on.unblock && !registered)
    await chrome.scripting.registerContentScripts([
      { id: 'unblock', matches: ['<all_urls>'], js: ['unblock.js'], runAt: 'document_start', allFrames: true },
    ]);
  if (!on.unblock && registered) await chrome.scripting.unregisterContentScripts({ ids: ['unblock'] });
}

chrome.runtime.onInstalled.addListener(apply);
chrome.storage.onChanged.addListener(async ({ on }) => {
  if (!on) return;
  apply();
  const now = on.newValue?.unblock ?? DEFAULTS.unblock;
  if (now === (on.oldValue?.unblock ?? DEFAULTS.unblock)) return;
  // Áp dụng ngay cho các tab đang mở, không cần tải lại
  for (const t of await chrome.tabs.query({}))
    chrome.scripting
      .executeScript({
        target: { tabId: t.id, allFrames: true },
        ...(now ? { files: ['unblock.js'] } : { func: () => window.__ptUnblock && ((window.__ptUnblock.on = false), window.__ptUnblock.style.remove()) }),
      })
      .catch(() => {});
});

chrome.contextMenus.onClicked.addListener((info, tab) => run(info.menuItemId, tab, info.selectionText));
chrome.commands.onCommand.addListener(async (cmd, tab) => (await getOn())[cmd] && run(cmd, tab));

let pending; // ảnh chụp chờ editor lấy

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.target === 'offscreen') return;
  const handlers = {
    capture: () => chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' }),
    'open-editor': () => {
      pending = msg.payload;
      return chrome.tabs.create({ url: 'editor.html', index: sender.tab.index + 1 }).then(() => true);
    },
    'get-pending': () => pending,
    ocr: () => ocr(msg),
    ai: () => (msg.action === 'translate' ? translate : summarize)(msg.text),
    run: async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      await run(msg.action, tab);
      return true;
    },
  };
  if (!handlers[msg.type]) return;
  Promise.resolve()
    .then(handlers[msg.type])
    .then((v) => reply({ ok: true, v }), (e) => reply({ ok: false, error: e.message }));
  return true;
});

async function run(action, tab, text) {
  if (action === 'studocu-print') {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['native-print.css'] }).catch(() => {});
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['native-print.js'] });
    return chrome.tabs.sendMessage(tab.id, { namespace: 'studocu-native-print', command: 'start', options: { scrollStep: 0.25 } });
  }
  if (action === 'scribd-print') {
    const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id }).catch(() => []);
    let targetFrameId = 0;
    for (const frame of frames) {
      try {
        const res = await chrome.tabs.sendMessage(tab.id, { type: 'SNP_PING' }, { frameId: frame.frameId });
        if (res?.pageCount) { targetFrameId = frame.frameId; break; }
      } catch {}
    }
    const prep = await chrome.tabs.sendMessage(tab.id, { type: 'SNP_START', options: { speedFactor: 1 } }, { frameId: targetFrameId });
    if (prep?.ok) {
      return chrome.tabs.sendMessage(tab.id, { type: 'SNP_PRINT' }, { frameId: targetFrameId });
    }
    return;
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  if (action !== 'translate' && action !== 'summarize') return chrome.tabs.sendMessage(tab.id, { type: action });

  text ||= (await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => getSelection().toString(),
  }))[0].result;
  const bubble = (t) => chrome.tabs.sendMessage(tab.id, { type: 'bubble', text: t });
  if (!text?.trim()) return bubble('Hãy bôi đen đoạn văn trước.');
  bubble('Đang xử lý…');
  try {
    bubble(await (action === 'translate' ? translate : summarize)(text));
  } catch (e) {
    bubble('Lỗi: ' + e.message);
  }
}

async function ocr({ dataUrl, crop, vw, lang = 'vie+eng' }) {
  if (!(await chrome.offscreen.hasDocument()))
    await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['WORKERS'], justification: 'Chạy Tesseract OCR' });
  const r = await chrome.runtime.sendMessage({ target: 'offscreen', dataUrl, crop, vw, lang });
  if (!r.ok) throw new Error(r.error);
  return r.v;
}

// ponytail: endpoint miễn phí không chính thức của Google, có thể bị giới hạn; đổi sang API chính thức nếu cần ổn định
async function translate(text) {
  const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t&q=' + encodeURIComponent(text));
  if (!r.ok) throw new Error('Dịch thất bại (' + r.status + ')');
  return (await r.json())[0].map((x) => x[0]).join('');
}

async function summarize(text) {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) throw new Error('Chưa nhập Claude API key (bấm icon extension để nhập).');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Tóm tắt ngắn gọn bằng tiếng Việt, dạng gạch đầu dòng:\n\n' + text }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || r.status);
  return j.content.map((c) => c.text || '').join('');
}

/*
 * Xóa cookie Studocu: quét toàn bộ cookies có chứa domain 'studocu' để reset giới hạn trang
 */
async function clearCookiesOldLogic() {
  const allCookies = [];
  try {
    const list = await chrome.cookies.getAll({});
    if (list) allCookies.push(...list);
  } catch (e) {
    console.warn('getAll failed', e);
  }

  for (const domain of ['studocu.com', 'studocu.vn']) {
    try {
      const dCookies = await chrome.cookies.getAll({ domain });
      if (dCookies) {
        for (const dc of dCookies) {
          if (!allCookies.some(c => c.name === dc.name && c.domain === dc.domain && c.path === dc.path)) {
            allCookies.push(dc);
          }
        }
      }
    } catch (e) {}
  }

  let count = 0;
  for (const cookie of allCookies) {
    if (cookie.domain && cookie.domain.includes('studocu')) {
      let cleanDomain = cookie.domain.startsWith('.')
        ? cookie.domain.substring(1)
        : cookie.domain;
      const protocol = cookie.secure ? 'https:' : 'http:';
      const url = `${protocol}//${cleanDomain}${cookie.path}`;

      const details = {
        url: url,
        name: cookie.name,
        storeId: cookie.storeId
      };

      if (cookie.partitionKey) {
        details.partitionKey = cookie.partitionKey;
      }

      try {
        await chrome.cookies.remove(details);
        count++;
      } catch (e) {
        console.warn('Không xóa được cookie:', cookie.name, e);
      }
    }
  }

  return count;
}

/*
 * Nhận lệnh từ popup Studocu & Scribd Helper
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'CLEAR_COOKIES_OLD_LOGIC') {
    clearCookiesOldLogic()
      .then(count => sendResponse({ ok: true, count }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true; // Giữ kênh message bất đồng bộ
  }
});
