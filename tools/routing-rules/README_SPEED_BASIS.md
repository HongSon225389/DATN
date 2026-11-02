# Khảo sát và ghi nguồn tốc độ

Phiên bản hanoi-speed-basis-0.1.0. Giải nén vào gốc dự án đã có gói barrier/speed và các gói trước. Không chỉnh OSM, bảng tốc độ hoặc router. Công cụ chạy ngoại tuyến; URL là thông tin nguồn được ghi lại, không tự tải hay xác thực nội dung URL.

## Chạy

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v

py -3 tools/routing-rules/speed_basis_survey.py --snapshot data/osm-survey/20261028T094314131389Z --at "2026-10-29T08:00:00+07:00" --output data/routing-speed-basis
```

165 tests: 150 cũ và 15 mới. Thêm `/data/routing-speed-basis/` vào .gitignore.

## Kết quả

| File | Mục đích |
|---|---|
| summary.csv | Số way có tag tốc độ/làn/chiều/ngữ cảnh và trạng thái giới hạn theo hồ sơ/chiều |
| speed-context.csv | Tên, loại đường, các tag ngữ cảnh, toàn bộ tags gốc dưới dạng JSON, liên kết OSM |
| speed-basis.csv | Giới hạn đọc từ OSM, nguồn OSM, tốc độ giả định ban đầu, tốc độ ước tính sau giới hạn, trạng thái và đề xuất từ phiếu |
| review-template.json | Tối đa ba way ID nhỏ nhất cho mỗi nhóm mẫu có dữ liệu; bản nháp để đối chiếu |
| speed-node-hints.json | Node có maxspeed hoặc traffic_sign chứa chữ maxspeed, toàn raw gồm vùng đệm/phụ thuộc; không tự gán giới hạn cho way |
| metadata.json | Snapshot, hash raw/GeoJSON/cấu hình/phiếu, thời điểm và phạm vi |

Mỗi way khảo sát có ba hồ sơ × hai chiều; chưa lọc access/oneway. Số dòng không phải số cạnh graph được phép đi. Có lanes không đồng nghĩa biết số làn dành cho xe cơ giới; có hai way song song không chứng minh đường đôi. lit, highway, urban, zone hoặc vị trí nội thành không tự xác lập khu đông dân cư theo biển báo. Chưa khảo sát đầy đủ biển khu đông dân cư, polygon địa giới hay sự tồn tại của dải phân cách.

Các node gợi ý biển chỉ là phép tìm tag giới hạn; biển ghi bằng mã khác có thể bị bỏ sót. Không tìm thấy node/tag không có nghĩa ngoài đường không có biển. Không dùng các gợi ý này để xác định đoạn hiệu lực.

## Phân biệt giá trị

- osm_limit_kmh: đọc theo quy tắc speed trước, còn nhãn osm_reported_unverified. Đây là dữ liệu cộng đồng trong snapshot, chưa xác minh độc lập.
- assumed_free_speed_kmh: tốc độ cơ sở giả định theo JSON.
- estimated_speed_kmh: tốc độ ước tính sau khi xét giới hạn OSM đọc được; không phải tốc độ đo hoặc giao thông thời gian thực.
- proposed_limit_kmh: đề xuất ghi trong phiếu; không ghi đè OSM hoặc tốc độ ước tính.
- verified_legal_limit_kmh: để trống ở giai đoạn này. Công cụ không tự chứng nhận pháp lý, kể cả phiếu tự đánh dấu reviewed.

unknown_missing nghĩa thiếu tag giới hạn áp dụng trong OSM, không phải chắc chắn không có biển. unknown_unsupported nghĩa tag/điều kiện chưa diễn giải được. Không có tốc độ giả định cho loại đường là vấn đề riêng với thiếu giới hạn nguồn.

## Điền phiếu mẫu

Sao chép review-template.json sang docs/routing/speed-evidence/<dataset-version>/review.json rồi sửa bản sao. Có thể thêm hồ sơ/chiều hoặc way khác trong phạm vi khảo sát; mỗi bộ way_id/profile/direction có một phiếu hiện hành. Không thay dataset_version. Mẫu không chứa bằng chứng giả hoặc kết luận có sẵn.

| Trường | Cách điền |
|---|---|
| profile / direction | car, motorcycle, walking; forward/backward theo thứ tự node OSM |
| sign_status | unknown mặc định; present khi có bằng chứng biển áp dụng; confirmed_absent chỉ khi đủ căn cứ loại trừ giới hạn riêng có hiệu lực cho đoạn, không chọn từ việc thiếu maxspeed |
| built_up_status | unknown / inside / outside; cần nguồn xác định phạm vi, không suy chỉ từ địa chỉ Hà Nội |
| road_layout / motor_lanes | unknown/divided/undivided_two_way/one_way; số làn xe cơ giới nếu xác định được |
| vehicle_class | Loại phương tiện thực tế đang xét; ví dụ passenger_car, motorcycle, pedestrian. Không tự gộp xe gắn máy vào hồ sơ motorcycle |
| proposed_limit_kmh | Số đề xuất hoặc null khi chưa đủ căn cứ; không điền tốc độ giả định vào đây |
| basis_kind | unknown; osm_comparison chỉ so dữ liệu OSM; sign_document có tài liệu/ảnh biển; general_rule có căn cứ để đối chiếu quy định chung |
| source_url / source_title | URL và tiêu đề tài liệu/ảnh/bài chính thức; có thể OSM nếu chỉ đối chiếu OSM |
| source_date | Ngày nguồn YYYY-MM-DD, hoặc timestamp có múi giờ; để trống nếu không biết |
| checked_at / reviewer | Thời điểm kiểm tra ISO có múi giờ và người rà soát; không thay thời điểm nguồn bằng thời điểm kiểm tra |
| review_status | draft khi chưa kiểm tra; reviewed là người điền đã rà soát, không tự chứng nhận nguồn chính xác |
| applies_to_whole_way | true chỉ khi đã xác định áp dụng cho toàn bộ way theo chiều/hồ sơ; nếu chỉ một đoạn, giữ false và mô tả phạm vi trong notes |
| valid_from / valid_until | Timestamp có múi giờ nếu biết hiệu lực; không biết để trống |
| condition | Điều kiện phụ/làn/giờ; công cụ chỉ ghi, chưa áp dụng điều kiện thủ công này |
| notes | Nội dung đã đối chiếu, căn cứ, vị trí bắt đầu/kết thúc, phần còn thiếu và mâu thuẫn |
| applied_to_routing | Luôn false trong giai đoạn này |

Ví dụ khi mới xem trang OSM: giữ sign_status=unknown, basis_kind=osm_comparison, proposed_limit_kmh=null nếu chưa có kết luận độc lập, ghi URL OSM và nhận xét “đối chiếu tag, chưa xác minh biển hoặc giới hạn riêng”. Không ghi confirmed_absent.

## Nạp phiếu để kiểm tra

```powershell
py -3 tools/routing-rules/speed_basis_survey.py --snapshot data/osm-survey/20261028T094314131389Z --at "2026-10-29T08:00:00+07:00" --evidence docs/routing/speed-evidence/osm-aaf249200a83d21e/review.json --output data/routing-speed-basis
```

Không cần điền hết phiếu để lần chạy đầu thành công. Khi nạp, kiểm tra trùng khóa, snapshot/way/hồ sơ/chiều, số, thời gian và các trường bắt buộc. reviewed cần URL http(s), người rà soát, giờ kiểm tra và notes. Kiểm tra hình thức không xác thực nội dung URL, thẩm quyền nguồn hoặc giá trị pháp lý.

evidence_flags chỉ ra bản nháp, thiếu phạm vi cả way, ngữ cảnh quy định chung chưa đủ, đối chiếu OSM không độc lập, đề xuất mâu thuẫn OSM, hết/chưa đến hạn và điều kiện thủ công chưa xử lý. Không có cờ cũng không chứng minh giới hạn đúng. Phiếu dùng ngày/địa bàn/loại xe phải được đối chiếu tài liệu có hiệu lực tương ứng trước bước áp dụng.

## Mẫu thật và mẫu kiểm thử

Mẫu chọn theo ID để tái lập, không đại diện thống kê và không được xác minh sẵn. Nếu nhóm directional/conditional trong summary bằng 0 thì snapshot khảo sát không có mẫu thuộc nhóm ấy; không tạo đường giả trong dữ liệu thật. Chức năng đó có kiểm thử tổng hợp trong test_speed_basis_survey.py, không được báo là kiểm chứng hiện trường.

## Tài liệu tham khảo cần đối chiếu khi rà soát

https://wiki.openstreetmap.org/wiki/Key:maxspeed

https://chinhphu.vn/?classid=1&docid=211873&pageid=27160

https://moc.gov.vn/vn/Pages/chitiettin.aspx?ChuyenmucID=1196&IDNews=96890&tieude=hop-nhat-thong-tu-quy-dinh-ve-toc-do-va-khoang-cach-an-toan-cua-xe-co-gioi-xe-may-chuyen-dung-tham-gia-giao-thong-tren-duong-bo.aspx

Gói này chỉ ghi nguồn và khảo sát, không mã hóa bảng giới hạn pháp luật hoặc suy 50/60 km/h.
