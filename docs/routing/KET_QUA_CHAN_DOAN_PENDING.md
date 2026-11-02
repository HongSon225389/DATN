# Kết quả chẩn đoán pending chưa định vị

Snapshot osm-aaf249200a83d21e, graph-9916f381388c66a5, thời điểm đóng băng 29/10/2026 08:00 +07.

| Hồ sơ | invalid | unresolved | Tổng quyết định | Có cạnh khớp thành viên đã biết |
|---|---:|---:|---:|---:|
| car | 16 | 1 | 17 | 8 |
| motorcycle | 4 | 1 | 5 | 2 |
| walking | 0 | 0 | 0 | 0 |

Tổng 22 quyết định hồ sơ thuộc 17 relation OSM duy nhất. Không gọi 17 mục ô tô là 17 lỗi invalid: có một mục unresolved do lịch chưa hỗ trợ.

Ô tô: thiếu from 9, thiếu to 1, thiếu via 6; một cấu trúc nhiều to/via-node; một quan hệ via-way có điều kiện thời gian chưa hỗ trợ. Các nhóm chồng nhau, không cộng thành số relation độc lập.

Xe máy: thiếu from 4 và một quan hệ via-way có điều kiện thời gian chưa hỗ trợ.

Quan hệ 16733522 có đủ from-way/via-way/to-way; tag restriction:conditional là `no_left_turn @ (Fr 19:00-23:59; Sa-Su 06:00-23:59)`. Bộ xử lý lịch hiện tại chưa hỗ trợ dấu chấm phẩy chia lịch theo ngày. Đây là giới hạn của bộ diễn giải, không phải thiếu vai trò trong nguồn. Thành viên đã biết của quan hệ này có 15 cạnh khớp graph ở mỗi hồ sơ ô tô/xe máy, nhưng chưa chuẩn hóa thành quy tắc có hiệu lực. Không tự xóa dấu chấm phẩy hoặc sửa nguồn.

Các quan hệ khác cần đối chiếu cấu trúc trước khi tái dựng. Một node chung from/to hoặc khung thành viên không đủ chứng minh thành viên bị thiếu. No-match trên graph không chứng minh không ảnh hưởng.

218 tests đạt, gồm 14 test mới. Không sửa raw, graph, quy tắc hoặc coverage. Công cụ chưa chứng minh được phạm vi ảnh hưởng đầy đủ cho bất kỳ mục nào.

Bước có thể triển khai tiếp: hỗ trợ tập con lịch chia theo những nhóm ngày được xác định rõ, rồi chuẩn hóa lại via-way và dựng graph phiên bản mới. Những quan hệ thiếu vai trò vẫn cần chính sách có căn cứ; không tự chọn từ các ứng viên.

# Chẩn đoán quan hệ pending trên graph

Graph graph-9916f381388c66a5. Không thay dữ liệu, policy hoặc coverage.

| Hồ sơ | Quan hệ | Lỗi cấu trúc | Cạnh graph khớp thành viên đã biết | Cụm WCC của thành viên |
|---|---:|---|---:|---|
| car | 9859076 | missing_via | 26 | 1 |
| car | 9887803 | missing_via, missing_to | 0 |  |
| car | 9890814 | missing_from | 0 |  |
| car | 11149314 | missing_via | 6 | 1 |
| car | 16261490 | missing_via | 43 | 1 |
| car | 16261491 | missing_via | 47 | 1 |
| car | 16733522 | via_way_without_incoming_guard, unresolved_time_condition | 15 | 1 |
| car | 16748507 | missing_from | 2 | 1 |
| car | 16748508 | missing_from | 2 | 1 |
| car | 17096522 | missing_from | 1 | 11 |
| car | 17646494 | missing_from | 0 |  |
| car | 17646495 | missing_from | 0 |  |
| car | 17646496 | missing_from | 0 |  |
| car | 17896280 | multiple_to, multiple_or_mixed_via_nodes | 0 |  |
| car | 21042852 | missing_from | 0 |  |
| car | 21042854 | missing_from | 0 |  |
| car | 21716103 | missing_via | 0 |  |
| motorcycle | 9890814 | missing_from | 0 |  |
| motorcycle | 16733522 | via_way_without_incoming_guard, unresolved_time_condition | 15 | 1 |
| motorcycle | 17096522 | missing_from | 1 | 6 |
| motorcycle | 21042852 | missing_from | 0 |  |
| motorcycle | 21042854 | missing_from | 0 |  |

Các nhóm lỗi có thể chồng nhau. Cụm WCC theo từng hồ sơ, mạng khoảng cách; ID không so trực tiếp giữa hồ sơ. Không có cạnh khớp không chứng minh lỗi nằm ngoài vùng/tuyến. Nút chung from/to và cạnh tới via chỉ là ứng viên rà soát, không tự khôi phục quan hệ.

Chưa có quan hệ nào được chứng minh phạm vi ảnh hưởng đầy đủ. Chế độ nghiêm ngặt giữ nguyên; chưa chạy Dijkstra. Chi tiết từng member và đề xuất việc cần kiểm tra có trong JSON/CSV.
