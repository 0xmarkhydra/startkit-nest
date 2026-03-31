<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" />
</p>

<h1 align="center">LynxAI OpenRouter Forwarder (Proxy Server)</h1>

<p align="center">
  <b>Hệ thống API Gateway đóng vai trò trung gian chuyển tiếp (Forwarder) các yêu cầu AI từ khách hàng đến OpenRouter API.</b>
</p>

---

## 📖 Ý tưởng & Mô hình Kinh doanh (The Concept)

Dự án này được xây dựng với mục đích kinh doanh **"bán lẻ API Key"** cho các mô hình AI. Thay vì khách hàng phải tự tạo tài khoản và mua Key trực tiếp từ OpenRouter, chúng ta sẽ cung cấp cho họ một API Key riêng (LynxAI Key) và định tuyến (route) thông qua server của chúng ta.

**Luồng hoạt động chính:**
1. Khách hàng sử dụng các ứng dụng hoặc gửi request đến server của chúng ta, truyền vào `LynxAI Key` thông qua Header.
2. Khách hàng yêu cầu sử dụng model mang thương hiệu của chúng ta (ví dụ: `LYNXAI.01`).
3. Server nhận request, **xác thực** `LynxAI Key` xem có hợp lệ và còn hạn mức (quota) hay không.
4. Server **ánh xạ (map)** model `LYNXAI.01` sang một model thực tế được hỗ trợ bởi OpenRouter (ví dụ: `openai/gpt-3.5-turbo`, `anthropic/claude-3-haiku`, v.v.).
5. Server sử dụng **Master OpenRouter Key** (chỉ lưu trên server, không bao giờ lộ cho khách hàng) để chuyển tiếp request đến OpenRouter.
6. Kết quả từ OpenRouter được trả về thẳng cho khách hàng.

### Tại sao lại dùng mô hình này?
* **Bảo mật:** Khách hàng không bao giờ biết được Master Key của OpenRouter.
* **Kiểm soát:** Dễ dàng giới hạn tốc độ (rate limit), tính cước (billing) và cấp phát key mới cho từng khách hàng.
* **Linh hoạt:** Có thể đổi model thực tế chạy ngầm phía sau `LYNXAI.01` bất cứ lúc nào mà không làm gián đoạn hệ thống của khách hàng.

---

## 🏛 Kiến trúc Hệ thống (Architecture)

```mermaid
sequenceDiagram
    participant Client as Khách hàng
    participant Server as LynxAI Proxy Server
    participant DB as Database (PostgreSQL)
    participant OpenRouter as OpenRouter API

    Client->>Server: POST /openrouter/chat/completions (Header: Bearer LYNXAI_KEY, Model: LYNXAI.01)
    Server->>DB: Xác thực LYNXAI_KEY (ApiKeyGuard)
    alt Key hợp lệ
        Server->>Server: Map model LYNXAI.01 -> openai/gpt-3.5-turbo
        Server->>OpenRouter: Chuyển tiếp request (Header: Bearer OPENROUTER_MASTER_KEY)
        OpenRouter-->>Server: Trả kết quả AI
        Server-->>Client: Trả kết quả chuẩn (StandardResponseDto)
    else Key không hợp lệ
        Server-->>Client: Lỗi 401 Unauthorized
    end
```

---

## 📁 Cấu trúc Thư mục Quan trọng

* `src/modules/api/openrouter/`
  * `openrouter.controller.ts`: Nơi tiếp nhận request `/openrouter/chat/completions`.
  * `openrouter.service.ts`: Xử lý logic ánh xạ tên Model (`mapModelName`) và dùng `axios` gọi sang OpenRouter.
  * `dto/chat-completion.dto.ts`: Định nghĩa và validation cho Body request.
* `src/shared/guards/`
  * `api-key.guard.ts`: Middleware/Guard chịu trách nhiệm chặn request, đọc Header `Authorization` và kiểm tra tính hợp lệ của `LynxAI Key`.
* `src/shared/dtos/`
  * `standard-response.dto.ts`: Cấu trúc chuẩn hóa dữ liệu trả về cho toàn bộ API.

---

## 🚀 Cài đặt & Khởi chạy (Dành cho Developer)

### 1. Yêu cầu môi trường
* Node.js (v18+)
* pnpm (ưu tiên sử dụng `pnpm` thay vì `npm`)
* Cơ sở dữ liệu: PostgreSQL, Redis

### 2. Cài đặt Dependencies
```bash
pnpm install
```

### 3. Cấu hình Biến môi trường (.env)
Tạo file `.env` từ `.env.sample` và điền các thông tin quan trọng. Đặc biệt chú ý phần OpenRouter:

```env
# Kết nối DB
DATABASE_URL=postgresql://user:pass@host:5432/db_name?sslmode=require
REDIS_URL=redis://host:port

# Cấu hình OpenRouter Forwarder
OPENROUTER_API_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxx  # Key gốc của bạn mua từ OpenRouter
```

### 4. Chạy ứng dụng

```bash
# Chế độ phát triển (Watch mode)
pnpm run start:dev

# Chế độ Production
pnpm run build
pnpm run start:prod
```

---

## 📚 Tài liệu API (Swagger)

Dự án áp dụng chặt chẽ các chuẩn tài liệu Swagger. 
Khi server đang chạy ở môi trường Local/Dev, truy cập vào đường dẫn sau để xem toàn bộ danh sách API, tham số truyền vào và dùng thử:

👉 **[http://localhost:8000/docs](http://localhost:8000/docs)**

*(Lưu ý: Để test API `/openrouter/chat/completions` trên Swagger, hãy bấm vào nút 🔒 **Authorize** và nhập các Key test đã được hardcode sẵn trong `ApiKeyGuard`, ví dụ: `sk-lynxai-test-key-1`).*

---

## 📝 Việc cần làm tiếp theo (Next Steps cho Dev mới)
- [ ] **Tích hợp Database cho Guard:** Hiện tại `ApiKeyGuard` đang dùng mảng hardcode để test. Cần kết nối với module User/Auth trong DB để xác thực Key động.
- [ ] **Quản lý Billing (Tính cước):** Mỗi khi OpenRouter trả về kết quả, cần lưu lại số lượng `tokens` đã sử dụng để trừ dần vào tài khoản/quota của User sở hữu LynxAI Key.
- [ ] **Stream Response:** Bổ sung hỗ trợ trả kết quả dạng stream (`Server-Sent Events`) nếu client gửi cờ `stream: true`. Hiện tại đang trả về toàn bộ text một lần (Blocking).
