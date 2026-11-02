# Bảng quyền đi ba phương tiện — phiên bản nghiên cứu 0.1

Mã cấu hình: `hanoi-access-0.1.0`.

Mục tiêu: chuẩn hóa quyết định **quyền đi ở cấp đường nguồn OSM (way)**, có giải thích nguồn,
để chuẩn bị xây graph. Chưa phải quyền đi hoàn chỉnh của một cạnh có hướng hoặc của cả hành trình.
Chưa thay ORS, chưa sửa DB/web/viewer và chưa áp dụng phiếu rà soát thành thay đổi dữ liệu.

Các bảng dưới đây là **chính sách thí điểm và giả định mặc định của đồ án**, không phải bảng pháp luật
giao thông Việt Nam đã được kiểm chứng. Tag OSM có nguồn gốc nhưng vẫn có thể thiếu hoặc cũ.

## 1. Ba cấu hình phương tiện

| Mã         | Phạm vi                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------- |
| car        | Ô tô con nói chung; chưa có cấu hình xe tải, xe khách, xe ưu tiên                           |
| motorcycle | Xe máy theo nhánh OSM motorcycle; chưa gộp tự động moped, xe điện hoặc mọi loại xe hai bánh |
| walking    | Đi bộ thông thường; chưa phải cấu hình xe lăn hoặc tiếp cận cho người hạn chế vận động      |

Ô tô A/B hoặc xe máy A/B về ngập sẽ phát triển sau. Hai cấu hình cùng nhóm vẫn có thể dùng chung
quyền đi ở bước này; không cần tạo bảng hãng/mẫu xe.

## 2. Các trạng thái đầu ra

| Trạng thái | Ý nghĩa                                                    | Qua bước quyền way để đi xuyên công cộng? |
| ---------- | ---------------------------------------------------------- | ----------------------------------------- |
| allowed    | Được chấp nhận theo tag hoặc giả định đang dùng            | Có, nhưng còn các bước kiểm tra khác      |
| forbidden  | Bị loại theo tag hoặc mặc định hạn chế của mô hình         | Không                                     |
| restricted | Chỉ cho mục đích/đối tượng/quyền truy cập nhất định        | Không trong tuyến công cộng đi xuyên      |
| unresolved | Thiếu căn cứ, giá trị bất thường hoặc điều kiện chưa xử lý | Không trong bản bảo thủ                   |
| excluded   | Ngoài phạm vi xây mạng phiên bản này                       | Không; không đồng nghĩa bị cấm theo luật  |

`allowed` không có nghĩa đường đang mở, xe chắc chắn đi qua được hoặc tuyến hợp pháp/an toàn.
Sau bước này vẫn phải xét chiều, cấm rẽ, barrier, kích thước, tốc độ và ngập.

## 3. Ưu tiên thuộc tính

Từ cụ thể đến tổng quát:

| Phương tiện | Chuỗi khóa xét                                |
| ----------- | --------------------------------------------- |
| Ô tô        | motorcar → motor_vehicle → vehicle → access   |
| Xe máy      | motorcycle → motor_vehicle → vehicle → access |
| Đi bộ       | foot → access                                 |

Khóa cụ thể nhất **có mặt** được chọn. Không đọc được giá trị của nó thì trả unresolved;
không bỏ qua để tìm một khóa tổng quát cho phép.

Ví dụ:

- `access=no, motorcycle=yes`: xe máy allowed; ô tô forbidden; đi bộ forbidden.
- `motor_vehicle=no, foot=yes`: hai nhóm xe forbidden; đi bộ allowed.
- `vehicle=no`: không kế thừa sang người đi bộ.
- `access=private, foot=yes`: đi bộ allowed theo tag riêng; xe không có ngoại lệ restricted.
- `motorcar=*, access=yes`: ô tô unresolved, không dùng access=yes để che giá trị bất thường.

Đây là phân cấp thuộc tính access, không phải thuật toán diễn giải cấm rẽ hoặc chiều.

## 4. Ý nghĩa các giá trị

| Giá trị                           | Trạng thái mô hình                 | Ghi chú                                                     |
| --------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| yes                               | allowed nếu qua các điều kiện khác | Cho phép theo dữ liệu                                       |
| designated, official              | allowed khi dùng ở khóa phù hợp    | access=designated/official chung được giữ unresolved        |
| permissive                        | allowed + cảnh báo                 | Quyền do chủ quản cho phép có thể bị thu hồi                |
| discouraged                       | allowed + cảnh báo                 | Không tự biến thành cấm; chưa tính trọng số phạt ở bước này |
| no                                | forbidden                          | Trừ trường hợp được khóa cụ thể hơn ghi đè                  |
| use_sidepath                      | forbidden cho way hiện tại         | Cần sử dụng lối khác; chưa tự tạo kết nối tới lối đó        |
| private, permit                   | restricted                         | Chưa xác nhận người dùng có quyền                           |
| destination                       | restricted                         | Có thể phục vụ điểm đầu/cuối bên trong; chưa cho đi xuyên   |
| customers, delivery               | restricted                         | Chưa xác nhận đúng mục đích                                 |
| agricultural, forestry, emergency | restricted                         | Không mặc định áp dụng cho người dùng phổ thông             |
| unknown, \*, giá trị ghép/lạ      | unresolved                         | Không tự mở quyền                                           |

`destination` không có nghĩa đường không tồn tại hoặc cấm mọi lượt tiếp cận. Phiên bản này chưa xử lý
khu vực tiếp cận đầu/cuối; vì vậy có thể chưa tìm được tuyến đến địa chỉ nằm trên loại đường đó.

## 5. Mặc định khi không có tag áp dụng

Ký hiệu: A = allowed theo giả định; F = forbidden theo mô hình; U = unresolved; X = excluded.

| highway                                           | Ô tô | Xe máy | Đi bộ |
| ------------------------------------------------- | ---- | ------ | ----- |
| primary, secondary, tertiary                      | A    | A      | A     |
| primary_link, secondary_link, tertiary_link       | A    | A      | U     |
| residential, unclassified, living_street, service | A    | A      | A     |
| trunk, trunk_link                                 | U    | U      | U     |
| footway, pedestrian, path                         | F    | F      | A     |
| cycleway                                          | F    | F      | U     |
| track                                             | U    | U      | A     |
| steps, corridor                                   | X    | X      | A     |
| road hoặc loại chưa biết                          | U    | U      | U     |
| construction, proposed, abandoned, disused, razed | X    | X      | X     |
| platform, busway                                  | X    | X      | X     |
| motorway, motorway_link                           | X    | X      | X     |

**Giải thích phạm vi**:

- `service` không tự động nghĩa là công cộng. Tag private/customers/destination vẫn được xét trước mặc định.
- Không có width không tự suy ra ô tô đi vừa ngõ. Khả năng vật lý được kiểm tra ở bước khác.
- Đi bộ trên đường chung là giả định về mạng đi bộ, không khẳng định có vỉa hè hoặc chỗ sang đường an toàn.
- motorway và motorway_link tạm loại **tất cả** cấu hình để giới hạn bản đô thị đầu tiên;
  đây không phải kết luận ô tô bị cấm trên cao tốc. Có thể mở rộng ở phiên bản sau với dữ liệu/quy tắc phù hợp.
- trunk không được đồng nhất với motorway hoặc đường cao tốc chỉ từ tên loại OSM.
- steps/corridor cho xe cơ giới nằm ngoài năng lực mô hình dù có tag cho phép bất thường; cần rà soát.

Thuộc tính phương tiện cụ thể có thể ghi đè mặc định F/U (trừ loại bị X do phạm vi).
Ví dụ `footway + motorcycle=yes` được đánh allowed có cảnh báo cần kiểm tra.
Riêng `access=yes` chung không đủ để mở loại F/U: footway+access=yes không mở cho ô tô.
Chính sách này bảo thủ, được ghi rõ trong reason và warning; không phải mọi bộ định tuyến đều xử lý giống nhau.

## 6. Điều kiện, chiều và giới hạn chưa xử lý

- Có các khóa access thuộc chuỗi của phương tiện kèm hậu tố như `:conditional`, `:forward`, `:backward`, `:lanes`:
  trả unresolved cho phương tiện liên quan, giữ nguyên dữ liệu để xử lý sau.
- `hgv:conditional` không tự tác động cấu hình ô tô con; `motor_vehicle:conditional` không tự tác động đi bộ.
- `motorroad=yes` trên hồ sơ xe máy/đi bộ trả unresolved để chờ quy tắc địa phương.
- `oneway`, `oneway:conditional` chưa được diễn giải ở giai đoạn quyền way này.
- Quan hệ restriction, except và from/via/to chưa được áp dụng. Không được đọc no_left_turn rồi cấm mọi phương tiện.
- Barrier chưa được áp dụng: cổng có thể làm lượt đi bị chặn dù way-access là allowed.
- maxwidth, maxheight, maxweight, bề mặt, độ dốc, ngập chưa xét.

Vì vậy CSV chỉ có `through_eligible_by_way_access`, không có cột khẳng định tuyến có thể đi được.

## 7. Thứ tự xử lý trong mô-đun

1. Loại bản ghi ngoài phạm vi: không highway, area=yes, loại loại trừ, lifecycle không hoạt động.
2. Loại steps/corridor khỏi cấu hình xe cơ giới.
3. Phát hiện quyền theo chiều/làn/điều kiện chưa xử lý; giữ unresolved.
4. Xét motorroad đặc biệt cần rà soát.
5. Chọn khóa access cụ thể nhất.
6. Diễn giải giá trị; nếu không có khóa thì dùng mặc định theo highway.
7. Ghi kết quả cùng nguồn, reason, warning và phiên bản cấu hình.

Loại theo phạm vi trước không đồng nghĩa phủ nhận ngoại lệ pháp lý; nó thể hiện phần mềm chưa hỗ trợ đối tượng đó.

## 8. Cấu hình và báo cáo

- access-rules.v1.json: các chuỗi kế thừa, giá trị và bảng mặc định có thể phiên bản hóa.
- access_rules.py: bộ phân loại và công cụ chạy báo cáo trên snapshot khảo sát.
- test_access_rules.py: kiểm tra kế thừa, ngoại lệ và trường hợp chưa rõ.
- way-access.csv: một quyết định cho mỗi (OSM way, phương tiện), có nguyên nhân và tag đã xét.
- access-summary.csv: thống kê năm trạng thái, mẫu số là số way trong vùng phục vụ.
- access-rule-sources.csv: thống kê quyết định từ tag hay bảng mặc định.
- highway-defaults.csv: bảng mặc định đọc bằng Excel.
- rules-used.json + metadata.json: cấu hình, hash và phiên bản dữ liệu dùng để chạy lại.

Hai phiếu người dùng đã tạo chỉ là ghi nhận rà soát. Không dùng chúng tự động đổi tag hoặc mở quyền.

## 9. Căn cứ và các mục cần kiểm chứng

- https://wiki.openstreetmap.org/wiki/Key:access — phân cấp và ý nghĩa giá trị.
- https://wiki.openstreetmap.org/wiki/Key:motorcycle — phạm vi nhánh motorcycle.
- https://wiki.openstreetmap.org/wiki/Conditional_restrictions — quyền theo điều kiện.
- https://wiki.openstreetmap.org/wiki/OSM_tags_for_routing/Access_restrictions — mặc định phụ thuộc bối cảnh/quốc gia, không có một bảng toàn cầu luôn đúng.

Cần rà soát thêm trước khi tuyên bố áp dụng ngoài thực tế: quy tắc Việt Nam, các đoạn có ngoại lệ,
quyền trên trunk/link, tiếp cận destination/private, barrier, và cách ánh xạ lối đi bộ.
Không gán tỷ lệ chính xác pháp lý từ kết quả phân loại tự động.
