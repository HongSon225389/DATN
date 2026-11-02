# Rào chắn, kích thước và tốc độ cơ sở

Phiên bản hanoi-barrier-speed-0.1.0. Giải nén vào gốc dự án đã có các gói quy tắc trước. Không sửa dữ liệu OSM hoặc kết quả trước. Chỉ Python chuẩn 3.10+, không cài thêm thư viện.

## Chạy

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v

py -3 tools/routing-rules/barrier_speed_rules.py --snapshot data/osm-survey/20261028T094314131389Z --at "2026-10-29T08:00:00+07:00" --output data/routing-barrier-speed
```

Dự kiến 150 tests (118 cũ + 32 mới). Thêm `/data/routing-barrier-speed/` vào .gitignore. Có thể đổi --at để thử lịch tốc độ hoặc --rules để dùng bản cấu hình khác, kết quả giữ hash và bản sao cấu hình.

## Rào chắn/cổng

Chỉ xử lý barrier dạng node trong snapshot. Rào chắn dạng way/relation chưa được áp dụng vào topology; khi tạo graph phải kiểm tra riêng các trường hợp ấy. Dữ liệu không có barrier không chứng minh đường không có vật cản.

Chuỗi quyền cụ thể nhất: ô tô motorcar → motor_vehicle → vehicle → access; xe máy motorcycle → motor_vehicle → vehicle → access; đi bộ foot → access. Giá trị lạ ở khóa cụ thể không được hạ xuống access=yes. no/use_sidepath giữ forbidden; private/destination/permit/customers/... giữ restricted cho đi xuyên công cộng. destination chưa được xử lý cho điểm cuối hành trình.

| Trường hợp                                             | Quy tắc mô hình                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| gate/lift_gate/swing_gate/sliding_gate                 | Cần quyền rõ ràng và open=yes hoặc locked=no mới allowed_by_model                                       |
| Cổng locked=yes                                        | unresolved: chưa biết quyền chìa khóa/lối phụ; access=yes không tự mở khóa                              |
| Thiếu trạng thái cổng hoặc thiếu quyền                 | unresolved                                                                                              |
| locked=no, quyền yes                                   | Giả định có thể thao tác mở; không khẳng định cổng đang mở hoặc có người vận hành                       |
| wall/fence/block/jersey_barrier                        | forbidden trong mô hình, access=yes không tự xóa vật cản                                                |
| bollard                                                | Ô tô forbidden; xe máy unresolved; đi bộ qua theo giả định nếu không có quyền/kích thước/điều kiện chặn |
| entrance/height_restrictor                             | Cần quyền rõ ràng và không bị giới hạn đã biết chặn                                                     |
| Loại khác, barrier=yes, điều kiện quyền, opening_hours | unresolved; không dùng giờ/ngày chuyển hướng để đoán lịch mở cổng                                       |

Quy tắc trên là lựa chọn mô hình thận trọng, không phải kết luận pháp luật hoặc hiện trường. Cọc tháo/rút được, turnstile, cycle_barrier và lối vòng chưa hỗ trợ. allowed_by_model không mở quyền way và không chứng minh xe qua được trong mọi điều kiện.

## Kích thước

Kiểm tra cả trên node rào chắn và toàn bộ way khảo sát: maxwidth, maxwidth:physical, maxheight, maxheight:physical. Chấp nhận số dương theo mét, có thể có hậu tố m. Không dùng width=\* của mặt đường thay thế khoảng hở cổng. Giới hạn pháp lý và giới hạn vật lý được giữ thành các phép kiểm tra riêng, không ghi đè nhau.

Kích thước xe trong JSON chỉ là hai mẫu nghiên cứu: ô tô rộng 1.8m/cao 1.6m, xe máy rộng 0.8m/cao 1.5m. Không đại diện mọi ô tô/xe máy và chưa quy định gương, người ngồi, hàng hóa hay biên dự phòng. Người đi bộ chưa có kích thước giả định; nếu gặp tag kích thước sẽ unresolved.

Nếu kích thước cấu hình lớn hơn hoặc bằng giới hạn thì mô hình không cho qua (bằng giới hạn không có khoảng dự phòng). Nhỏ hơn chỉ là không bị giới hạn đã biết chặn. Thiếu tag trả not_blocked_by_known_dimensions, không phải đo khoảng hở đạt yêu cầu. Đơn vị khác, điều kiện kích thước, trọng lượng/tải trục/chiều dài chưa hỗ trợ cho xe cơ giới thì giữ unresolved. Chưa có xử lý làn và kích thước theo chiều.

## Tốc độ

Giới hạn nguồn và tốc độ ước tính là hai trường riêng. Bảng estimated_kmh trong JSON là tham số nghiên cứu theo loại đường; thứ tự ba giá trị là ô tô, xe máy, đi bộ. null nghĩa chưa gán tốc độ ước tính, không tự lấy maxspeed làm tốc độ chạy. Bảng đầy đủ được xuất ra BANG_RAO_CHAN_TOC_DO.md.

Xe cơ giới đọc maxspeed:motorcar hoặc :motorcycle → :motor_vehicle → :vehicle → maxspeed; cùng tầng ưu tiên :forward/:backward trước tag chung. Chiều theo thứ tự node OSM. Đi bộ chỉ đọc maxspeed:foot, không kế thừa giới hạn xe cơ giới.

Chấp nhận số dương km/h (không đơn vị hoặc hậu tố km/h) và mph (đổi bằng 1.609344). Giá trị none, walk, signals, mã quốc gia, danh sách/làn... không tự gán số hoặc chuyển sang mặc định nếu tag cụ thể đang không đọc được. maxspeed:type/source:maxspeed không được diễn giải thành giới hạn số; thiếu maxspeed vẫn ghi missing, không tự tra luật quốc gia.

Hỗ trợ một điều kiện tốc độ dạng `20 @ (Mo-Fr 07:00-09:00)` với tập cú pháp giờ/ngày của mô-đun trước; ngoài khung giờ trở lại tag tĩnh cùng khóa nếu có, nếu không có ghi thiếu giới hạn và dùng ước tính có nhãn. Nhiều tầng điều kiện, ngày lễ, làn hoặc tốc độ biến đổi vẫn unresolved. Một số tag làn theo chiều đối diện cũng có thể bị giữ pending một cách thận trọng trong phiên bản này.

`effective_kmh = min(estimated_free_kmh, limit_kmh)` khi giới hạn đọc được. Nếu không có giới hạn nguồn, dùng ước tính và ghi limit_status=missing. Không được diễn giải missing là đã tuân thủ một mức trần pháp luật xác minh.

`base_time_seconds = 3.6 × length_m / effective_kmh`. Chiều dài dùng Haversine bán kính 6,371,008.8m, cộng các đoạn theo node gốc. Là chiều dài toàn way nguồn, kể cả phần ra ngoài khung khảo sát; chưa tách cạnh giao thông. Chưa có trễ rẽ/cổng, đèn tín hiệu, ùn tắc hoặc ngập.

## File kết quả và phạm vi

- barriers.csv, barriers.normalized.json: toàn bộ node barrier trong raw, gồm vùng đệm/phụ thuộc; on_study_way chỉ đúng nếu ID node nằm trên way khảo sát, không nối bằng khoảng cách gần.
- way-dimensions.csv: giới hạn kích thước theo ba phương tiện trên 15.534 way dạng tuyến giao vùng khảo sát.
- speeds.csv: 15.534 way × ba phương tiện × hai chiều = 93.204 dòng, gồm length_m, base_time_seconds, giới hạn nguồn, tốc độ ước tính, lý do chưa xử lý. Hai chiều được khảo sát độc lập, chưa lọc bằng quyền đi/oneway.
- summary.csv: barrier_all_snapshot và barrier_on_study_way là hai phạm vi chồng nhau, không cộng hai nhóm. speed và dimensions có mẫu số khác nhau.
- metadata.json, rules-used.json: phiên bản snapshot, hash raw/cấu hình/GeoJSON, thời điểm đánh giá và phạm vi.

Một way access=no vẫn có thể có speed=estimated: tốc độ không cấp quyền đi. Graph sau này phải kết hợp access + chiều + cổng/kích thước + restriction/via-way + tốc độ + ngập và chính sách pending. Chưa có graph/Dijkstra hoặc kết luận tuyến an toàn.

## Nguồn tham khảo thuộc tính

https://wiki.openstreetmap.org/wiki/Key:barrier

https://wiki.openstreetmap.org/wiki/Key:locked

https://wiki.openstreetmap.org/wiki/Key:open

https://wiki.openstreetmap.org/wiki/Key:maxwidth:physical

https://wiki.openstreetmap.org/wiki/Key:maxspeed
