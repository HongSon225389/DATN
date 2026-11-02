# Via-way: chuỗi chuyển hướng

Phiên bản hanoi-via-way-0.1.0. Giải nén vào gốc dự án sau các gói quy tắc trước. Gói chứa via_way_rules.py, test_via_way_rules.py và time_turn_rules.py được bổ sung tham số normalizer để kết hợp via-way với lịch. Các lời gọi cũ giữ hành vi cũ. Không ghi đè turn_rules.py, cấu hình hoặc dữ liệu OSM.

## Chạy trên Windows

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v

py -3 tools/routing-rules/via_way_rules.py --snapshot data/osm-survey/20261028T094314131389Z --at "2026-10-29T08:00:00+07:00" --output data/routing-via-way

py -3 tools/routing-rules/via_way_rules.py --snapshot data/osm-survey/20261028T094314131389Z --at "2026-10-29T12:00:00+07:00" --output data/routing-via-way
```

Thêm `/data/routing-via-way/` vào .gitignore. Mỗi lần chạy tạo thư mục mới gồm metadata.json, summary.csv, decisions.csv, rules-used.json và turn-rules.with-sequences.json. Không đưa JSON mới vào turn_diagnostics.py cũ: schema và trạng thái có thêm sequence/time.

## Phạm vi chuẩn hóa

- Một from-way, một to-way, một hoặc nhiều via-way theo thứ tự các thành viên via trong nguồn. Thứ tự from/to trong danh sách tổng thể không quan trọng; không tự đổi thứ tự các via.
- Mỗi cặp way kề nhau nối duy nhất qua một node chung ở đầu/cuối cả hai way. Tất cả node tham chiếu phải có trong snapshot.
- Way không vòng, không lặp node. Via không lặp và không trùng from/to. Các trường hợp chưa duy nhất giữ unresolved; nguồn thiếu hoặc chuỗi đứt giữ invalid. Không suy ra đường nối từ tọa độ gần nhau.
- Tạo chuỗi segment có hướng theo thứ tự node OSM: way_id, segment_index, direction, from_node, to_node. Đi ngược thứ tự nguồn vẫn chuẩn hóa được; chưa chứng minh chiều ấy được phép lưu thông.
- Phân biệt from=to khi cấu trúc xác định duy nhất với trường hợp có nhiều điểm nối. Không tự đoán đường quay đầu khi topology mơ hồ.
- Ngoại lệ theo phương tiện, tập cú pháp giờ/ngày và kiểm tra tĩnh via-node kế thừa các gói trước. Thời điểm đóng băng bắt buộc có múi giờ.

## Cách kiểm tra chuỗi

`RestrictionMachine(records, profile).advance(history, outgoing)` trả state, blocking_relations, các pending, coverage_complete, evaluated_at và next_history.

Với `no_*`: chỉ chặn segment cuối khi lịch sử nối đúng toàn bộ chuỗi from → via → to. Đi vào via từ một đường khác hoặc rẽ ra khỏi via trước khi hoàn thành chuỗi không bị chính quan hệ no này chặn.

Với `only_*`: sau khi đi đoạn from kích hoạt, phải tiếp tục từng đoạn đúng chuỗi; rẽ ra sớm, quay đầu hoặc đi sai đoạn tiếp theo bị chặn. Các quan hệ đồng thời được áp dụng theo phép giao các ràng buộc; nếu hai only mâu thuẫn, các nhánh vi phạm đều bị chặn, không tự hợp nhất đích. Mô-đun chưa có báo cáo chẩn đoán xung đột only giữa các chuỗi riêng.

Mỗi bước thử độc lập, chỉ dùng next_history của bước được chấp nhận cho nhánh kế tiếp. Nếu state forbidden, unresolved hoặc invalid_transition thì không mở rộng bước đó. not_blocked_by_evaluated_rules vẫn không cấp quyền đi; khi coverage_complete=false cần chính sách xử lý pending riêng.

Các quy tắc chưa xác định vị trí giữ danh sách unlocated_pending_relations, không biến thành tuyến hợp lệ toàn mạng. Chưa triển khai chính sách chặn/khoanh vùng các trường hợp đó.

## Yêu cầu tích hợp Dijkstra/A*

Trạng thái tìm kiếm phải gồm `(node, history)` với lịch sử segment có hướng đủ dài (được giới hạn theo chuỗi dài nhất). Hai lần tới cùng node nhưng đi từ lịch sử khác nhau có thể có quyền rẽ khác nhau. Chỉ lưu visited[node] hoặc chỉ nhớ cạnh cuối sẽ bỏ lọt hạn chế via-way.

Hàm bắt đầu với history rỗng chỉ phù hợp điểm xuất phát mới; không xóa history khi qua nút giao. Khi graph gộp nhiều segment OSM thành một cạnh, phải chạy lần lượt qua các segment bên trong hoặc bảo toàn các điểm tách cần thiết. Không chuyển trực tiếp way_id thành cạnh rồi bỏ segment_index/direction.

Chưa tạo graph, chưa áp dụng access/chiều/rào chắn/tốc độ/ngập, chưa thực thi Dijkstra/A*. Toàn bộ kết quả được đánh giá tại --at; chưa tính giờ dự kiến tới nút. Không tái sử dụng bộ quy tắc cho giờ khác.

## Kiểm thử

118 tests gồm 92 test trước và 26 test mới. Các ca có no/only, một/nhiều via, hướng ngược, rẽ sớm, lối vào khác, lịch sử khác cùng node, chuỗi chồng nhau, điều kiện thời gian, ngoại lệ phương tiện, nguồn thiếu và bất biến dữ liệu. Kiểm thử không xác minh biển báo ngoài thực địa.

Nguồn: https://wiki.openstreetmap.org/wiki/Relation:restriction và https://wiki.openstreetmap.org/wiki/Conditional_restrictions
