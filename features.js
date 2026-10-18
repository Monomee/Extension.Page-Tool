// Danh sách chức năng, dùng chung cho background và popup
const PAGE = ['page', 'image', 'link', 'frame', 'video'];
const FEATURES = [
  { id: 'unblock', name: 'Bỏ chặn copy & chuột phải', desc: 'Khi bật: tự áp dụng trên mọi trang, cho bôi đen, copy, chuột phải bình thường.', auto: true, def: false },
  { id: 'region', name: 'Chụp vùng', desc: 'Kéo chọn vùng → mở trang sửa ảnh: vẽ, ghi chú, copy, tải PNG.', menu: 'Chụp vùng màn hình', contexts: PAGE },
  { id: 'ocr', name: 'Trích chữ vùng chọn', desc: 'Kéo chọn vùng có chữ → chữ hiện ngay trên trang để copy hoặc dịch.', menu: 'Trích chữ vùng chọn (OCR)', contexts: PAGE },
  { id: 'fullpage', name: 'Chụp toàn trang', desc: 'Tự cuộn và ghép cả trang thành 1 ảnh. Nhấn Esc hoặc Hủy để dừng.', menu: 'Chụp toàn trang', contexts: PAGE },
  { id: 'translate', name: 'Dịch đoạn bôi đen', desc: 'Bôi đen → chuột phải hoặc phím tắt → bản dịch tiếng Việt hiện ngay.', menu: 'Dịch sang tiếng Việt', contexts: ['selection'] },
  { id: 'summarize', name: 'Tóm tắt đoạn bôi đen', desc: 'Bôi đen → chuột phải → tóm tắt bằng Claude AI (cần API key bên dưới).', menu: 'Tóm tắt bằng AI', contexts: ['selection'] },
  { id: 'doc_helper', name: 'Hỗ trợ Studocu & Scribd', desc: 'Tải PDF tài liệu gốc, bypass làm mờ, gỡ watermark và xóa cookie trên Studocu & Scribd.', auto: true, def: true },
];
const DEFAULTS = Object.fromEntries(FEATURES.map((f) => [f.id, f.def ?? true]));
