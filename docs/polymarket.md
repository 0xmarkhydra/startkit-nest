# Technical Specification: Polymarket Trading Bot (TypeScript/Node.js)

## 1. Project Overview
This project is an automated trading tool for Polymarket using TypeScript. It interacts with the Gamma API for market discovery and the CLOB API for order execution.

**Key Features:**
1.  **Market Discovery:** Fetch Event/Market details and Token IDs via Gamma API.
2.  **Order Execution:** Place Limit Orders and simulated Market Orders.
3.  **Position Management:** Calculate net positions and execute "Close Position" logic.
4.  **Real-time Data:** Listen to WebSocket feeds for order updates.

## 2. Tech Stack
* **Runtime:** Node.js (Latest LTS)
* **Language:** TypeScript
* **Core SDK:** `@polymarket/clob-client` (Official SDK for EIP-712 signing & API interaction).
* **HTTP Client:** `axios` (For Gamma API).
* **Utilities:** `dotenv` (Env vars), `ethers` (Wallet management).

---

## 3. Architecture & API Endpoints

### A. Gamma API (Market Data)
* **Base URL:** `https://gamma-api.polymarket.com`
* **Purpose:** Read-only metadata to map human-readable Events to executable Token IDs.
* **Key Endpoints:**
    * [cite_start]`GET /events`: Fetch events with filtering parameters[cite: 6].
    * [cite_start]`GET /markets`: Fetch market details including `clobTokenIds` and `enableOrderBook` status[cite: 31, 85].

### B. CLOB API (Execution)
* [cite_start]**Base URL:** `https://clob.polymarket.com` [cite: 69]
* **Authentication:**
    * [cite_start]**L1 (Headers):** `Polymarket-Api-Key`, `Polymarket-Api-Secret`, `Polymarket-Api-Passphrase`[cite: 69, 70].
    * [cite_start]**L2 (Signature):** EIP-712 signature derived from the Order Data using the user's Private Key (handled by SDK)[cite: 68].
* **Key Endpoints:**
    * [cite_start]`POST /order`: Place new orders (Requires L2 Auth)[cite: 92].
    * [cite_start]`DELETE /order`: Cancel specific order[cite: 108].
    * [cite_start]`GET /book`: Fetch Level 2 Orderbook (Bids/Asks) for price calculation[cite: 79].
    * [cite_start]`GET /trades`: Fetch trade history to calculate positions[cite: 121].

### C. WebSocket (Real-time)
* [cite_start]**URL:** `wss://ws-subscriptions-clob.polymarket.com/ws/`[cite: 135].
* **Channels:**
    * [cite_start]`user`: Listen for `event_type: "trade"` to confirm fills[cite: 223].
    * [cite_start]`market`: Listen for `event_type: "book"` for live pricing[cite: 168].

---

## 4. Feature Implementation Details

### Feature 1: Market Discovery (Gamma Service)
**Logic:**
1.  User inputs an Event Slug or ID.
2.  Call `GET /events?slug={slug}`.
3.  Extract `markets` array.
4.  **CRITICAL:** Retrieve `clobTokenIds` from the market object.
    * Note: `clobTokenIds` is an array `[token_id_1, token_id_2]`. Usually maps to `[NO, YES]` or outcomes. Validate against `outcomes` field.
    * [cite_start]Filter only markets where `enableOrderBook: true`[cite: 49].

### Feature 2: Order Execution (CLOB Service)
**1. Limit Order:**
* **Input:** `tokenId`, `price`, `size`, `side`.
* [cite_start]**Logic:** Call SDK `createAndPostOrder` with `orderType: "GTC"` (Good-Til-Cancelled)[cite: 95].

**2. Market Order (Simulated):**
* *Context:* CLOB does not have a native "Market" order type that guarantees a fill at any price.
* **Logic:**
    1.  [cite_start]Fetch Orderbook (`GET /book`) for the `tokenId`[cite: 79].
    2.  If Buying: Look at `asks` (Lowest Sell Prices). If Selling: Look at `bids` (Highest Buy Prices).
    3.  Calculate **Weighted Average Price** for the desired `size` OR pick the `best_price` + `slippage_tolerance`.
    4.  [cite_start]Execute a **Fill-Or-Kill (FOK)** order at that calculated price[cite: 96]. This ensures the order fills completely immediately or cancels if the price moves.

### Feature 3: Close Position
**Logic:**
1.  [cite_start]**Fetch History:** Call `GET /trades` with `market` (Condition ID) parameter[cite: 121].
2.  **Calculate Net Position:**
    * `Net = Sum(Buy Size) - Sum(Sell Size)` for a specific `asset_id`.
3.  **Execute Exit:**
    * If `Net > 0` (Long): Execute `SELL` order with `size = Net`.
    * If `Net < 0` (Short): Execute `BUY` order with `size = Abs(Net)`.
    * Use "Market Order" logic (FOK) to ensure immediate exit.

---

## 5. TypeScript Interfaces (Reference)

```typescript
// Config
interface PolyConfig {
    apiKey: string;
    apiSecret: string;
    apiPassphrase: string;
    privateKey: string; // Metamask/EOA Key
}

// Gamma Structure
interface GammaMarket {
    id: string;
    conditionId: string;
    question: string;
    clobTokenIds: string[]; // Critical for ordering
    enableOrderBook: boolean;
    active: boolean;
}

// Order Request
interface OrderRequest {
    tokenId: string;
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
    type: 'GTC' | 'FOK' | 'GTD';
}
https://polymarket.com/event/btc-updown-15m-{****}