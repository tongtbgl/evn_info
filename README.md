# EVN INFO – Home Assistant add-on

Lấy dữ liệu điện từ cổng CSKH của EVN, lưu lịch sử và tạo sensor trong Home Assistant.
Viết lại bằng Python thuần (không thư viện ngoài) để thay add-on "EVN VN" đã ngừng phát hành.

| Khu vực | Trạng thái |
|---|---|
| EVN miền Trung (EVNCPC – cskh.cpc.vn) | Hoạt động |
| EVN Hà Nội, EVN HCMC, EVN miền Bắc (NPC), EVN miền Nam (SPC) | Chưa hỗ trợ |

## Cài đặt
1. Home Assistant → Cài đặt → Add-on → Cửa hàng add-on → ⋮ → Kho lưu trữ → thêm
   `https://github.com/tongtbgl/evn_info`
2. Cài **EVN INFO**, vào tab Cấu hình, nhập tài khoản / mật khẩu CSKH EVNCPC, rồi Khởi động.
3. Mở mục **EVN** trên thanh bên (add-on tự bật ở lần chạy đầu): biểu đồ theo tháng, chi tiết kỳ, thống kê, so với năm trước. Nút "Trạng thái · cập nhật" để xem lỗi / cập nhật ngay / lịch cắt điện.

## Có gì
- Sản lượng theo ngày (cổng EVN chỉ trả khoảng 35 ngày gần nhất – add-on tự lưu lịch sử lâu dài trong `/data/evninfo.db`, có trong bản sao lưu add-on).
- Hóa đơn theo tháng (kWh, tiền trước thuế, VAT, tổng), tiền nợ / tình trạng thanh toán, chỉ số công tơ, lịch cắt điện của trạm.
- Mọi mã khách hàng của một tài khoản.
- Lần đầu chạy có thể nhập lịch sử từ add-on EVN VN cũ (`/config/evnvn/evndata.db`).

## Sensor (mỗi mã khách hàng: `sensor.evn_<mã KH>_…`)
`chi_so` (kWh, `total_increasing` – dùng được cho bảng Năng lượng), `ngay_gan_nhat`, `hom_qua`, `thang_nay`, `ky_nay`, `hoa_don`, `tien_no`, `cat_dien`, `cap_nhat`.

## JSON qua ingress
`summary.json`, `accounts.json`, `tien_dien_san_luong_<năm>_<mã KH>.json`, `dien_tieu_thu_<mã KH>.json` (cùng định dạng add-on EVN VN cũ), `POST refresh`. Chỉ nhận yêu cầu từ Supervisor.

## Ghi chú
- Cổng CSKH EVNCPC có thể chặn IP ngoài Việt Nam.
- Không phải sản phẩm của EVN. Dùng tài khoản của chính bạn.
- Cách đăng nhập EVNCPC tham khảo integration [nestup_evn](https://github.com/trvqhuy/nestup_evn) (Apache-2.0).

Giấy phép: MIT.
