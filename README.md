# Hanoi Flood Routing

Đồ án website tổng hợp thông tin ngập có nguồn và hỗ trợ
tìm đường tránh khu vực ngập tại Hà Nội.

## Công nghệ

- React và Vite
- Node.js và Express
- MongoDB và Mongoose

## Cấu trúc

- client/: frontend
- server/: backend

## Cài đặt

```bash
npm install
npm install --prefix client
npm install --prefix server
```

Sao chép client/.env.example thành client/.env.
Sao chép server/.env.example thành server/.env.

Điền MONGODB_URI nếu cần kết nối database.
Không đưa .env lên Git.

## Chạy phát triển

```bash
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:5000/api/health

## Kiểm tra frontend

```bash
npm run lint
npm run build
```

## Phạm vi

Thí điểm tại một khu vực thuộc Hà Nội.
Dự báo và phân tích ảnh thuộc hướng phát triển sau.
