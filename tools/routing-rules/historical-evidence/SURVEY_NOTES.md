# Tiếp nhận nguồn ngập lịch sử — 29/10/2026

Đây là hồ sơ khảo sát, không phải dữ liệu ngập hiện hành và chưa phải lớp đóng đường. Toàn bộ bản ghi pending, published=false, applied_to_routing=false. Không truyền intake-20250930.json vào --flood; hai lược đồ khác nhau.

## Năm trường hợp ban đầu

| Mã | Vị trí báo nêu | Nguồn | Còn cần xác định |
|---|---|---|---|
| HIST-01 | Thái Hà – Tây Sơn – Chùa Bộc | Thanh Niên | Phạm vi dưới cầu vượt; tách khỏi mặt cầu cao |
| HIST-02 | Nguyễn Khuyến, gần trường Lý Thường Kiệt | TTXVN | Vị trí cổng và giới hạn đoạn ảnh hưởng |
| HIST-03 | Bùi Xương Trạch, số nhà 49–93 | TTXVN | Đối chiếu địa chỉ với cạnh đường |
| HIST-04 | Vũ Trọng Phụng, hướng Nguyễn Trãi | Kinh tế & Đô thị | Vị trí ảnh và hai đầu phần ngập |
| HIST-05 | Phùng Hưng | Dân trí | Đoạn cụ thể và giờ ghi nhận riêng ảnh |

HIST-01 có khoảng độ sâu được nguồn nêu, lưu nguyên khoảng và phần sâu cục bộ trong JSON, không lấy trung bình thành số đo chính xác. Những mức mô tả theo bánh xe không quy đổi thành cm. Các bài nguồn ghi nhận ngập ngày 30/9/2025; giờ đăng bài không đồng nghĩa giờ bắt đầu hay kết thúc ngập.

## Nguồn đã đọc

- Thanh Niên, đăng 30/9/2025 14:20 +07: [Bài ghi nhận ngập trên đường phố](https://thanhnien.vn/duong-pho-ha-noi-ngap-sau-nua-met-hang-loat-xe-mac-ket-185250930140153422.htm).
- Báo Tin tức và Dân tộc / TTXVN, đăng 30/9/2025 19:38: [Báo cáo các điểm ngập](https://baotintuc.vn/ha-noi-82-diem-ngap-ung-huy-dong-toi-da-luc-luong-tieu-thoat-nuoc-n20250930193603354.htm).
- Kinh tế & Đô thị, trang hiển thị 30/9/2025 12:33: [Bài tổng hợp diễn biến mưa và ngập](https://kinhtedothi.vn/ha-noi-mua-lon-dong-loc-set-ngap-ung-keo-dai-trong-ngay-30-9.859776.html).
- Dân trí, trang mang giờ đăng 12:42 ngày 30/9/2025 nhưng phần mở đầu nhắc sau 20h cùng ngày: [Bài ghi nhận diễn biến ngập và giao thông](https://dantri.com.vn/thoi-su/ha-noi-giam-mua-nhung-moi-tuyen-duong-van-tac-khong-loi-thoat-20250930123750553.htm). Có dấu hiệu nội dung cập nhật trong ngày, không gán một timestamp duy nhất cho mọi quan sát.

Truy cập nguồn ngày 29/10/2026. Hồ sơ chỉ lưu URL, metadata và tóm tắt phân tích; không sao chép toàn bài/ảnh báo.

## Phân biệt ghi nhận và cảnh báo

[Bài cảnh báo của Báo Điện tử Chính phủ](https://thanglong.baochinhphu.vn/ha-noi-canh-bao-ngap-ung-hon-30-diem-noi-do-103250930111132503.htm) có danh sách vị trí nguy cơ. Không dùng riêng danh sách nguy cơ làm bằng chứng từng đoạn đang ngập; không dùng dự báo độ sâu cho một điểm như số đo thực tế.

## Gợi ý đối chiếu graph

candidate_way_ids_by_name_only được tìm bằng tên đường không dấu trong graph ô tô hiện có. Có thể bao gồm ngõ, đường phụ cùng tên hoặc đoạn ở xa địa điểm được báo nêu. Đây không phải toàn bộ way OSM gốc, không phải danh sách cạnh cần chặn, không chứng minh phạm vi ngập. Tuyệt đối không áp toàn bộ những ID này vào lớp tránh ngập.

Nên bắt đầu với HIST-02 (mốc trường học) và HIST-03 (khoảng địa chỉ), sau đó HIST-01 (phải phân biệt tầng cầu). Cần định vị mốc từ nguồn bản đồ công khai, ghi cách xác định, sai số, cạnh được chọn và phần chưa chắc chắn. Việc có số nhà hoặc nút giao chưa đủ chứng minh ranh polygon ngập.

Nguồn sự kiện là năm 2025, snapshot đường là 28/10/2026: nếu dùng mạng 2026 để tái hiện thì chỉ được gọi là kịch bản dựa trên sự kiện lịch sử trên mạng đường 2026. Không chứng minh tuyến thực tế đã hợp lệ vào năm 2025. Không chuyển thời điểm ngập sang 2026 chỉ để khớp graph thử nghiệm. valid_from/valid_until còn null vì chưa có căn cứ, không tự bịa thời điểm nước rút.

## Điều kiện chuyển sang bộ kiểm thử có nguồn

1. Đối chiếu nguồn và ghi chính xác loại bằng chứng, giờ/ngày và mức chắc chắn.
2. Xác định footprint hoặc danh sách đoạn ảnh hưởng, tầng/cầu/hầm và người rà soát.
3. Chốt khoảng hiệu lực có căn cứ; nếu chỉ là cửa sổ thử nghiệm do nghiên cứu chọn, gắn nhãn giả định và không mô tả là thời gian ngập đã được nguồn chứng minh.
4. Giữ các bản ghi thiếu dữ kiện ở intake; chỉ xuất lớp định tuyến riêng khi đã đủ điều kiện.
5. Chạy và lưu đối chiếu tuyến, cạnh bị chặn, lỗi còn tồn đọng, giả định của mạng đường. Không ghi đè bộ test giả lập.
