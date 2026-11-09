# Demo nhiệm vụ tuần — bản Python hiện tại

Áp dụng trên feature/custom-routing. Giải nén ZIP tại E:\hanoi-flood-routing và ghi đè đúng các file viewer trong gói. Giữ nguyên MERN, bộ snapshot, graph và các quy tắc cũ. Không dùng gói Node Stage1. Graph không cần dựng lại để thử lịch trình.

## 1. OSM -> graph

Nguồn: tools/osm-survey/survey.py (build_query, fetch_raw, parse_data, summarize). Tệp gốc data/osm-survey/20261028T094314131389Z/osm-raw.json gồm node, way, relation. roads.geojson và metadata ghi vùng khảo sát, nguồn và hash.

tools/routing-rules/build_graph.py: build đọc raw, tạo bảng tra cứu (type,id); select_ways đối chiếu hình học/tags; build_profile tạo đoạn có hướng, chi phí và danh sách kề; relation được diễn giải bởi turn_rules/time_turn_rules/via_way_rules. Không coi mọi node là giao lộ hoặc tự nối đường cắt nhau trên mặt phẳng.

```powershell
py -3 tools/routing-rules/build_graph.py `
 --snapshot data/osm-survey/20261028T094314131389Z `
 --at "2026-10-29T08:00:00+07:00" `
 --output data/routing-graph
```

Lời nhắc cuối build_graph.py cũ nói chưa có Dijkstra/API là mô tả phạm vi riêng của builder, không phải trạng thái toàn bộ bộ công cụ. Router là experimental_router.py và API nằm graph_viewer.py.

## 2. Tìm đường và chiều đi

```powershell
$newGraph = Get-ChildItem data/routing-graph -Directory |
 Sort-Object Name -Descending | Select-Object -First 1

py -3 -m unittest discover -s tools/routing-rules -p "test_*.py"

py -3 tools/routing-rules/weekly_routing_demo.py `
 --graph "$($newGraph.FullName)" `
 --output data/weekly-routing-demo
```

Demo dùng cặp Nguyễn Trãi -> Giải Phóng, ba profile x hai trọng số x hai loại tuyến = 12 kết quả tuyến, có 24 dòng lịch trình (mỗi tuyến thử giờ đi và giờ đến). results.json chứa toàn bộ tuyến và audit ngập; summary.csv chứa chiều dài/thời gian/lịch trình. Lớp ngập synthetic là giả lập tại Cầu Mới, không phải tin ngập thực tế. Dijkstra kiểm tra lịch sử cạnh; graph lọc theo quyền/chiều/kích thước/rào chắn. Car/motorcycle còn thiếu coverage nên chạy diagnostic rõ ràng, walking strict. Không tự mở cạnh bị hạn chế để có tuyến.

## 3. Bản đồ demo và lựa chọn giờ

Dừng viewer cũ Ctrl+C:

```powershell
py -3 tools/routing-rules/graph_viewer.py `
 --graph "$($newGraph.FullName)" `
 --snapshot data/osm-survey/20261028T094314131389Z `
 --flood tools/routing-rules/flood-demo.synthetic.geojson
```

Mở http://localhost:8766, Ctrl+F5. Chọn phương tiện, khoảng cách/thời gian cơ sở; chủ động bật diagnostic với ô tô/xe máy; bấm Nạp cặp điểm thử tránh ngập; tính tuyến. Tắt/bật tránh ngập để đối chiếu. Chọn Lịch trình ước tính -> giờ khởi hành hoặc giờ muốn đến, nhập ngày giờ Việt Nam UTC+7, tính lại. API yêu cầu timestamp có múi giờ và trả schedule cùng baseline nếu có.

route_timing.py chỉ cộng/trừ thời lượng tuyến: đi lúc T -> đến T+duration; muốn đến T -> cần đi khoảng T-duration. Phép tính thực hiện trên UTC rồi trả cùng offset. Không sửa tuyến/cạnh/trọng số, không thay thời điểm đánh giá ngập và không tự chứng minh lệnh cấm theo giờ là hợp lệ tại thời điểm yêu cầu. Không có tuyến hoặc thiếu duration thì schedule unavailable. Thời lượng tuyến tránh và tuyến thường được dùng riêng.

## Trạng thái trình thầy

- OSM -> graph, phân tích ba loại đối tượng: đã có và chạy được.
- Quy tắc riêng car/motorcycle/walking: đã có phần hỗ trợ, vẫn còn pending/coverage ở car/motorcycle.
- Tuyến ngắn nhất và thời gian cơ sở nhỏ nhất: đã chạy trên graph cố định; chưa traffic/đèn đỏ/chi phí rẽ.
- Tránh ngập: đã có tệp polygon/edge scenario và so sánh tuyến; chưa tự lấy MongoDB admin.
- Chọn giờ đi/giờ đến: mới có ước tính lịch trình cho tuyến cố định, KHÔNG phải đã hoàn thành định tuyến phụ thuộc thời gian hoặc bài toán arrive-by đầy đủ.
- Tích hợp MERN runtime: chưa làm trong gói này.

Các giới hạn của giờ đi/đến phải được báo rõ, không trình như đã dự báo ngập hay tìm tuyến hợp lệ cho tương lai. Thử nghiệm đánh giá tại 2026-10-29T08:00:00+07:00 dù ngày chạy hiện tại khác. Bản này không thay đổi phiếu giao nhiệm vụ hoặc tự chuyển backend sang Python production.

Kiểm tra local: 338 unit tests đạt, 9/9 regression cũ đạt, JS syntax đạt. Chưa xác nhận trình duyệt đồ họa hoặc chạy Windows trực tiếp. validation/weekly-demo-summary.csv trong gói là kết quả local để tham khảo; chạy lệnh để tạo kết quả trên máy bạn.
