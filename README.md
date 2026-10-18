# Page Tools

[English](#english) · [Tiếng Việt](#tiếng-việt)

---

## English

A Chrome extension (Manifest V3) that lets you grab content from any web page without leaving it: unblock copy, take screenshots with annotations, extract text (OCR), translate and summarize.

### Features

Each feature has its own on/off toggle in the popup.

| Feature | How to use | Shortcut |
|---|---|---|
| **Unblock copy & right-click** | Turn it on: applies automatically to every page (including open tabs) | — |
| **Region screenshot** | Drag to select an area → opens an editor: pen, box, text notes, copy, save PNG, OCR | `Alt+Shift+S` |
| **Extract text from region (OCR)** | Drag over text → the text appears right on the page with Copy / Translate buttons | `Alt+Shift+O` |
| **Full-page screenshot** | Scrolls and stitches the whole page into one image. Press `Esc` or **Cancel** to stop | `Alt+Shift+F` |
| **Translate selection** | Select text → right-click or shortcut → Vietnamese translation pops up | `Alt+Shift+D` |
| **Summarize selection** | Select text → right-click → summary by Claude AI (needs an API key) | set your own |
| **Studocu & Scribd Helper** | Open document on Studocu/Scribd → export native PDF, bypass blur, remove watermark, clear cookies | — |

You can also run every feature from the right-click menu (under **Page Tools**) or with the ▶ button in the popup. Change shortcuts at `chrome://extensions/shortcuts`.

### Install

1. Download this repo (`git clone` or **Code → Download ZIP** and extract it).
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the project folder.
4. Pin the extension to the toolbar.

To use **Summarize**, paste your [Claude API key](https://console.anthropic.com/) into the popup. The key is stored only in your browser (`chrome.storage.local`).

### Limitations

- Translation uses Google's free unofficial endpoint, which may be rate-limited.
- OCR (Tesseract.js) runs fully offline, but downloads the language data (a few MB) from jsDelivr the first time.
- Full-page capture only scrolls the main page. Pages that scroll inside their own container (Gmail, Notion) capture one screen. Sticky headers show only at the top of the image.
- Chrome does not allow extensions on `chrome://` pages or the Chrome Web Store.

### Disclaimer

- This project is for educational and personal use only.
- Please respect the copyright of document authors and the terms of service of Studocu and Scribd.
- The extension may stop working at any time if Studocu or Scribd changes their interface.

### Project structure

```
manifest.json      permissions, shortcuts
features.js        feature list shared by background & popup
background.js      context menu, shortcuts, screenshots, translate / AI calls
content.js         region selector, full-page capture, result bubble
unblock.js         copy / right-click unblocker (injected on every page when enabled)
offscreen.*        hidden page that keeps the Tesseract OCR worker alive
popup.*            toggles + API key
editor.*           screenshot editor
native-print.*     Studocu native print: scroll, measure & layout
scribd-print.js    Scribd document viewer detection & native print
lib/               Tesseract.js 5.1.1 (Apache-2.0)
```

---

## Tiếng Việt

Extension Chrome (Manifest V3) giúp lấy nội dung trên trang web ngay tại chỗ, không cần sang trang khác: bỏ chặn copy, chụp màn hình kèm ghi chú, trích chữ (OCR), dịch, tóm tắt và hỗ trợ tải PDF Studocu & Scribd.

### Chức năng

Mỗi chức năng có công tắc bật/tắt riêng trong popup.

| Chức năng | Cách dùng | Phím tắt |
|---|---|---|
| **Bỏ chặn copy & chuột phải** | Bật lên là tự áp dụng trên mọi trang (cả các tab đang mở) | — |
| **Chụp vùng** | Kéo chọn vùng → mở trang sửa ảnh: bút, khung, ghi chú chữ, copy, tải PNG, trích chữ | `Alt+Shift+S` |
| **Trích chữ vùng chọn (OCR)** | Kéo chọn vùng có chữ → chữ hiện ngay trên trang, có nút Copy / Dịch | `Alt+Shift+O` |
| **Chụp toàn trang** | Tự cuộn và ghép cả trang thành 1 ảnh. Nhấn `Esc` hoặc **Hủy** để dừng | `Alt+Shift+F` |
| **Dịch đoạn bôi đen** | Bôi đen → chuột phải hoặc phím tắt → bản dịch tiếng Việt hiện ngay | `Alt+Shift+D` |
| **Tóm tắt đoạn bôi đen** | Bôi đen → chuột phải → tóm tắt bằng Claude AI (cần API key) | tự đặt |
| **Hỗ trợ Studocu & Scribd** | Mở tài liệu Studocu/Scribd → xuất PDF gốc, bypass mờ, gỡ watermark, xóa cookie | — |

Mọi chức năng cũng chạy được từ menu chuột phải (mục **Page Tools**) hoặc nút ▶ trong popup. Đổi phím tắt tại `chrome://extensions/shortcuts`.

### Cài đặt

1. Tải repo này về (`git clone` hoặc **Code → Download ZIP** rồi giải nén).
2. Mở `chrome://extensions`, bật **Developer mode**.
3. Bấm **Load unpacked**, chọn thư mục dự án.
4. Ghim extension lên thanh công cụ.

Muốn dùng **Tóm tắt**, dán [Claude API key](https://console.anthropic.com/) vào popup. Key chỉ lưu trong trình duyệt của bạn (`chrome.storage.local`).

### Giới hạn

- Dịch dùng endpoint miễn phí không chính thức của Google, có thể bị giới hạn khi dùng nhiều.
- OCR (Tesseract.js) chạy offline, nhưng lần đầu sẽ tải dữ liệu ngôn ngữ (vài MB) từ jsDelivr.
- Chụp toàn trang chỉ cuộn trang chính. Trang cuộn trong khung riêng (Gmail, Notion) chỉ chụp được 1 màn hình. Thanh menu dính chỉ hiện ở đầu ảnh.
- Chrome không cho extension chạy trên trang `chrome://` và Chrome Web Store.

### Lưu ý

- Dự án chỉ phục vụ mục đích học tập và dùng cá nhân.
- Hãy tôn trọng bản quyền của tác giả tài liệu và điều khoản của Studocu, Scribd.
- Extension có thể ngừng hoạt động bất cứ lúc nào khi Studocu, Scribd đổi giao diện.

### Cấu trúc

Xem mục [Project structure](#project-structure) ở trên.

---

## License

[MIT](LICENSE) © 2026 Monomee. Tesseract.js in `lib/` is licensed under Apache-2.0 / Tesseract.js trong `lib/` theo giấy phép Apache-2.0.
