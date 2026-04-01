---
name: ""
overview: ""
todos: []
isProject: false
---

# Kế hoạch: UI Dashboard cho Lynx AI

## Tổng quan

Xây dựng giao diện người dùng hiện đại, responsive cho hệ thống quản lý User và API Keys với đầy đủ chức năng.

## Stack công nghệ

- **Frontend Framework**: React 18 + TypeScript
- **Build Tool**: Vite (nhanh, nhẹ)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI based)
- **State Management**: React Query (TanStack Query) + Zustand
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Charts**: Recharts (thống kê sử dụng)
- **Icons**: Lucide React

## Cấu trúc thư mục

```
frontend/
├── src/
│   ├── components/          # UI components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── layout/         # Layout components
│   │   └── features/       # Feature-specific components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API services
│   ├── stores/             # Zustand stores
│   ├── lib/                # Utilities
│   ├── types/              # TypeScript types
│   └── App.tsx
├── public/
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Danh sách trang và chức năng

### 1. Authentication Pages

#### 1.1 Login Page (/login)

- Form đăng nhập với email/password
- Validation real-time
- "Remember me" option
- Link to register
- Error handling

#### 1.2 Register Page (/register)

- Form đăng ký: email, password, displayName
- Password strength indicator
- Validation: email format, password min 8 chars
- Link to login
- Success message và redirect

### 2. Layout Components

#### 2.1 Main Layout

- Sidebar navigation (collapsible)
- Header với user menu
- Breadcrumb navigation
- Responsive (mobile drawer)

#### 2.2 Sidebar Navigation

- Logo/Brand
- Navigation items:
  - Dashboard (icon: LayoutDashboard)
  - API Keys (icon: Key)
  - Usage Logs (icon: BarChart3)
  - Settings (icon: Settings)
- User info ở bottom

#### 2.3 Header

- Page title
- Notification bell (nếu cần)
- User avatar + dropdown menu
  - Profile
  - Logout

### 3. Dashboard Page (/dashboard)

#### 3.1 Stats Cards (4 cards)

- Total API Calls (today/this month)
- Total Tokens Used
- Estimated Cost (USD)
- Active API Keys

#### 3.2 Usage Chart

- Line chart: API calls over time (7 days/30 days)
- Bar chart: Token usage by model

#### 3.3 Recent Activity Table

- 10 recent API calls
- Columns: Time, Model, Tokens, Status
- Link to view all logs

#### 3.4 Quick Actions

- Button "Create New API Key"
- Link to "View Usage Logs"

### 4. API Keys Management Page (/api-keys)

#### 4.1 Keys List Table

- Columns: Name, Key (masked), Created, Last Used, Requests, Status, Actions
- Pagination
- Search/Filter

#### 4.2 Create Key Modal

- Form: Key name, prefix (optional), expiration date (optional)
- Generated key display (only once, with copy button)
- Warning: "Save this key now, it won't be shown again"

#### 4.3 Delete Confirmation Modal

- Xác nhận xóa key
- Warning về việc key sẽ ngừng hoạt động ngay lập tức

#### 4.4 Key Detail View (optional)

- Chi tiết về một key cụ thể
- Usage chart cho key đó

### 5. Usage Logs Page (/logs)

#### 5.1 Filter Bar

- Date range picker
- Model filter (dropdown)
- Status filter (success/error)

#### 5.2 Logs Table

- Columns: Time, Model, Tokens (prompt/completion/total), Duration, Cost, Status
- Pagination (20 items/page)
- Sortable columns
- Expand row để xem request/response details

#### 5.3 Usage Analytics Section

- Charts: Usage by model, Cost over time
- Export data (CSV)

### 6. Profile Page (/profile)

#### 6.1 Profile Info Section

- Display Name (editable)
- Email (read-only)
- Role (read-only)
- Created date

#### 6.2 Change Password Section

- Current password
- New password
- Confirm new password

#### 6.3 Danger Zone

- Delete account (with confirmation)

### 7. Components chung

#### 7.1 Loading States

- Skeleton loaders cho tables
- Spinners cho buttons
- Page loading states

#### 7.2 Empty States

- Empty state cho chưa có API keys
- Empty state cho chưa có logs
- Empty state cho no search results

#### 7.3 Error States

- 404 Not Found page
- 500 Error page
- Network error toast

#### 7.4 Toast Notifications

- Thành công: "API Key created"
- Lỗi: "Failed to create key"
- Info: "Copied to clipboard"

## API Integration

### Services

```typescript
// auth.service.ts
- login(email, password)
- register(email, password, displayName)
- getCurrentUser()
- logout()

// api-key.service.ts  
- getAllKeys()
- createKey(data)
- deleteKey(id)

// logs.service.ts
- getLogs(params)
- getStats(params)
- getLogById(id)

// user.service.ts
- updateProfile(data)
- changePassword(data)
- deleteAccount()
```

### Hooks

```typescript
// useAuth.ts
- useLogin()
- useRegister()
- useCurrentUser()
- useLogout()

// useApiKeys.ts
- useApiKeys()
- useCreateApiKey()
- useDeleteApiKey()

// useLogs.ts
- useLogs()
- useStats()
```

## Routes và Navigation

```typescript
const routes = [
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/',
    element: <ProtectedLayout />,
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'api-keys', element: <ApiKeysPage /> },
      { path: 'logs', element: <LogsPage /> },
      { path: 'profile', element: <ProfilePage /> },
    ]
  },
  { path: '*', element: <NotFoundPage /> }
];
```

## Responsive Breakpoints

- Mobile: < 640px (single column, drawer nav)
- Tablet: 640px - 1024px (2 columns, collapsible nav)
- Desktop: > 1024px (full sidebar, multi-column)

## Authentication Flow

1. User đăng nhập → Lưu JWT token (localStorage/cookie)
2. Axios interceptor add Bearer token vào headers
3. Protected routes check token
4. Token expired → Redirect to login
5. Logout → Clear token + redirect to login

## State Management

### Zustand Stores

```typescript
// auth.store.ts
- user: User | null
- isAuthenticated: boolean
- login(), logout(), setUser()

// ui.store.ts
- sidebarOpen: boolean
- theme: 'light' | 'dark'
- toggleSidebar(), setTheme()
```

### React Query

- Cache API responses
- Refetch on window focus
- Optimistic updates cho delete/create

## Implementation Steps

### Phase 1: Setup

1. Initialize Vite + React + TypeScript project
2. Setup Tailwind CSS
3. Setup shadcn/ui
4. Setup React Query + Axios
5. Create folder structure

### Phase 2: Authentication

1. Login page UI
2. Register page UI
3. Auth service integration
4. Protected routes

### Phase 3: Layout

1. Sidebar component
2. Header component
3. Main layout wrapper

### Phase 4: Features

1. Dashboard page + API integration
2. API Keys page + API integration
3. Logs page + API integration
4. Profile page + API integration

### Phase 5: Polish

1. Loading states
2. Error handling
3. Responsive fixes
4. Animations/transitions

## Design System

### Colors

- Primary: Blue-600
- Secondary: Slate-600
- Success: Green-500
- Warning: Yellow-500
- Error: Red-500
- Background: Slate-50 (light), Slate-950 (dark)

### Typography

- Headings: Inter, semibold
- Body: Inter, regular
- Mono: JetBrains Mono (for code/keys)

### Components Style

- Cards: rounded-lg, shadow-sm, border
- Buttons: rounded-md, with icons
- Inputs: rounded-md, focus ring
- Tables: striped, hover effect

## Files cần tạo

### Config files

- frontend/package.json
- frontend/vite.config.ts
- frontend/tsconfig.json
- frontend/tailwind.config.js
- frontend/.eslintrc.cjs

### Source files

- frontend/src/main.tsx
- frontend/src/App.tsx
- frontend/src/index.css
- frontend/src/lib/utils.ts
- frontend/src/types/index.ts
- frontend/src/services/api.ts
- frontend/src/services/auth.service.ts
- frontend/src/services/api-key.service.ts
- frontend/src/services/logs.service.ts
- frontend/src/hooks/useAuth.ts
- frontend/src/hooks/useApiKeys.ts
- frontend/src/hooks/useLogs.ts
- frontend/src/stores/auth.store.ts
- frontend/src/stores/ui.store.ts
- frontend/src/components/layout/MainLayout.tsx
- frontend/src/components/layout/Sidebar.tsx
- frontend/src/components/layout/Header.tsx
- frontend/src/components/ui/* (shadcn components)
- frontend/src/pages/LoginPage.tsx
- frontend/src/pages/RegisterPage.tsx
- frontend/src/pages/DashboardPage.tsx
- frontend/src/pages/ApiKeysPage.tsx
- frontend/src/pages/LogsPage.tsx
- frontend/src/pages/ProfilePage.tsx
- frontend/src/pages/NotFoundPage.tsx

## Tổng thời gian ước tính

- Phase 1 (Setup): 30 phút
- Phase 2 (Auth): 1 giờ
- Phase 3 (Layout): 1 giờ
- Phase 4 (Features): 3 giờ
- Phase 5 (Polish): 1 giờ

**Tổng: ~6-7 giờ**

## Dependencies cần install

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.8.0",
    "axios": "^1.6.0",
    "zustand": "^4.4.0",
    "recharts": "^2.10.0",
    "lucide-react": "^0.292.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "date-fns": "^2.30.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.2.0",
    "vite": "^5.0.0"
  }
}
```

