# Craf

Bàn vẽ cục bộ cho poster, avatar và story — và một cây cầu sang **Nott**.

Craf chạy bằng Python (không cần cài thêm gì), mở trong một cửa sổ Chrome/Edge
dạng app. Bản vẽ lưu trên máy, tự lưu sau khi ngừng tay, xuất ảnh, và gửi được
sang Nott chỉ bằng một nút.

## Mở

```
Craf.cmd
```

hoặc

```
python craf.py --open
```

Mặc định ở `http://127.0.0.1:7317`.

## Có gì

- **Vẽ**: cọ tự do có lực nhấn (bút cảm ứng) và độ cứng, tẩy, đường, chữ nhật,
  ellipse, đổ màu, hút màu, chữ, chuyển màu tuyến tính / toả tròn.
- **Chọn**: vùng chữ nhật, lasso tự do, chọn theo màu (magic wand) với dung sai;
  thêm/bớt vùng bằng `Shift` / `Alt`, đảo vùng chọn, chọn tất cả. Chọn nội dung
  của lớp đang chọn từ trình đơn Chọn hoặc `Ctrl` + nhấp vào lớp. Đường kiến bò
  chạy quanh vùng chọn.
- **Di chuyển**: kéo cả lớp, hoặc chỉ phần nằm trong vùng chọn — vùng chọn đi
  theo nội dung.
- **Lớp**: thêm, nhân bản, đổi tên, ẩn/hiện, độ mờ, 16 chế độ trộn, kéo để sắp
  xếp, gộp xuống, gộp tất cả, biến đổi lớp (co giãn, xoay, lật quanh tâm bản vẽ).
- **Chỉnh màu**: sáng, tương phản, độ màu, sắc, làm mờ, cấp độ (đen / trắng /
  gamma), trắng đen, nâu cổ, đảo màu — xem trước trực tiếp, áp dụng hoặc huỷ;
  nếu có vùng chọn thì chỉ đổi trong vùng đó.
- **Bộ lọc**: làm mờ, làm nét, nhiễu hạt, pixel hoá, dập nổi, tối góc, hạt phim,
  trắng đen, nâu cổ, đảo màu.
- **Viền vùng chọn**: độ dày tuỳ chọn, viền giữa / trong / ngoài bằng màu trước
  hoặc màu sau.
- **Ảnh**: nhập ảnh từ tệp, kéo–thả hoặc dán từ bộ nhớ tạm; đổi kích thước ảnh,
  đổi kích thước canvas (chọn điểm neo), cắt theo vùng chọn, lật ngang/dọc,
  xoay 90°, đổi màu nền canvas.
- **Bộ nhớ tạm**: sao chép / cắt / dán vùng chọn hoặc cả lớp thành lớp mới.
- **Khổ giấy**: poster 1080×1350, vuông, story 1080×1920, avatar 800×800, hoặc
  tuỳ chỉnh.
- **Zoom / pan**: lăn chuột để zoom tại con trỏ, Space + kéo để di chuyển, `0`
  vừa khung. Kéo từ thước để đặt đường dóng.
- **Lưu tự động** vào `library/` (mỗi bản vẽ là một `.json` + ảnh thu nhỏ `.jpg`).
- **Xuất ảnh**: PNG (giữ nền trong suốt), JPEG hoặc WebP, chọn tỉ lệ 25–200% và
  chất lượng.
- **Ba mẫu** dựng sẵn: Poster mực, Monogram, Dải màu.
- **Màn hình hẹp**: bấm ô màu dưới thanh công cụ để mở bảng Màu / Chỉnh / Lớp
  dạng trượt; thanh trình đơn co lại và mở thành bảng rộng.

## Cầu Nott

Craf đọc thẳng thư mục Nott (mặc định `C:\Users\admin\OneDrive\Documents\AZnote`,
đổi bằng biến môi trường `CRAF_NOTT`):

- **Gửi sang Nott** → ghi ảnh PNG vào `notes/files/` và tạo ghi chú mới trong
  `notes/notebook/`. Ghi chú hiện ngay trong Notebook của Nott; ảnh hiện trong Files.
- **Bảng màu Nott** đọc trực tiếp từ `--accent` trong `ui/renderer/style.css`,
  nên khi Nott đổi theme thì bảng màu trong Craf cũng đổi theo.
- **Ảnh trong Nott** → bấm một ảnh để đưa vào một lớp mới của bản vẽ đang mở.
- **Mở Nott** / **Mở thư mục** từ trong bảng Nott.

## Phím tắt

`V` di chuyển · `M` vùng chọn chữ nhật · `Q` lasso · `W` chọn theo màu ·
`B` cọ · `E` tẩy · `L` đường · `R` chữ nhật · `O` ellipse · `G` đổ màu ·
`U` chuyển màu · `I` hút màu · `T` chữ · `H` kéo bàn · `Space` kéo bàn tạm ·
`[` `]` cỡ cọ · `X` đổi màu trước/sau · `D` màu mặc định · `0` vừa khung ·
`1` 100% · `Ctrl A` chọn tất cả · `Ctrl D` bỏ chọn · `Ctrl Shift I` đảo vùng chọn ·
`Ctrl` + nhấp lớp chọn nội dung lớp · `Ctrl C` / `Ctrl X` / `Ctrl V` sao chép /
cắt / dán · `Delete` xoá nội dung · `Ctrl Z` hoàn tác · `Ctrl Shift Z` làm lại ·
`Ctrl Shift N` thêm lớp · `Ctrl J` nhân bản lớp · `Ctrl T` biến đổi lớp ·
`Ctrl M` gộp xuống · `Ctrl Shift M` gộp tất cả · `Ctrl S` lưu · `Ctrl E` xuất ảnh ·
`?` trợ giúp.

## Cấu trúc

```
craf.py          máy chủ HTTP + cầu Nott
app/             giao diện (HTML/CSS/JS + font)
library/         bản vẽ đã lưu
.cache/          ảnh thu nhỏ của ảnh Nott
```

Không có bước build: sửa section tương ứng trong `app/src/`, rồi tải lại trang.
Điểm vào duy nhất là `app/src/shell/index.js` → `shell/boot.js`.
