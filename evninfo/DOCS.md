# EVN INFO

Lấy dữ liệu điện từ CSKH EVN miền Trung (cskh-api.cpc.vn) cho mọi mã khách hàng của một tài khoản CSKH.

## Cấu hình
- `username`, `password`: tài khoản CSKH EVNCPC (đăng nhập cskh.cpc.vn / app CSKH EVNCPC).
- `interval_minutes`: chu kỳ cập nhật (mặc định 180).
- `bill_years`: số năm hóa đơn lấy ở lần chạy đầu (mặc định 3; sau đó chỉ lấy lại 3 tháng gần nhất).
- `import_evnvn`: lần đầu nhập lịch sử từ add-on EVN VN cũ (`/config/evnvn/evndata.db`) nếu có.
- `sensors`: tạo sensor trong HA.

## Dữ liệu
- Sản lượng theo ngày: API chỉ trả ~35 ngày gần nhất → add-on tự lưu lịch sử (SQLite `/data/evninfo.db`, nằm trong bản sao lưu add-on).
- Hóa đơn theo tháng (tra cứu HĐĐT: kWh, tiền trước thuế, VAT, tổng), tiền nợ / tình trạng thanh toán, chỉ số công tơ hiện tại, lịch cắt điện của trạm khách hàng (7 ngày trước → 30 ngày tới).

## Sensor (mỗi mã khách hàng, `sensor.evn_<mã KH>_…`)
`chi_so` (kWh, total_increasing – dùng được cho Energy), `ngay_gan_nhat`, `hom_qua`, `thang_nay`, `ky_nay`, `hoa_don` (VND), `tien_no` (VND), `cat_dien` (thuộc tính `schedule`), `cap_nhat`.
Sensor được đẩy qua API (không phải integration) – sau khi HA khởi động lại sẽ có lại ở lần cập nhật kế tiếp.

## Giao diện
Cài và khởi động add-on là có mục **EVN** trên thanh bên (add-on tự bật "Hiện trên thanh bên" ở lần chạy đầu; tắt đi thì không bật lại). Trang chính: biểu đồ theo tháng, chi tiết kỳ, thống kê, so với năm trước, đổi mã khách hàng. Nút "Trạng thái · cập nhật": lần cập nhật, lỗi, cập nhật ngay, lịch cắt điện.

## Ingress (JSON)
`summary.json`, `accounts.json`, `tien_dien_san_luong_<năm>_<mã KH>.json`, `dien_tieu_thu_<mã KH>.json` (cùng định dạng add-on EVN VN cũ), `POST refresh`.
Chỉ nhận yêu cầu từ Supervisor (ingress).
