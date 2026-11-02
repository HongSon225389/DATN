# Phần bổ sung quy tắc chuyển hướng

Giải nén vào `E:\hanoi-flood-routing`. File mới ở `tools/routing-rules`.
Giữ nguyên access_rules.py và hai bộ access/direction đã có. Không thay viewer hoặc phiếu khảo sát.

Đọc `tools/routing-rules/BANG_CHUYEN_HUONG.md` để biết phần đã hỗ trợ và phần chưa xử lý.
Đây là chuẩn hóa quan hệ rẽ, chưa chạy định tuyến hoặc dựng graph.

## Kiểm thử

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v
```

Mong đợi 66 kiểm thử: 20 access + 21 direction + 25 turn.
Không cần pip/npm, Python 3.10+, không gọi mạng.

## Chạy trên snapshot thật

```powershell
py -3 tools/routing-rules/turn_rules.py --snapshot data/osm-survey/20261028T094314131389Z --output data/routing-turn
```

Thay tên snapshot nếu bạn dùng bộ khác. Mỗi lần tạo thư mục kết quả mới.
Snapshot gốc: 821 quan hệ toàn bộ phản hồi × 3 phương tiện = 2.463 quyết định.
ready nghĩa là chuẩn hóa được, chưa có lệnh nào được gắn vào graph hoặc ORS.
Điều kiện theo giờ, via-way và dữ liệu bất thường được giữ trong báo cáo; không bỏ qua khi tích hợp sau.

Thêm `/data/routing-turn/` vào .gitignore. Commit các file mới trong tools/routing-rules,
không đưa ZIP hoặc kết quả dung lượng lớn lên Git theo mặc định.

Mã dùng giấy phép MIT đã có trong tools/routing-rules/LICENSE; dữ liệu giữ giấy phép nguồn OSM.
