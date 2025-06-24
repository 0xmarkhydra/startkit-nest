# Solana Staking Platform

Hệ thống staking USDC trên Solana với lãi suất 30% một năm.

## Tính năng

- Người dùng đăng nhập bằng ví Phantom (Solana)
- Gửi USDC vào một địa chỉ ví vault
- Đầu tư tối thiểu 1$
- Rút tiền sau 24h (không nhận lãi)
- Hiển thị số tiền người dùng nhận được hàng ngày
- Tính lãi suất 30% một năm

## Cài đặt

### Yêu cầu

- Node.js (v14+)
- PostgreSQL
- Redis

### Cài đặt thư viện

```bash
# Cài đặt các gói phụ thuộc
npm install

# Cài đặt thư viện Solana
./install-solana-deps.sh
```

### Cấu hình

Tạo file `.env` với nội dung sau:

```
# App
APP_ENV=development
PORT=3000
IS_API=1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=staking_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DATABASE=0
REDIS_FAMILY=4
```

### Khởi tạo cơ sở dữ liệu

```bash
# Tạo bảng stakings
npm run migration:run
```

## Chạy ứng dụng

```bash
# Chạy ở chế độ development
npm run start:dev

# Chạy ở chế độ production
npm run build
npm run start:prod
```

## API Endpoints

### Staking

- `POST /staking` - Tạo staking mới
- `POST /staking/withdraw` - Rút tiền staking
- `GET /staking/wallet/:walletAddress` - Lấy danh sách staking của một ví
- `GET /staking/active/:walletAddress` - Lấy danh sách staking đang hoạt động của một ví
- `GET /staking/:id` - Lấy thông tin staking theo ID

### Frontend

- `GET /staking-dashboard` - Trang dashboard staking
- `GET /public/staking.html` - Truy cập trực tiếp file HTML

## Cấu trúc dự án

```
├── public/
│   └── staking.html
└── src/
    ├── modules/
    │   ├── api/
    │   │   ├── controllers/
    │   │   │   ├── staking.controller.ts
    │   │   │   └── view.controller.ts
    │   │   ├── dtos/
    │   │   │   └── staking/
    │   │   │       ├── create-staking.dto.ts
    │   │   │       ├── withdraw-staking.dto.ts
    │   │   │       ├── get-stakings.dto.ts
    │   │   │       └── staking-response.dto.ts
    │   ├── business/
    │   │   ├── services/
    │   │   │   ├── staking.service.ts
    │   │   │   └── solana.service.ts
    │   │   └── interfaces/
    │   │       └── solana.interface.ts
    │   └── database/
    │       ├── entities/
    │       │   └── staking.entity.ts
    │       └── repositories/
    │           └── staking.repository.ts
```

## Luồng hoạt động

1. Người dùng đăng nhập bằng ví Phantom
2. Người dùng gửi USDC vào địa chỉ ví vault
3. Hệ thống xác minh giao dịch và tạo staking mới
4. Người dùng có thể xem thông tin staking và lợi nhuận hiện tại
5. Sau 24h, người dùng có thể rút tiền (không nhận lãi)
6. Sau 1 năm, người dùng nhận được tiền gốc + 30% lãi

## Phát triển trong tương lai

- Tích hợp với Solana Program để tự động hóa quá trình staking
- Thêm tính năng compounding (tái đầu tư lãi)
- Thêm tính năng rút một phần tiền
- Thêm các token khác ngoài USDC
- Tích hợp với các DEX để swap token 