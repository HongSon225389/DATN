# Phần bổ sung quy tắc chiều lưu thông

Yêu cầu đã có `tools/routing-rules/access_rules.py` và `access-rules.v1.json` từ bước trước.
Giải nén gói mới vào `E:\hanoi-flood-routing`. Chỉ thêm file, không ghi đè bảng access 0.1,
viewer, phiếu hoặc dữ liệu OSM.

Đọc `tools/routing-rules/BANG_CHIEU_LUU_THONG.md` để hiểu chính sách và giới hạn.

## Kiểm thử

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v
```

Mong đợi 41 kiểm thử: 20 access đã có + 21 kiểm thử chiều mới. Python 3.10+, không cần pip/npm.

## Chạy dữ liệu thật

```powershell
py -3 tools/routing-rules/direction_rules.py --snapshot data/osm-survey/20261028T094314131389Z --output data/routing-direction
```

Thay tên snapshot nếu dùng bộ khác. Không gọi mạng, không sửa DB/web hoặc dữ liệu gốc.
Mỗi lần tạo thư mục kết quả mới, có hash và cấu hình đã dùng. Snapshot gốc: 15.534 way,
93.204 quyết định (3 phương tiện × 2 hướng), chưa phải cạnh graph.

Cần cả osm-raw.json và roads.geojson để kiểm tra thứ tự nút. Không đảo sẵn hình học để mô tả chiều -1.
Không bỏ qua access hoặc các điều kiện chưa xử lý để làm tăng số đường cho phép.

Thêm `/data/routing-direction/` vào .gitignore. Commit các file mới trong tools/routing-rules,
không commit ZIP hoặc dữ liệu kết quả lớn.

Mã bổ sung dùng giấy phép MIT đã có trong tools/routing-rules/LICENSE; dữ liệu giữ giấy phép OSM.
