// User Types
export interface User {
  id: string
  email: string
  displayName?: string
  role: 'user' | 'admin'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  displayName?: string
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
  user: User
}

// API Key Types
export interface ApiKey {
  id: string
  name: string
  key?: string // Only shown once on creation
  prefix?: string
  totalRequests: number
  lastUsedAt?: string
  isActive: boolean
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface CreateApiKeyRequest {
  name: string
  prefix?: string
  expiresAt?: string
}

// Log Types
export interface RequestLog {
  id: string
  endpoint: string
  method: string
  requestBody?: any
  responseBody?: any
  statusCode: number
  model?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  estimatedCost?: number
  duration: number
  ipAddress?: string
  userAgent?: string
  createdAt: string
}

export interface UsageStats {
  totalRequests: number
  totalTokens: number
  totalCost: number
  topModels: Array<{
    model: string
    count: number
  }>
}

// Dashboard Stats
export interface DashboardStats {
  totalApiCalls: number
  totalTokens: number
  estimatedCost: number
  activeKeys: number
}

// Standard API Response
export interface ApiResponse<T> {
  statusCode: number
  message: string
  data: T
  timestamp: string
}

// Pagination
export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}