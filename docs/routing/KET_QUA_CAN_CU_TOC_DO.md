# Khảo sát căn cứ tốc độ — Hà Nội

Snapshot osm-aaf249200a83d21e. Phạm vi: 15.534 way OSM dạng tuyến giao vùng nghiên cứu; không phải 15.534 đoạn graph cuối cùng. Đánh giá bộ đọc tốc độ tại 29/10/2026 08:00 +07.

| Dữ liệu trong nguồn | Số way |
|---|---:|
| maxspeed | 1.871 |
| maxspeed:motorcar | 14 |
| maxspeed:type | 46 |
| maxspeed:forward / backward | 0 / 0 |
| maxspeed:conditional | 0 |
| lanes | 2.148 |
| lanes:forward / backward | 17 / 16 |
| oneway | 2.406 |
| divider | 1 |
| dual_carriageway / urban / zone:traffic / zone:maxspeed | đều 0 |

Các nhóm có thể chồng nhau, không cộng để suy số way có giới hạn. Có maxspeed khoảng 12,05% way. Có lanes chỉ chứng minh tag tồn tại, không xác định đầy đủ loại đường pháp lý hay số làn xe cơ giới.

| Quyết định theo hồ sơ và chiều | Ô tô | Xe máy | Đi bộ |
|---|---:|---:|---:|
| Đọc được giới hạn OSM, chưa xác minh độc lập | 3.766 | 3.742 | 0 |
| Thiếu tag giới hạn áp dụng | 27.302 | 27.326 | 31.068 |
| Tag giới hạn chưa diễn giải được | 0 | 0 | 0 |
| Tổng mỗi hồ sơ | 31.068 | 31.068 | 31.068 |

Mỗi hồ sơ gồm 15.534 × hai chiều, chưa lọc access/oneway. Tốc độ ước tính vẫn là bảng nghiên cứu của gói trước; số thiếu giới hạn không phải số thiếu tốc độ ước tính.

Nhóm mẫu thật: 1.871 ứng viên có maxspeed số, 13.630 ứng viên không có bất kỳ khóa maxspeed hoặc maxspeed:*; directional và conditional đều 0 trong phạm vi này. Không dựng mẫu giả để thay thế hai nhóm trống. Bộ test tổng hợp có kiểm tra riêng hai chức năng.

Công cụ tìm được 7 node gợi ý tốc độ trên toàn raw, không node nào thuộc các way khảo sát theo ID node. Phép tìm chỉ nhận maxspeed hoặc traffic_sign chứa chữ maxspeed; không bao phủ mọi mã biển và không chứng minh vắng biển. Chưa xác lập phạm vi khu đông dân cư hoặc dải phân cách từ khảo sát này.

Đã hoàn thành: khảo sát thuộc tính, tách nguồn OSM/tốc độ ước tính/đề xuất đối chiếu, xuất phiếu mẫu và kiểm tra cấu trúc phiếu nạp lại, báo mâu thuẫn/thiếu căn cứ/hết hạn. Tổng 165 tests đạt; nạp lại sáu phiếu mẫu thật thành công, không phiếu nào tự được áp dụng vào router.

Chưa hoàn thành: xác minh nguồn ngoài độc lập cho từng đoạn, xác định phạm vi hiệu lực của biển, suy giới hạn theo quy định chung, lựa chọn ưu tiên nguồn để áp dụng, hiệu chỉnh tốc độ ước tính bằng dữ liệu thực và dựng graph.

Kết luận thực hành: giữ giới hạn thiếu ở trạng thái unknown; không tự gán 50/60 dựa trên tên loại đường hoặc địa chỉ Hà Nội. Có thể tiếp tục thử thuật toán bằng tốc độ giả định có nhãn, nhưng không báo thời gian thực hoặc khẳng định đã xác định đủ giới hạn pháp luật.
