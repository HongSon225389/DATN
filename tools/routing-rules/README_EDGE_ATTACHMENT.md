# Nối điểm vào cạnh đường — 29/10/2026

Giải nén vào gốc E:\hanoi-flood-routing và ghi đè. Yêu cầu bộ Experimental Dijkstra và bản sửa tải trọng đã cài trước đó. Không cần dựng lại graph: bản này chỉ thay router/API/viewer, tạo các cạnh tạm trong bộ nhớ cho từng yêu cầu, không sửa graph/OSM lưu trên đĩa.

Thay đổi:
- API /api/route và CLI experimental_router.py mặc định chiếu tọa độ lên đoạn cạnh đủ điều kiện gần nhất trong 100m. Không còn dùng node gần nhất làm mặc định giao diện.
- Nhóm hai chiều của cùng way/segment; cạnh tạm chỉ theo các chiều thật sự có trong graph. Giữ raw segment identity khi kiểm tra cấm rẽ và lịch sử via-way. Không nối xuyên terminal ports tại barrier.
- Chi phí cạnh đầu/cuối tính theo phần đoạn thực sự sử dụng; GeoJSON bắt đầu/kết thúc tại điểm chiếu. Chưa cộng đoạn từ vị trí bấm đến đường vì chưa xác minh lối tiếp cận.
- Không tự chọn cạnh ở cụm lớn nhất hay cạnh có tuyến để che lỗi nối điểm. Khi đoạn gần nhất thật sự không kết nối, vẫn trả no_route.
- Kết quả trả start_candidates/end_candidates, snapped_start/snapped_end gồm tên đường, highway, way_id, edge_id, vị trí chiếu, độ lệch. Giao diện có hai danh sách đường thay thế gần điểm; sau khi chọn lại, bấm Tính tuyến. Query start_edge/end_edge là lựa chọn rõ ràng, kiểm tra lại đúng phạm vi/phương tiện/trọng số.
- Cạnh tạm @start/@end/@direct trong edge_ids có bản đồ partial_edges trỏ cạnh gốc và from_fraction/to_fraction để kiểm toán. Không tra cạnh tạm bằng API /api/detail của graph gốc; dùng source_edge_id.
- Router.route được giữ làm API node cũ cho kiểm thử/đối chiếu; Router.route_edges là API mới, được CLI và viewer sử dụng.

Đây chưa phải hệ thống xác định lối vào hay phía đường hoàn chỉnh: đường song song, cầu vượt, ngõ cạnh đường và dải phân cách có thể cần người dùng chọn đúng cạnh. Hình chiếu 2D không chứng minh tiếp cận được trên thực địa. Danh sách hiển thị tối đa 8 đoạn gần nhất, không đại diện toàn bộ đường trong vùng.

Kiểm thử: 284 tests đạt; Python compile, JavaScript syntax check đạt. Bao gồm hai điểm cùng đoạn, phần chi phí đầu/cuối, chiều ngược, cấm rẽ, via-way, local pending, không sửa graph, barrier terminal, chọn đường rõ ràng và HTTP API. Chưa có kiểm thử tự động trình duyệt đồ họa.

Chạy:
```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v
```
Dừng viewer cũ bằng Ctrl+C. Mở viewer mới với graph sau bản sửa tải trọng:
```powershell
$newGraph = Get-ChildItem data/routing-graph -Directory | Sort-Object Name -Descending | Select-Object -First 1
py -3 tools/routing-rules/graph_viewer.py `
  --graph "$($newGraph.FullName)" `
  --snapshot data/osm-survey/20261028T094314131389Z
```
Mở http://localhost:8766 và Ctrl+F5. Nút chọn điểm và tính tuyến giữ như trước. Danh sách đường nối xuất hiện sau lần tính đầu; nếu sai đường, chọn lại rồi tính lại. Đổi phương tiện/trọng số hoặc điểm yêu cầu xóa lựa chọn cũ. Car/motorcycle vẫn cần chủ động bật diagnostic nếu graph chưa đủ coverage; không thay chính sách coverage.

Kết quả trên snapshot osm-aaf249200a83d21e, graph dựng lúc 08:00 +07 ngày 29/10/2026:
- Start [105.813533,20.998173]. End 1 [105.841535,21.005882]: trước no_route vì node đường phụ; nay car/motorcycle 4070.08m, nối Đường Giải Phóng way 838425491, lệch 1.413m.
- End 2 [105.841600,21.006302]: car/motorcycle 4116.85m, cùng đoạn Giải Phóng, lệch 7.668m.
- Walking: hai tuyến 3751.16m và 3798.00m theo mạng đi bộ, không ép chọn mạng ô tô.
- Replay cả 6 tuyến qua đầy đủ RestrictionMachine không vi phạm quy tắc rẽ đã đánh giá; coverage tồn đọng không đổi. Tệp JSON trong edge-attachment-checks ghi chi tiết kết quả chẩn đoán, không chứng nhận tuyến ngoài thực tế.
