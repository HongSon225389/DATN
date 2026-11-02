# Chuyển hướng theo giờ/ngày — hanoi-turn-time-0.1.0

Giải nén gói vào thư mục gốc dự án. Cần các gói access/chiều/chuyển hướng trước đó. Không sửa turn_rules.py hoặc ghi đè kết quả cũ. Chỉ dùng Python chuẩn 3.10+, không cần pip/tzdata.

## Chạy

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v

py -3 tools/routing-rules/time_turn_rules.py --snapshot data/osm-survey/20261028T094314131389Z --at "2026-10-29T08:00:00+07:00" --output data/routing-turn-time

py -3 tools/routing-rules/time_turn_rules.py --snapshot data/osm-survey/20261028T094314131389Z --at "2026-10-29T12:00:00+07:00" --output data/routing-turn-time
```

Thêm `/data/routing-turn-time/` vào .gitignore. Mỗi lần chạy tạo thư mục riêng. Kết quả: metadata.json, summary.csv, decisions.csv, turn-rules.at-time.json, rules-used.json. Kết quả không thay thế bộ normalized tĩnh và không đưa vào turn_diagnostics.py phiên bản trước.

## Quy tắc

- Bắt buộc ISO 8601 có múi giờ. Chuyển thời điểm về UTC+07:00, áp dụng khu vực Hà Nội hiện đại; không phụ thuộc múi giờ máy và không dùng giờ hiện tại ngầm định.
- Hỗ trợ một cặp `no_left_turn @ (Mo-Fr 07:00-09:00,16:00-19:00)` hoặc các giá trị no_*/only_* đã hỗ trợ ở gói trước. Ngoặc ngoài có thể bỏ nếu không có nội dung phức tạp.
- Ngày: Mo Tu We Th Fr Sa Su, danh sách dấu phẩy và khoảng ngày. Không chỉ định ngày là mọi ngày. Khoảng Fr-Mo đi qua cuối tuần.
- Giờ bắt đầu được tính, giờ kết thúc không tính: [07:00,09:00). Cho phép 24:00 chỉ ở cuối khoảng; 00:00-24:00 là trọn ngày. Hai đầu bằng nhau chưa hỗ trợ.
- Qua đêm: `Fr 22:00-02:00` bao gồm thứ Bảy 01:00 vì bắt đầu từ thứ Sáu; không gồm thứ Sáu 01:00.
- Trong khung giờ: dùng giá trị conditional. Ngoài khung: dùng giá trị tĩnh cùng key nếu có; nếu không có, inactive_at_time. Không suy diễn quyền lưu thông từ trạng thái này.
- Giữ cơ chế ngoại lệ đúng phương tiện. Ngoại lệ sai định dạng không tự sửa. Nhiều tầng conditional/ưu tiên phức tạp giữ unresolved.
- Vẫn kiểm tra topology kể cả ngoài khung giờ. Thiếu thành viên giữ invalid; via-way vẫn unresolved. Các only_* cùng hiệu lực bị xung đột vẫn unresolved.
- Lưu nguyên tags và members gốc cùng effective_value, time_state và evaluated_at. Không chỉnh dữ liệu OSM.

## Cố ý chưa hỗ trợ

PH/SH, ngày tháng/năm, mùa, sunrise/sunset, wet, AND/OR, off, dấu chấm phẩy trong lịch, nhiều cặp conditional, restriction=none và điều kiện viết sai trường. Không đọc một phần rồi bỏ qua phần còn lại. Chưa xử lý via-way, access, chiều, rào chắn, tốc độ hoặc ngập trong mô-đun này.

Đây là một tập con cú pháp, không phải bộ phân tích opening_hours đầy đủ. Dấu chấm phẩy không tự đổi thành dấu phẩy vì trong OSM nó có thể mang ý nghĩa ghi đè lịch.

## Giới hạn khi tích hợp graph

Chưa tạo graph hoặc API tìm đường. Kết quả chỉ đúng tại evaluated_at, không được tái sử dụng cho thời điểm khác. Khi làm router, phải đánh giá lúc dự kiến tới nút rẽ hoặc công bố chế độ đóng băng toàn mạng tại thời điểm truy vấn. Chưa triển khai Dijkstra phụ thuộc thời gian hoặc chính sách chờ; chưa khẳng định điều kiện FIFO. evaluate_transition của gói trước chỉ kiểm tra bộ quy tắc đã đánh giá, không tự cập nhật thời gian.

## Nguồn cú pháp

https://wiki.openstreetmap.org/wiki/Conditional_restrictions

https://wiki.openstreetmap.org/wiki/Key:opening_hours/specification

92 tests gồm 75 test trước và 17 test mới; vượt qua kiểm thử không đồng nghĩa quy định OSM đã được xác minh ngoài thực địa.
