# Chẩn đoán quan hệ chưa định vị trên graph

Gói bổ sung sau Graph Inspection. Giải nén vào gốc dự án; không thay dữ liệu, graph, policy hoặc viewer. Dùng Python chuẩn 3.10+, không pip/npm.

## Chạy

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v

py -3 tools/routing-rules/pending_graph_diagnostics.py --graph data/routing-graph/20261029T050622003176Z --snapshot data/osm-survey/20261028T094314131389Z --output data/routing-pending-diagnostics
```

Dự kiến 218 tests (204 trước + 14 mới). Đọc graph đã có, không cần dựng lại. Thay đường --graph nếu bạn đang dùng lần chạy khác. Graph/snapshot được kiểm tra hash qua Dataset của gói Inspection. Thêm `/data/routing-pending-diagnostics/` vào .gitignore.

Mặc định chỉ phân tích locality=unlocated: 17 quyết định ô tô, 5 xe máy, 0 đi bộ ở snapshot/graph hiện tại. Dùng --include-local nếu muốn thêm cả các pending đã có incoming guard. Tổng quyết định theo hồ sơ khác số relation OSM duy nhất.

## File kết quả

| File | Nội dung |
|---|---|
| REPORT.md | Bảng đọc nhanh: từng relation, lỗi, số cạnh thành viên và cụm WCC |
| relation-diagnostics.csv | Mỗi quyết định hồ sơ/relation một dòng, loại thiếu/cấu trúc, cụm và việc cần rà soát |
| relation-diagnostics.json | Chi tiết tags/members, phần tử thiếu raw, nút chung from/to, ứng viên cạnh tới/rời via |
| member-graph-matches.csv | Từng thành viên còn biết: tồn tại raw, số cạnh/node graph, WCC/SCC khoảng cách và WCC thời gian |
| defect-summary.csv | Số lỗi theo hồ sơ; các loại lỗi có thể chồng nhau |
| metadata.json | Phiên bản graph/snapshot, phạm vi và xác nhận không sửa/không đổi coverage |

## Các phân biệt

- missing_from/to/via: thiếu vai trò trong quan hệ, không đồng nghĩa quá trình tải bị mất dữ liệu. missing_raw_element là vai trò có tham chiếu nhưng phần tử không có trong raw.
- multiple_from/to, multiple_or_mixed_via_nodes, wrong_from_to_type, unsupported_via_type, unknown_member_role: mô tả cấu trúc, không tự lấy thành viên đầu hoặc bỏ phần dư.
- from/to_not_connected_to_via_node: way đã biết không chứa via-node được ghi; không nối bằng tọa độ gần nhau.
- unresolved_time_condition + via_way_without_incoming_guard: có thể đủ thành viên nhưng chưa đánh giá lịch nên chưa chuẩn hóa chuỗi; không được gọi tất cả unlocated là thiếu dữ liệu nguồn.
- known_member_graph_edges/nodes và các cụm: chỉ đối chiếu phần tử có ID đã biết với cạnh/node graph thực sự được giữ. Không phải toàn bộ khu vực mà restriction tác động.

ID WCC/SCC theo từng hồ sơ và trọng số, xếp hạng như công cụ Inspection. Không so ID cụm 1 ô tô với cụm 1 xe máy như một phạm vi giống nhau. SCC không thay kiểm tra lịch sử via-way.

## Gợi ý không phải sửa tự động

Nếu thiếu via nhưng from/to chung một node, xuất node chung để xem. Không tự chọn node đó vì chưa loại trừ nguồn sai hoặc via-way bị thiếu. Nếu có via-node nhưng thiếu from/to, xuất các cạnh đi tới/rời node; các cạnh này chỉ là ứng viên, có thể khác quyền/chiều/terminal port. Không tự lấy mọi cạnh làm thành viên thay thế.

Quan hệ không có cạnh thành viên trên graph vẫn có thể ảnh hưởng chưa rõ. Không dùng no-match, bbox nằm ngoài vùng hoặc chỉ có cụm nhỏ để mở coverage. Công cụ không thực hiện phân tích không gian đầy đủ hay chứng minh ảnh hưởng nằm ngoài một tuyến.

## Hành động tiếp theo

Đọc REPORT.md và defect-summary.csv trước, chỉ chọn mẫu cần kiểm tra thay vì sửa tay toàn bộ. Quan hệ đủ cấu trúc nhưng lịch chưa hỗ trợ có thể xử lý bằng mở rộng bộ diễn giải được kiểm thử. Quan hệ thiếu vai trò cần nguồn/phiên bản đối chiếu trước khi đề xuất chỉnh sửa hoặc chính sách khoanh vùng thận trọng. Mọi sửa/ngoại lệ sau này phải là overlay có nguồn, phiên bản và kiểm thử; không sửa raw hoặc tự xóa restriction.

Giai đoạn này scope_proven=false, repair_applied=false và coverage_changed=false cho mọi mục. Chưa có Dijkstra/snap, chưa bỏ khóa nghiêm ngặt ô tô/xe máy. Viewer 8766 hiện tại tiếp tục dùng như cũ; gói này thêm báo cáo, không thay giao diện.
