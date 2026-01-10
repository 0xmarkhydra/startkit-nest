import axios from 'axios';

// Test với example từ user
const API_URL = 'https://polymarket.com/api/crypto/crypto-price';

async function testCryptoPriceAPI() {
  // Example từ user: eventStartTime=2026-01-07T22:45:00Z, endDate=2026-01-07T23:00:00Z
  const symbol = 'BTC';
  const eventStartTime = '2026-01-07T22:45:00Z';
  const endDate = '2026-01-07T23:00:00Z';
  
  // Convert to Unix timestamps for comparison
  const startTimestamp = Math.floor(new Date(eventStartTime).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
  
  console.log('=== Test Crypto Price API ===');
  console.log(`Symbol: ${symbol}`);
  console.log(`eventStartTime (ISO): ${eventStartTime}`);
  console.log(`eventStartTime (Unix): ${startTimestamp}`);
  console.log(`endDate (ISO): ${endDate}`);
  console.log(`endDate (Unix): ${endTimestamp}`);
  
  // Test 1: Original format từ user
  console.log('\n--- Test 1: Original format (exact from user example) ---');
  const url1 = `${API_URL}?symbol=${symbol}&eventStartTime=${encodeURIComponent(eventStartTime)}&variant=fifteen&endDate=${encodeURIComponent(endDate)}`;
  console.log(`URL: ${url1}`);
  
  try {
    const response1 = await axios.get(url1);
    console.log('Response:', JSON.stringify(response1.data, null, 2));
    console.log(`OpenPrice from API: ${response1.data.openPrice}`);
    console.log(`Expected: 90,661.13`);
    console.log(`Match: ${response1.data.openPrice === 90661.13 || response1.data.openPrice === 90661.13000000001 ? '✅' : '❌'}`);
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
  
  // Test 2: Format mới (không có milliseconds)
  console.log('\n--- Test 2: Format mới (không có milliseconds) ---');
  const timestampToISO = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
  };
  
  const startISO2 = timestampToISO(startTimestamp);
  const endISO2 = timestampToISO(endTimestamp);
  const url2 = `${API_URL}?symbol=${symbol}&eventStartTime=${encodeURIComponent(startISO2)}&variant=fifteen&endDate=${encodeURIComponent(endISO2)}`;
  console.log(`Start ISO: ${startISO2}`);
  console.log(`End ISO: ${endISO2}`);
  console.log(`URL: ${url2}`);
  
  try {
    const response2 = await axios.get(url2);
    console.log('Response:', JSON.stringify(response2.data, null, 2));
    console.log(`OpenPrice from API: ${response2.data.openPrice}`);
    console.log(`Expected: 90,661.13`);
    console.log(`Match: ${Math.abs(response2.data.openPrice - 90661.13) < 0.01 ? '✅' : '❌'}`);
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
  
  // Test 3: Check nếu dùng timestamps từ market_registry
  console.log('\n--- Test 3: Check với timestamps thực tế từ market ---');
  // Ví dụ: market slug là btc-updown-15m-{timestamp}
  // Nếu timestamp trong slug là start timestamp
  const marketStartTimestamp = 1736293500; // Example - cần check với record thực tế
  const marketEndTimestamp = marketStartTimestamp + 900; // 15 minutes later
  
  const startISO3 = timestampToISO(marketStartTimestamp);
  const endISO3 = timestampToISO(marketEndTimestamp);
  console.log(`Market Start Timestamp: ${marketStartTimestamp}`);
  console.log(`Market End Timestamp: ${marketEndTimestamp}`);
  console.log(`Start ISO: ${startISO3}`);
  console.log(`End ISO: ${endISO3}`);
  
  const url3 = `${API_URL}?symbol=${symbol}&eventStartTime=${encodeURIComponent(startISO3)}&variant=fifteen&endDate=${encodeURIComponent(endISO3)}`;
  console.log(`URL: ${url3}`);
  
  try {
    const response3 = await axios.get(url3);
    console.log('Response:', JSON.stringify(response3.data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testCryptoPriceAPI().catch(console.error);

