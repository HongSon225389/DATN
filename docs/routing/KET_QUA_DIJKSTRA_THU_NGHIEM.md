# Kết quả Dijkstra thử nghiệm

Graph thử graph-1c2c79d222809c13, snapshot osm-aaf249200a83d21e, đóng băng tại 29/10/2026 08:00 +07.

Cặp node mẫu: [105.8258961,21.0284767] → [105.8413331,21.0160965]. Chọn hai node thuộc cụm SCC lớn của graph ô tô để kiểm tra, không giả định đây là địa chỉ/lối tiếp cận đã xác minh.

| Hồ sơ | Trọng số | Mode | Kết quả | Chiều dài trên mạng | Thời gian cơ sở | Số cạnh |
|---|---|---|---|---:|---:|---:|
| Ô tô | Khoảng cách | diagnostic | found | 3.850,0 m | 522,6 s | 161 |
| Xe máy | Thời gian | diagnostic | found | 3.399,7 m | 465,9 s | 121 |
| Đi bộ | Khoảng cách | strict theo mô hình | found | 2.936,2 m | 2.460,8 s | 162 |
| Ô tô | Khoảng cách | strict | coverage_incomplete | — | — | — |

Các giá trị là kết quả thuật toán trên graph và bảng tốc độ giả định, không phải quãng đường/thời gian đo thực tế hoặc bảo đảm an toàn. Diagnostic vẫn giữ coverage=false. Walking coverage=true chỉ theo tập quy tắc mô hình.

Đã phát lại cả ba tuyến found qua RestrictionMachine đầy đủ, từng cạnh với lịch sử: không gặp forbidden hoặc pending cục bộ ở thời điểm đóng băng. Việc này không giải quyết các hạn chế toàn cục chưa định vị và không xác minh pháp luật/hiện trường.

Một cặp điểm gần đó khác ([105.826,21.028] → [105.84,21.016]) cho no_route khi nối node gần nhất; không tự đổi sang node xa hơn trong cụm thuận lợi để ép tìm được. Điều này cho thấy hạn chế thực tế của bản node snapping và nhu cầu snap-to-edge/nhiều ứng viên về sau.

Đã hoàn thành:

- Dijkstra giữ lịch sử rẽ cần thiết; chỉ giữ hậu tố còn khớp tiền tố via-way và cạnh cuối.
- Khoảng cách/thời gian cơ sở, nguồn graph, GeoJSON, lý do không có tuyến/khóa coverage/giới hạn tìm kiếm.
- Điểm chọn trên bản đồ, xóa/chọn lại từng điểm, nạp cặp mẫu, nhãn chẩn đoán và độ lệch nối node.
- API localhost và CLI; graph/raw/policy không bị sửa.
- 254 tests đạt: 232 trước, 20 router và 2 HTTP. Đã thử API trên graph thật, kiểm tra JS; chưa kiểm thử hình ảnh trình duyệt tự động.

Chưa hoàn thành: nối vào giữa cạnh, xác minh lối tiếp cận từ nhà/địa chỉ, A*, ngập, thời gian giao thông thực, thời điểm tới từng giao lộ, tích hợp ứng dụng React/Express. Chưa bỏ khóa strict cho ô tô/xe máy.
