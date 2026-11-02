# Dijkstra thử nghiệm — hanoi-dijkstra-experiment-0.1.0

Gói cần graph mới và các gói trước, bao gồm Day Group Schedules + Graph Inspection. Giải nén vào gốc dự án; cho cập nhật graph_viewer.py và graph-viewer/index.html/app.js. Không sửa graph hoặc ứng dụng React/ORS. Chỉ Python chuẩn, không pip/npm.

## 1. Kiểm thử

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v
```

254 tests = 232 trước + 20 Dijkstra + 2 HTTP. Kiểm tra hướng một chiều, quyền rẽ tĩnh/via-way/only, pending cục bộ, khóa coverage, hai đường tới cùng node nhưng khác lịch sử, thu gọn hậu tố lịch sử, cạnh thiếu thời gian, cổng tách port, khoảng cách snap, giới hạn tìm kiếm và API. Đã kiểm tra cú pháp JS/API; chưa kiểm thử hình ảnh trình duyệt tự động.

## 2. Mở viewer và thử trên bản đồ

Dừng viewer 8766 đang chạy bằng Ctrl+C rồi chạy:

```powershell
py -3 tools/routing-rules/graph_viewer.py --graph data/routing-graph/20261029T060937646151Z --snapshot data/osm-survey/20261028T094314131389Z
```

Mở http://localhost:8766, nhấn Ctrl+F5 nếu vẫn thấy giao diện cũ. Không cần dựng lại graph sau khi giải nén gói router này. Nếu graph mới trên máy bạn có tên khác, dùng đúng thư mục Kết quả của lần dựng thành công.

1. Chọn ô tô/xe máy/đi bộ và trọng số Khoảng cách hoặc Thời gian cơ sở.
2. Kéo sidebar tới Dijkstra thử nghiệm, bấm Nạp cặp điểm thử để thử trước. Cặp này là hai node thực trong cụm lớn của snapshot, không phải địa chỉ được geocode. Hoặc chọn điểm đi/đến bằng click bản đồ.
3. Với ô tô/xe máy, để checkbox chẩn đoán tắt và bấm Tính: chương trình sẽ báo khóa vì coverage chưa đầy đủ.
4. Chủ động bật Cho phép chế độ chẩn đoán thiếu coverage rồi tính lại để thử thuật toán. Không tự bật checkbox thay người dùng. Đi bộ có thể dùng chế độ nghiêm ngặt theo coverage của mô hình hiện tại.
5. Tuyến chẩn đoán màu cam; tuyến nghiêm ngặt theo mô hình màu xanh. Điểm đi xanh lá, điểm đến tím; node rào chắn vẫn đỏ. Chấm đen nhỏ là node nối đã chọn, không vẽ đường thẳng giả từ điểm yêu cầu tới node.
6. Có thể chọn lại hoặc bỏ riêng từng điểm, hoặc xóa cả hai và tuyến. Đổi phương tiện/trọng số/chế độ sẽ xóa tuyến cũ; phản hồi tính cũ không được vẽ lên bộ lọc mới.

Kết quả có nhãn chế độ, coverage, độ dài trên mạng, thời gian cơ sở và độ lệch nối node. Chi tiết JSON chứa danh sách edge ID, thời điểm đóng băng, lỗi chưa định vị, giả định và số trạng thái đã duyệt. Không có lớp ngập hoặc xác nhận an toàn.

## 3. Thử bằng CLI và xuất GeoJSON

```powershell
py -3 tools/routing-rules/experimental_router.py --graph data/routing-graph/20261029T060937646151Z --profile car --start "105.8258961,21.0284767" --end "105.8413331,21.0160965" --weight distance --diagnostic --output data/routing-experiments
```

Đây là cặp node mẫu đã thử được trên graph phiên bản 29/10/2026 08:00 +07. Bỏ --diagnostic để thử khóa nghiêm ngặt. Đổi --profile motorcycle/walking và --weight distance/time tùy bài thử. Nếu thử vị trí khác, có thể không có tuyến giữa hai node gần nhất dù ngoài thực tế có lối tiếp cận khác.

Mỗi lần chạy ghi result.json. Nếu found, thêm route.geojson. Tọa độ theo [longitude,latitude]. Thêm `/data/routing-experiments/` vào .gitignore. GET /api/route của viewer không lưu file; dùng CLI để giữ kết quả. Tối đa một yêu cầu tính tuyến trong viewer cùng lúc; request chồng trả 429.

## Chế độ

- strict (mặc định): từ chối nếu strict_coverage_complete=false. Nếu true, vẫn chỉ là đủ coverage theo bộ quy tắc mô hình; không xác minh mọi luật hoặc điều kiện hiện trường.
- diagnostic: cho phép tìm kiếm dù còn hạn chế toàn cục chưa định vị, hiển thị nguyên cờ thiếu coverage và ID quan hệ. Vẫn chặn forbidden và pending cục bộ có incoming guard; không tự điền/xóa raw restriction. Không gọi kết quả là tuyến tuân thủ đầy đủ.

Graph cũ ghi router_implemented=false tại lúc dựng là metadata lịch sử của builder; gói này thêm router độc lập và trả router_version trong kết quả. Không chỉnh metadata/checksum của graph đã lưu.

## Thuật toán và lịch sử

Dijkstra dùng hàng đợi ưu tiên với chi phí không âm, trạng thái (graph_node, history). Cạnh giữ đầy đủ raw segment identity. Chỉ cạnh có chi phí thời gian mới được dùng cho chế độ time. Không biến chi phí thiếu thành 0, không dùng phạt lớn thay cấm.

Sau mỗi bước, giữ cạnh cuối cho restriction tĩnh/pending, và hậu tố dài nhất còn khớp một tiền tố chưa hoàn thành của via-way. Các tiền tố ngắn hơn chồng nhau vẫn nằm ở hậu tố lịch sử đó và được kiểm tra. Nhờ vậy không giữ tùy tiện toàn bộ chín cạnh gần nhất cho mọi đường, tránh bùng nổ trạng thái, nhưng vẫn phân biệt các lần đến cùng node qua chuỗi có ảnh hưởng quyền rẽ.

Bộ kiểm tra chuyển hướng được lập chỉ mục theo incoming segment và segment đầu chuỗi. Chỉ bỏ việc duyệt các rule không thể khớp lịch sử, không bỏ các quy tắc pending cục bộ. Tuyến mẫu thực tế của cả ba hồ sơ đã được phát lại qua RestrictionMachine đầy đủ để đối chiếu; cờ global coverage vẫn giữ nguyên.

Chi phí tối ưu chỉ có nghĩa trên graph, hai node đã nối, trọng số và tập quy tắc đang áp dụng (hoặc đang bỏ ngỏ có nhãn ở chế độ diagnostic). Không phải tối ưu trên mọi khả năng tiếp cận từ địa chỉ thực tế. Chưa A*, chưa so sánh thuật toán.

## Nối điểm: phiên bản tối thiểu có giới hạn

Mỗi đầu lấy node graph đủ điều kiện gần nhất trong bán kính mặc định 100m. Điểm đi cần có cạnh ra, điểm đến cần có cạnh vào cho trọng số đang xét; bỏ terminal port/snap_eligible=false. Không chọn điểm giữa cạnh, không xét nhiều ứng viên hoặc chọn theo cụm có lợi để ép có tuyến. Không nhận diện vỉa hè, lối vào nhà, sông/dải phân cách hay cổng giữa điểm yêu cầu và node.

Độ lệch snap là khoảng cách hình học, không chứng minh có thể đi tới node. Độ dài/thời gian trả về chỉ tính từ node đầu đến node cuối; không tính đoạn tiếp cận. Không vẽ đường thẳng tiếp cận như đường đi hợp lệ. Nếu hai điểm cùng node nối, trả same_snapped_node và không dựng tuyến giả có chiều dài 0.

Đây chưa phải snap-to-edge hoàn chỉnh. Phiên bản sau cần chiếu lên cạnh hợp lệ theo phương tiện, tách cạnh tạm, xét chiều/lối tiếp cận và nhiều ứng viên.

## Trạng thái không tìm được

| State | Ý nghĩa |
|---|---|
| coverage_incomplete | Chế độ strict bị khóa bởi coverage |
| snap_not_found | Một hoặc hai đầu không có node phù hợp trong bán kính |
| same_snapped_node | Cùng node nối, chưa giải quyết hành trình từ hai điểm thực |
| no_route | Hết không gian tìm kiếm giữa các node đã nối dưới quy tắc mô hình; không khẳng định ngoài thực tế không có đường |
| search_limit | Chạm giới hạn; chưa kết luận không có tuyến |
| found | Có tuyến trên graph theo mode/giới hạn đã công bố |

Trước khi duyệt, kiểm tra hai node nối có cùng WCC theo trọng số hay không. Khác cụm trả no_route_reason=different_weak_components_after_graph_filters; nếu hết tìm kiếm cùng cụm thì reason=directed_or_turn_constraints_between_snapped_nodes. Không dùng WCC như bằng chứng có tuyến khi cùng cụm.

Giới hạn mặc định 150.000 trạng thái mở rộng, 600.000 trạng thái phát hiện và 15 giây vòng lặp tìm kiếm (thời gian tải/index/snap nằm ngoài 15 giây). Có kiểm tra giới hạn và không trả tuyến xấp xỉ khi hết ngân sách. API giữ các mức mặc định; CLI chỉ cho đổi bán kính snap tối đa 500m.

Mọi hạn chế thời gian được đóng băng tại evaluated_at của graph, không lấy giờ hiện tại hoặc giờ dự kiến đến từng nút. Thời gian cơ sở chưa tính ùn tắc, đèn đỏ, chờ rẽ, mở cổng, đoạn tiếp cận hoặc ngập. Chưa tích hợp ứng dụng React/Express đang dùng ORS.
