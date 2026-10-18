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
  };
  if (go)
    go.onclick = async () => {
      const r = await chrome.runtime.sendMessage({ type: 'run', action: f.id });
      if (r.ok) window.close();
      else $('err').textContent = 'Không chạy được trên trang này: ' + r.error;
    };
  $('list').append(row);
}
