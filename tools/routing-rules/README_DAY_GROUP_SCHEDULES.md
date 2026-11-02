# Lịch chia theo nhóm ngày — hanoi-turn-time-0.2.0

Giải nén vào gốc dự án sau các gói trước. Cho phép cập nhật time_turn_rules.py. Gói bổ sung test_day_group_schedules.py, compare_graph_versions.py và test_compare_graph_versions.py. Không sửa raw OSM, bảng access hoặc graph cũ.

## Chạy theo thứ tự

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v

py -3 tools/routing-rules/build_graph.py --snapshot data/osm-survey/20261028T094314131389Z --at "2026-10-29T08:00:00+07:00" --output data/routing-graph
```

Dự kiến 232 tests = 218 trước + 12 lịch + 2 so sánh. Đọc dòng Kết quả để biết thư mục graph mới. Không xóa graph cũ. Graph mới có graph_version khác do hash mã diễn giải lịch thay đổi, dù topology node/cạnh không đổi.

So sánh sau khi lần dựng graph mới đã hoàn tất:

```powershell
$newGraph = Get-ChildItem data/routing-graph -Directory | Sort-Object Name -Descending | Select-Object -First 1

py -3 tools/routing-rules/compare_graph_versions.py --old data/routing-graph/20261029T050622003176Z --new "$($newGraph.FullName)" --output data/routing-graph-comparison
```

Nếu thư mục mới nhất là lần dựng lỗi thì dùng chính xác đường Kết quả của lần thành công; công cụ từ chối thiếu metadata completed. Hai graph cần cùng snapshot/raw/phạm vi/thời điểm để so bộ quy tắc. Hash graph cũng được kiểm tra trước khi so sánh.

Đầu ra graph-comparison.csv ghi số node/cạnh, so sánh toàn bộ dữ liệu node/cạnh, số unlocated và coverage. turn-changes.csv ghi các quyết định relation/hồ sơ thay đổi. Công cụ không sửa graph.

Thêm `/data/routing-graph-comparison/` vào .gitignore; `/data/routing-graph/` đã được thêm từ gói trước.

## Tập cú pháp mới

Ví dụ thực trong relation 16733522:

`no_left_turn @ (Fr 19:00-23:59; Sa-Su 06:00-23:59)`

- Mỗi nhóm sau dấu ; bắt buộc ghi rõ ngày (tên ngày/danh sách/khoảng Mo..Su).
- Các nhóm ngày không được chồng nhau trong phiên bản này.
- Nhiều khung giờ trong một nhóm dùng dấu phẩy như trước.
- Lịch nhiều nhóm chưa hỗ trợ khoảng giờ qua nửa đêm. Lịch một nhóm qua đêm vẫn được hỗ trợ như phiên bản trước.
- Phải phân tích và kiểm tra toàn bộ biểu thức trước khi kết luận; nhóm đầu đang hiệu lực không cho phép bỏ qua nhóm cuối bị lỗi.
- Giờ bắt đầu được tính, giờ kết thúc không tính. 23:59 không được đổi thành 24:00, nên 23:59:00 trở đi không còn trong khoảng kết thúc ở 23:59.
- Múi giờ Việt Nam UTC+07, bắt buộc thời điểm ISO có múi giờ. Không dùng giờ máy ngầm định.

Không thay dấu ; bằng dấu phẩy. Trong opening_hours, dấu ; có thể ghi đè lịch của cùng ngày. Vì vậy `Mo-Sa 07:00-09:00; We 16:00-18:00` giữ unresolved trong tập con này, không tự lấy hợp hai khoảng thứ Tư. Lịch có PH/SH/off/ngày tháng, ngày chồng nhau, qua đêm nhiều nhóm, nhiều cặp restriction@condition hoặc cú pháp khác vẫn chưa hỗ trợ.

Hàm schedule dùng chung với tốc độ có điều kiện nên tốc độ cũng nhận tập lịch này; không thay đổi các chính sách ghi nguồn/giới hạn OSM hoặc cổng. Vẫn chưa diễn giải opening_hours của cổng.

## Kiểm tra kết quả thực

Tại thứ Năm 29/10/2026 08:00 +07, relation 16733522 chuyển từ unresolved sang inactive_at_time cho ô tô/xe máy, vì ngoài lịch. Tại thứ Sáu 30/10/2026 20:00 và thứ Bảy 31/10/2026 06:00, dữ liệu nguồn được chuẩn hóa ready và chuỗi via-way bị cấm khi đi đủ chuỗi. Đi bộ vẫn not_applicable.

Các test kiểm tra từng phút của tuần cho lịch mẫu, đúng giờ đầu/cuối, UTC, ngày thường/cuối tuần, cú pháp đuôi bị lỗi, nhóm chồng nhau, via-way và tốc độ. Đây là kiểm tra thuật toán/dữ liệu OSM, không xác minh biển báo hiện trường.

## Mở graph mới trong viewer

Nếu viewer cũ đang chạy thì Ctrl+C trước. Sau khi đã gán $newGraph như trên:

```powershell
py -3 tools/routing-rules/graph_viewer.py --graph "$($newGraph.FullName)" --snapshot data/osm-survey/20261028T094314131389Z
```

Mở lại http://localhost:8766. Viewer đang chạy giữ graph đã đọc trong bộ nhớ; giải nén mã hoặc dựng graph mới không tự cập nhật phiên server cũ.

Có thể chạy lại inspect_graph.py và pending_graph_diagnostics.py với --graph mới để xuất báo cáo tương ứng. Không đọc báo cáo pending của graph cũ như kết quả graph mới.

## Giới hạn vẫn còn

Quan hệ thiếu vai trò không được tự khôi phục. Unlocated còn 16 ô tô và 4 xe máy tại graph/thời điểm hiện tại; coverage nghiêm ngặt vẫn false. Các node/cạnh bằng nhau không có nghĩa quyền chuyển hướng bằng nhau: bộ quy tắc theo lịch đã thay đổi. Chưa Dijkstra/snap/ngập hoặc xử lý thời điểm tới giao lộ.

Ghi chú tập cú pháp/giới hạn trong README này cập nhật mô tả phiên bản 0.1 trước đó. Các kết quả cũ vẫn là kết quả hợp lệ của bộ diễn giải cũ, không bị ghi đè.

Nguồn cú pháp: https://wiki.openstreetmap.org/wiki/Key:opening_hours/specification và https://wiki.openstreetmap.org/wiki/Conditional_restrictions
