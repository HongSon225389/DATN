# Quy tắc chuyển hướng — hanoi-turn-0.1.0

Phần bổ sung sau access 0.1 và direction 0.1. Đây là chuẩn hóa dữ liệu quan hệ OSM,
chưa dựng graph hoặc xác minh biển báo thực tế. Không sửa bảng quyền đi, chiều, viewer hoặc dữ liệu gốc.

## 1. Chuyển hướng là ràng buộc giữa hai đoạn

Đường B có thể được phép đi nhưng không được rẽ vào B từ đường A tại nút V.
Không giải quyết cấm rẽ bằng việc cấm toàn bộ B hoặc xóa nút V.

Một quan hệ gồm:

| Thành viên | Vai trò                       |
| ---------- | ----------------------------- |
| from       | Way bắt đầu chuyển hướng      |
| via        | Nút hoặc chuỗi way trung gian |
| to         | Way kết thúc chuyển hướng     |

Mô-đun 0.1 chuẩn hóa **một from-way / một via-node / một to-way tĩnh** khi ánh xạ không mơ hồ.
Via-way, chuỗi nhiều way, điều kiện thời gian và no_entry/no_exit được giữ chờ xử lý.
Không dùng điểm đại diện via-way trên viewer để giả lập nó thành via-node.

## 2. Phạm vi phương tiện

| Phương tiện | Ưu tiên khóa                                                                           |
| ----------- | -------------------------------------------------------------------------------------- |
| Ô tô        | restriction:motorcar → restriction:motor_vehicle → restriction:vehicle → restriction   |
| Xe máy      | restriction:motorcycle → restriction:motor_vehicle → restriction:vehicle → restriction |
| Đi bộ       | restriction:foot                                                                       |

Một khóa được xét nếu có giá trị tĩnh hoặc `:conditional` tương ứng.
Restriction chung của xe không tự áp dụng cho người đi bộ. Thiếu restriction:foot không chứng minh
được đi bộ qua nút: access/chiều/barrier vẫn phải kiểm tra.
Các khóa nhóm là chính sách kế thừa bộ xử lý; không khẳng định mọi tổ hợp đều có trong snapshot.

## 3. Ngoại lệ except

Tách bằng dấu chấm phẩy, bỏ khoảng trắng. Không coi moped/bicycle/mofa là motorcycle.

| Token áp dụng              | Cấu hình                          |
| -------------------------- | --------------------------------- |
| motorcar                   | Ô tô                              |
| motorcycle                 | Xe máy                            |
| motor_vehicle hoặc vehicle | Hai nhóm xe cơ giới trong mô hình |
| foot                       | Đi bộ nếu có hạn chế riêng        |

Ví dụ `except=bicycle;moped;motorcar;motorcycle`: hạn chế chung không áp dụng cho hai cấu hình xe.
Ngoại lệ chỉ miễn quan hệ rẽ đó, không mở access hoặc cho đi ngược chiều.
Nếu except và restriction theo đúng phương tiện cùng xuất hiện mâu thuẫn, giữ unresolved để rà soát.
Token lạ hoặc `except:conditional` chưa được tự diễn giải.

## 4. Các loại tĩnh hỗ trợ

| Giá trị                                           | Tác động trên chuyển tiếp khớp from/via/to             |
| ------------------------------------------------- | ------------------------------------------------------ |
| no_left_turn, no_right_turn, no_straight_on       | Cấm chuyển tiếp mục tiêu                               |
| no_u_turn                                         | Cấm chuyển tiếp quay đầu được quan hệ mô tả            |
| only_left_turn, only_right_turn, only_straight_on | Sau hướng vào phù hợp, chỉ được chuyển tới mục tiêu    |
| only_u_turn                                       | Sau hướng vào phù hợp, chỉ được quay đầu theo mục tiêu |

Không suy hướng trái/phải bằng góc đơn giản rồi thay thế dữ liệu quan hệ.
Loại quan hệ xác định cách hạn chế; thành viên và topology xác định chuyển tiếp.
Không áp dụng only*\* cho người đi từ mọi hướng tới cùng nút: chỉ xét đúng hướng vào from.
Một mục tiêu được only*\* cho phép vẫn có thể bị access/chiều/ngập chặn; khi đó có thể không còn tuyến.

## 5. Định danh đoạn nguồn để không nhầm quay đầu

Đoạn nguồn lưu bộ:

`(way_id, segment_index, direction, from_node, to_node)`

segment_index là vị trí cặp nút kề nhau trong **way gốc**, không phải edgeId của graph đã đơn giản hóa.
Sau này khi chia/gộp cạnh graph cần giữ ánh xạ này, không chỉ giữ way_id.

Ví dụ way `[A,V,B]`, quan hệ `from=to=way` và `no_u_turn`:

- Vào bằng đoạn A→V, quay lại V→A bị cấm.
- Đi tiếp V→B không bị cấm chỉ bởi quan hệ này.
- Vào B→V thì trường hợp quay đầu V→B được xử lý riêng.

Đây là lý do không thể lấy fromWay==toWay để cấm mọi chuyển động trên way đó.

Với from và to khác nhau, nếu via ở giữa way hoặc way khép kín tạo nhiều hướng vào/ra,
phiên bản 0.1 giữ unresolved thay vì áp dụng cùng một lệnh cho mọi nhánh.

## 6. Điều kiện và trường hợp chưa hỗ trợ

- Có restriction:conditional liên quan: giữ unresolved, không coi tag tĩnh là luôn có hiệu lực.
- Ngoại lệ except tĩnh phù hợp có thể miễn hạn chế chung có điều kiện.
- Điều kiện taxi/bus riêng không tự áp dụng ô tô con hoặc xe máy.
- Giá trị đặt sai dạng `restriction=no_left_turn @ (...)` vẫn được giữ unresolved, không tự sửa.
- Via-way/chuỗi via cần trạng thái nhớ chuỗi cạnh; hiện chưa chuẩn hóa thành lệnh tại một nút.
- no_entry/no_exit có thể có nhiều from/to; chưa hỗ trợ trong mô-đun này.
- Thiếu thành viên, không nối via, vai trò bất thường hoặc nhiều only\_\* mục tiêu mâu thuẫn đều được ghi lại.

Không có tham số giờ khởi hành. Chưa thể khẳng định đã hỗ trợ cấm rẽ theo giờ.

## 7. Trạng thái của từng quan hệ/phương tiện

| Trạng thái     | Ý nghĩa                                                         |
| -------------- | --------------------------------------------------------------- |
| ready          | Đã chuẩn hóa thành mẫu chuyển tiếp tĩnh, chưa gắn vào graph     |
| exempt         | Phương tiện được miễn bởi except của quan hệ chung              |
| not_applicable | Không có quy tắc áp dụng cấu hình này                           |
| unresolved     | Có quy tắc liên quan nhưng chưa diễn giải đầy đủ/đang mâu thuẫn |
| invalid        | Thiếu thành viên hoặc topology không hợp lệ trong dữ liệu       |

Trạng thái là kết quả theo phương tiện: một quan hệ có thể exempt cho xe máy, ready cho ô tô.
not*applicable/exempt không xác nhận topology quan hệ đúng, chỉ nói nó không tạo ràng buộc cho cấu hình đó.
Hai quan hệ only*\* cùng hướng vào nhưng không có mục tiêu chung được giữ unresolved;
không tự chọn một quan hệ, cũng không tự hợp nhất mục tiêu để mở quyền.

## 8. Hàm kiểm tra chuyển tiếp đã có

`evaluate_transition(records, profile, incoming, outgoing)` dùng cho kiểm thử/tích hợp sau:

- Hai đoạn không nối nhau: invalid_transition.
- Khớp lệnh cấm tĩnh: forbidden.
- Có quan hệ chờ xử lý gắn được vào hướng vào: unresolved.
- Không bị các lệnh đã đánh giá chặn: not_blocked_by_evaluated_rules.

Kết quả cuối **không phải allowed**. Nếu còn quan hệ chờ xử lý không định vị được vào một hướng vào,
trả danh sách `unlocated_pending_relations` và `coverage_complete=false` để không giấu thiếu sót.
Hàm này không kiểm tra access/chiều của incoming hoặc outgoing. Đó là các bước riêng cần kết hợp khi dựng graph.

Khi làm graph/API, không được bỏ qua unresolved/invalid và tuyên bố tuyến tuân thủ đầy đủ:
cần xử lý bổ sung hoặc loại chuyển tiếp/phạm vi chưa được hỗ trợ bằng chính sách rõ ràng.
Đặc biệt, trạng thái nhớ cạnh vào đủ cho via-node; via-way cần mở rộng trạng thái nhớ chuỗi.

## 9. Báo cáo

| File                       | Nội dung                                                  |
| -------------------------- | --------------------------------------------------------- |
| turn-rules.normalized.json | Toàn bộ quyết định và mẫu đoạn nguồn, giữ tags/members    |
| turn-relations.csv         | Một dòng cho mỗi quan hệ/phương tiện, trạng thái và lý do |
| turn-summary.csv           | Tổng số theo từng phương tiện và trạng thái               |
| rules-used.json            | Cấu hình được dùng                                        |
| metadata.json              | Phiên bản, hash, số quan hệ và phạm vi                    |

Lấy mọi quan hệ type=restriction từ snapshot gốc. Bộ đang dùng có 821 quan hệ trong toàn phản hồi,
gồm vùng đệm và phần phụ thuộc; không gọi là 821 quan hệ riêng trong vùng phục vụ.
Mỗi quan hệ có ba quyết định nên tổng 2.463, không phải số nút/cạnh hoặc số lệnh cấm ngoài thực tế.
Hash bản gốc được đối chiếu metadata trước khi chạy.

## 10. Nguồn kỹ thuật

- https://wiki.openstreetmap.org/wiki/Relation:restriction
- https://wiki.openstreetmap.org/wiki/Tag:restriction=no_u_turn
- https://wiki.openstreetmap.org/wiki/Conditional_restrictions

Ngữ nghĩa nguồn được kết hợp với các lựa chọn bảo thủ của mô hình. Chưa xác minh độ đầy đủ,
độ mới hoặc tính đúng pháp lý của dữ liệu ngoài thực tế.
