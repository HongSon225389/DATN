# Bổ sung tải trọng — 29/10/2026

Giải nén ZIP vào gốc E:\hanoi-flood-routing, chấp nhận ghi đè các tệp trong tools/routing-rules. Không sửa OSM gốc. Phải dựng graph mới; graph cũ không tự đổi.

maxweight là tổng khối lượng thực tế xe khi lưu thông, mặc định tấn. Hỗ trợ số dương không đơn vị, t, kg, lbs/lb, st (short ton). Chỉ vượt giới hạn mới bị chặn; bằng giới hạn không bị chặn bởi tải trọng. Không dùng phép so sánh khoảng hở của chiều cao/rộng cho khối lượng.

Cấu hình nghiên cứu: car đại diện ô tô con 2.5 tấn khi chở người/hành lý; motorcycle 0.35 tấn gồm người/hành lý. Đây là giả định điều chỉnh được, không phải số đo hay thông số mọi xe. Không dùng hồ sơ car này cho xe tải/buýt. Trường actual_weight_t; max_axle_load_t và gross_weight_rating_t mặc định null.

maxaxleload dùng tải trọng trục riêng nếu có. Khi thiếu, chỉ dùng tổng khối lượng làm cận trên để chứng minh không vượt; nếu cận trên vượt giới hạn thì unresolved, không kết luận trục quá tải. maxweightrating dùng khối lượng toàn bộ cho phép riêng, không dùng khối lượng thực tế thay thế.

maxweight:signed=yes/no là metadata về biển, không phải giới hạn số; signed=no không hủy giới hạn số nếu cả hai cùng có. Giới hạn riêng hgv/hgv_articulated không áp dụng cho ô tô con và xe máy. Giới hạn có điều kiện hoặc qualifier khác chưa hỗ trợ vẫn unresolved. Quyền đi, chiều, rẽ, kích thước, rào chắn vẫn được kiểm tra độc lập. Không suy rằng thiếu maxweight nghĩa là cầu được chứng nhận an toàn.

Nguồn quy ước tag:
- https://wiki.openstreetmap.org/wiki/Key:maxweight
- https://wiki.openstreetmap.org/wiki/Key:maxaxleload
- https://wiki.openstreetmap.org/wiki/Key:maxweightrating

Kiểm tra:
```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v
py -3 tools/routing-rules/build_graph.py `
  --snapshot data/osm-survey/20261028T094314131389Z `
  --at "2026-10-29T08:00:00+07:00" `
  --output data/routing-graph
$newGraph = Get-ChildItem data/routing-graph -Directory | Sort-Object Name -Descending | Select-Object -First 1
# Ctrl+C dừng viewer cũ trước khi chạy:
py -3 tools/routing-rules/graph_viewer.py `
  --graph "$($newGraph.FullName)" `
  --snapshot data/osm-survey/20261028T094314131389Z
```

Kết quả xác minh local: 268 tests OK. Rà toàn bộ raw snapshot có 187 đối tượng mang tag họ maxweight/maxaxleload. Với car: 166 không bị chặn bởi các kích thước/tải trọng đã biết, 6 bị chặn, 15 unresolved. Motorcycle: 172 không bị chặn, 15 unresolved. Đây không phải số đoạn được cấp toàn bộ quyền đi. Còn 12 điều kiện giờ chưa xử lý và 3 thiếu thông số khối lượng định mức mỗi profile; không tự mở chúng.

So với graph trước: 104 quyết định way/chiều thay đổi mỗi profile motorized. Graph mới: car 29771 nodes, 54692/54522 distance/time edges; motorcycle 36149 nodes, 72260/72188 edges; walking giữ 50602 nodes, 113958 edges. Coverage car/motorcycle vẫn false vì các quan hệ rẽ còn tồn đọng, walking true theo mô hình.

Cặp kiểm tra: start [105.813531,20.998164], end [105.841557,21.005101]. Car cũ 5266.54m; graph mới car và motorcycle 3976.76m, 477.21s cơ sở; cả hai qua way 703109533 Cầu Mới (maxweight=30). Chạy diagnostic vì coverage chưa đủ. Không dùng thời gian cơ sở đối chiếu trực tiếp thời gian giao thông Google Maps.

mass-audit/: CSV đối chiếu trạng thái và result JSON tuyến kiểm tra. Không bao gồm graph đã tạo; tự dựng lại để lưu đúng provenance và cấu hình trên máy bạn.
