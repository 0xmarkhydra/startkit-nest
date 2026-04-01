const email = process.argv[2];

if (!email) {
  console.error("Lỗi: Vui lòng cung cấp địa chỉ email.");
  console.log("Sử dụng: node scripts/generate-key.js <email>");
  process.exit(1);
}

const BASE_URL = 'http://localhost:8000';
const DEFAULT_PASSWORD = 'AutoPassword123!';

async function generateKey() {
  try {
    let accessToken;
    let userId;

    console.log(`[1] Đang xử lý tài khoản cho email: ${email}...`);
    // 1. Thử đăng ký mới
    let response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: DEFAULT_PASSWORD }),
    });

    let result = await response.json();

    if (response.ok) {
      console.log(`    -> Đăng ký thành công!`);
      accessToken = result.data.accessToken;
    } else if (result.statusCode === 409 || response.status === 409 || result?.message?.includes("exists")) {
      // 2. Nếu đã tồn tại tài khoản hoặc thông báo lỗi, thử đăng nhập
      console.log(`    -> Tài khoản đã tồn tại. Thử đăng nhập bằng mật khẩu mặc định...`);
      response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: DEFAULT_PASSWORD }),
      });
      result = await response.json();

      if (!response.ok) {
        throw new Error("Tài khoản đã tồn tại nhưng mật khẩu không khớp hoặc đăng nhập thất bại.");
      }
      console.log(`    -> Đăng nhập thành công!`);
      accessToken = result.data.accessToken;
    } else {
       throw new Error(`Đăng ký thất bại: ${JSON.stringify(result)}`);
    }

    if (!accessToken) {
      throw new Error("Không lấy được accessToken. Trạng thái phản hồi không hợp lệ.");
    }

    console.log(`[2] Đang tạo API Key...`);
    // 3. Tạo API key
    const apiKeyResponse = await fetch(`${BASE_URL}/api-keys`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ name: `Key-${Date.now()}` }),
    });

    const apiKeyResult = await apiKeyResponse.json();

    if (!apiKeyResponse.ok) {
      throw new Error(`Tạo API key thất bại: ${JSON.stringify(apiKeyResult)}`);
    }

    const newKey = apiKeyResult.data?.key || apiKeyResult.data?.fullKey || apiKeyResult.data?.apiKey;

    console.log(`\n========================================`);
    console.log(`✅ THÀNH CÔNG!`);
    console.log(`========================================`);
    console.log(`Tài khoản : ${email}`);
    console.log(`Mật khẩu  : ${DEFAULT_PASSWORD}`);
    console.log(`API Key   : ${newKey || "Không parse được key. Xem payload gốc:" + JSON.stringify(apiKeyResult.data)}`);
    console.log(`========================================`);
    console.log(`(Hãy copy API Key phía trên và dán phần mềm của bạn)\n`);

  } catch (error) {
    console.error(`\n❌ Đã xảy ra lỗi: ${error.message}\n`);
    process.exit(1);
  }
}

generateKey();
