# Dọn cấu trúc trước khi chuyển sang Node.js

Đã rà ZIP DATN-feature-nodejs-routing.zip người dùng gửi. Chưa nhập gói Node OSM Stage1 vào bản này.

## Dùng

Giải nén gói này tại gốc E:\hanoi-flood-routing. Không cần npm install. Đóng các tiến trình build đang chạy rồi:

```powershell
node server/scripts/maintenance/archive-unused.mjs
node server/scripts/maintenance/archive-unused.mjs --apply
git status
```

Lần đầu chỉ xem trước. --apply chuyển đúng sáu file ra thư mục E:\hanoi-flood-routing-archive\<timestamp> (nếu repo ở E:\hanoi-flood-routing). Không xóa vĩnh viễn. Trước khi chuyển kiểm tra hash từ bản ZIP được rà soát; file đã thay đổi thì dừng, không lấy bản ZIP đè lên file máy người dùng. Chạy lại sau khi đã chuyển sẽ bỏ qua file không còn tồn tại. Có manifest ghi các file đã chuyển, kể cả khi lần chạy bị gián đoạn.

## Chuyển ra ngoài

- client/src/assets/hero.png, react.svg, vite.svg: không có tham chiếu trong bản mã nguồn đã kiểm tra.
- client/src/components/RoutingCheck.jsx: component thử nghiệm chưa được import hoặc gắn route trong bản gửi.
- server/scripts/check-routing.js và check-avoidance.js: script thử OpenRouteService cũ; không được app.js hoặc package scripts gọi. Giữ bản lưu bên ngoài để tham khảo, không coi như mất tính năng định tuyến đang dùng.

Không gỡ @turf/turf hoặc sửa package-lock.json ở bước này; tránh thay đổi dependency ngoài phạm vi. Hai biến ORS trong .env.example giữ làm tham chiếu; không đọc/sửa file .env thật.

## Giữ lại

- client, server: luồng ngập, bản đồ, tìm địa điểm, báo cáo, xác thực và admin đang dùng.
- App.css được main.jsx import; favicon.svg được index.html dùng. Không được xóa theo suy đoán là file mẫu.
- FloodEvent, FloodObservation, FloodReport, SourceArticle, RoutingAvoidance, User: các model hiện tại hoặc phục vụ kế hoạch; không coi model chưa có API riêng là vô dụng.
- tools/osm-survey và tools/routing-rules: bản Python, cấu hình quy tắc, kiểm thử và bằng chứng; giữ nguyên đường dẫn cho đối chiếu Node và tài liệu cũ.
- docs, KET_QUA_KHAO_SAT.md: giữ; chưa đổi tên docs/osm-surve vì có thể ảnh hưởng đường dẫn đã dùng.
- .gitignore, package.json, lockfiles, .env.example: giữ. node_modules và .env thật không có trong ZIP được gửi; không can thiệp vào máy người dùng.
- data trên máy: không có trong ZIP; đặc biệt không xóa hoặc giả định đã được sao lưu bởi Git.

## Tài liệu cá nhân ở gốc máy người dùng

Ảnh Explorer trước đó có ngap.docx, phiếu giao nhiệm vụ .xlsx, ZIP tải về và file khóa ~$.... Chúng không có trong ZIP repo này. Chuyển các tài liệu/ZIP ra thư mục đồ án riêng bằng File Explorer nếu muốn gọn; đóng Word/Excel để file khóa tự mất. Script không động đến tài liệu cá nhân.

## Kiểm tra đã thực hiện

Tìm tham chiếu cả repo (không chỉ thư mục cùng cấp), kiểm tra app.js, AppRoutes.jsx, main.jsx, index.html và package scripts. Chạy script xem trước và --apply trên bản sao ZIP, đối chiếu hash các file còn lại để bảo đảm không bị thay đổi. Không xác nhận chạy MERN đầy đủ vì gói không có dependencies, .env và kết nối MongoDB; chưa chạy npm build/lint trên bản này.

Đây chỉ là dọn cấu trúc, chưa chuyển Dijkstra hoặc sửa các chức năng ngập. Tiếp theo mới nhập mã Node phân tích OSM vào cấu trúc server hiện có.
