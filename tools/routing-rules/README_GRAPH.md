# Graph đường có hướng v0.1

Giải nén vào thư mục gốc dự án đã có tất cả gói quy tắc trước. Không cài pip/npm. Python chuẩn 3.10+; đọc gzip bằng thư viện chuẩn. Gói thêm build_graph.py và test_build_graph.py, không sửa quy tắc nguồn cũ.

## Chạy

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v

py -3 tools/routing-rules/build_graph.py --snapshot data/osm-survey/20261028T094314131389Z --at "2026-10-29T08:00:00+07:00" --output data/routing-graph
```

190 tests = 165 cũ + 25 mới. Giữ nguyên thời điểm để tái lập. Dùng --scope download nếu muốn mạng mở rộng ra vùng đệm; mặc định study. Chưa cần tải lại dữ liệu. Thêm `/data/routing-graph/` vào .gitignore. Gói không tự commit/push hoặc thay ứng dụng ORS đang có.

## Mạng được dựng

Directed multigraph theo từng cặp node kề nhau trong way gốc, chưa đơn giản hóa. Một cạnh là (way_id, segment_index, direction, from_node, to_node). Way hai chiều có hai cạnh cho cùng segment, way một chiều giữ hướng được phép theo từng hồ sơ. Các way song song giữa cùng cặp node không bị ghi đè. Không coi mọi node là nút giao: nhiều node chỉ mô tả hình học.

Giữ nguyên ID OSM. Hai đường có tọa độ cắt nhau hoặc hai node trùng tọa độ không tự nối. Đường cầu/hầm giữ bridge/tunnel/layer gốc; không tạo giao mới từ hình vẽ. Kiểm tra toàn bộ tọa độ/thứ tự node của GeoJSON với raw, không khớp thì dừng. Đoạn cùng node hoặc chiều dài 0 bị loại. Không làm phẳng qua node thiếu.

Mặc định chọn toàn bộ way dạng tuyến giao vùng khảo sát, không cắt hình học tại biên bbox; các way này có thể đi ra ngoài vùng. --scope download gồm study_intersection và download_buffer, vẫn không tự lấy way phụ thuộc ngoài phạm vi chọn. Chưa nối mạng sang ngoài biên; chia cắt có thể do biên khảo sát.

## Quy tắc kết hợp

- Way/hướng cần access + direction = allowed, kích thước không pending/forbidden. excluded/restricted/forbidden/unresolved bị loại khỏi tập cạnh. Một cấm không bị ghi đè bởi một cho phép ở nhóm khác.
- Tốc độ chưa có hoặc chưa đọc được: vẫn có thể có cạnh khoảng cách nếu các nhóm khác đạt, base_time_seconds=null. Không dùng cạnh ấy cho thời gian. Thiếu giới hạn luật nhưng có tốc độ ước tính được phép dùng trong graph nghiên cứu, giữ limit_status và speed_assumed.
- Đọc quyền/kích thước tại node ngay cả khi node không gắn barrier. Không bỏ qua access=no trên node.
- Cổng/rào chắn đạt allowed_by_model giữ node kết nối. Cổng chưa rõ, bị cấm hoặc quyền riêng không được đi xuyên.
- Rào chắn dạng way/relation chưa được xử lý giao hình học: báo unsupported_shape_barriers, chặn node chung xác định được và khóa độ bao phủ nghiêm ngặt. Báo cáo lấy toàn snapshot một cách thận trọng, không mặc định vật cản ngoài vùng là vô hại. Snapshot hiện tại không có nhóm này trong raw.
- Các giá trị mặc định của mô hình, quyền theo loại đường, cổng giả định mở được, tốc độ và mẫu kích thước xe vẫn là giả định nghiên cứu; không trở thành dữ liệu đã xác minh.

### Node cổng bị chặn và terminal port

Để chặn đi xuyên mà vẫn giữ đoạn đường dẫn đến gần cổng, node chặn được tách thành các đầu mút ảo riêng theo segment. Ví dụ n2 trở thành b2:10:0 và b2:10:1 cho hai segment khác nhau. Cả hai cùng tọa độ/OSM node, nhưng graph không nối chúng. Hướng ngược của chính segment dùng chung đầu mút nên vẫn có thể quay lại đoạn đã tới (còn phải xét restriction).

Terminal port có snap_eligible=false. Bộ nối điểm đi–đến sau này không được tự gộp các port theo tọa độ hoặc chọn port như lối xuyên qua cổng. Graph không cung cấp quyền dùng cổng làm điểm đầu/cuối. Đây là cách biểu diễn rào chắn, không phải node giao thông mới ngoài thực tế.

## Cấm rẽ/via-way không phải thuộc tính một cạnh

Các quy tắc đã đánh giá tại --at được đóng gói trong từng graph. Mẫu via-node và chuỗi via-way giữ ID segment gốc. Không xóa một cạnh to chỉ vì cấm từ một hướng vào cụ thể.

GraphTransitions(graph, strict=True).advance(edge_history, outgoing_edge_id, weight='distance') là hàm bảo vệ để router tương lai sử dụng, không phải Dijkstra. Hàm kiểm tra kết nối graph, chi phí, rồi restriction theo lịch sử. weight chỉ nhận distance hoặc time. Chỉ mở rộng khi state=not_blocked_by_evaluated_rules, và trong chế độ nghiêm ngặt phải đủ coverage.

Lịch sử là danh sách edge ID. Dùng next_edge_history của từng nhánh được chấp nhận. Trạng thái tìm kiếm cần (graph_node, history), không chỉ visited[node]. Lịch sử không được xóa khi qua giao lộ. Rẽ bị chặn trả forbidden; hướng vào có restriction pending đã định vị trả unresolved và không mở rộng. only_* được kiểm tra cả các lối rẽ sớm trên via-way.

Nếu có restriction unresolved/invalid không định vị được hướng vào, strict_coverage_complete=false cho hồ sơ đó. Graph vẫn được xuất để nghiên cứu cấu trúc, nhưng GraphTransitions strict không cho mở rộng bất kỳ bước nào: trả coverage_incomplete. Chưa khoanh vùng hẹp các lỗi này theo tài liệu ngoài.

strict=False chỉ là chế độ chẩn đoán: vẫn chặn cấm rõ ràng và pending cục bộ, nhưng có thể xem các bước khác kèm cờ chưa đủ coverage. Không được dùng kết quả chẩn đoán để thông báo tuyến tuân thủ đầy đủ. strict_coverage_complete=true cũng không chứng minh hiện trường hoặc mọi luật giao thông đã đủ; chỉ là điều kiện bao phủ của tập dữ liệu/quy tắc đang xét. strict_routing_ready vẫn false vì chưa có router/snap.

## File kết quả

| File | Nội dung |
|---|---|
| car.graph.json.gz | Nodes, edges, adjacency, kiểm soát node, restriction và coverage ô tô |
| motorcycle.graph.json.gz | Tương tự cho xe máy |
| walking.graph.json.gz | Tương tự cho đi bộ |
| summary.csv | Số node/cạnh khoảng cách/thời gian, WCC/SCC, đầu mút ảo và lỗi coverage |
| connectivity.json | Chi tiết hai mạng trọng số, lý do loại và node nguồn/ảo |
| way-decisions.csv | Quyết định mỗi way/hồ sơ/chiều và lý do |
| policy-used.json | Chính sách kết hợp có phiên bản |
| metadata.json | Phiên bản graph, snapshot, hash nguồn/cấu hình/mã triển khai và các file đầu ra |
| Các file *rules*.json | Bản sao cấu hình đã dùng |

Mỗi lần chạy tạo thư mục riêng. graph_version xác định từ snapshot, scope, thời điểm, chính sách, cấu hình và mã triển khai. Lặp cùng đầu vào cho cùng phiên bản và graph payload; thời điểm tạo thư mục khác nhau. metadata status=completed chỉ ghi khi kết thúc thành công; thư mục thiếu metadata không phải bản hoàn tất.

## Đọc graph bằng Python

```python
import gzip, json
with gzip.open('data/routing-graph/<run>/car.graph.json.gz', 'rt', encoding='utf-8') as f:
    graph = json.load(f)
print(graph['graph_version'], len(graph['nodes']), len(graph['edges']))
```

nodes là object theo graph node ID; edges theo edge ID; adjacency ánh xạ node ra các edge ID. Edge giữ from_node/to_node gốc và graph_from/graph_to để phân biệt đầu mút ảo. length_m tính từ node raw bằng Haversine; thời gian = 3.6*length_m/effective_kmh. Chưa tính trễ rẽ/cổng/đèn tín hiệu hoặc ùn tắc.

## Hiểu báo cáo kết nối

WCC là cụm liên thông khi bỏ chiều, SCC là cụm có thể đi tới nhau theo chiều. Cả hai chỉ tính topology segment sau access/chiều/kích thước/cổng, CHƯA tính trạng thái lịch sử rẽ. Không phải số tuyến tìm được hoặc khả năng đi giữa mọi cặp điểm có xét đầy đủ hạn chế. Mạng thời gian chỉ dùng cạnh có chi phí thời gian; có thể khác mạng khoảng cách.

Số node báo cáo bao gồm đầu mút ảo đang có cạnh. Số physical_osm_nodes_in_graph đếm ID nguồn riêng. Một số node bị chặn không có cạnh nào đủ quyền nên không xuất hiện trong graph active. blocked_control_nodes đếm toàn bộ node điều khiển bị chặn trên way nguồn, có thể gồm node quyền/kích thước không gắn barrier; không so trực tiếp với 721 node barrier khảo sát trước.

Các lý do loại way/hướng có thể chồng nhau; không cộng để suy tổng loại duy nhất. degenerate_segment là số đoạn hướng suy biến, mẫu số khác các lý do way/hướng.

## Chưa thực hiện

Chưa có Dijkstra/A*, API định tuyến, nối điểm đi–đến, graph viewer mới, ngập, tốc độ thực tế, trễ rẽ hoặc kiểm tra địa phương ngoài các quy tắc đã mô hình hóa. Quyền/chiều có điều kiện chưa hỗ trợ vẫn bị loại, không tự diễn giải bằng lịch của restriction. Mọi lịch đang dùng một thời điểm đóng băng; chưa tính giờ dự kiến đến nút.

Bước tiếp theo là xem các cụm bị tách và các lỗi coverage, chọn phạm vi thử hợp lý; sau đó mới nối điểm và thêm thuật toán. Không tự nới quyền hoặc mở cổng chỉ để làm mạng liên thông.
