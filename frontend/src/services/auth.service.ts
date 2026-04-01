import api from './api'
import type { 
  ApiResponse, 
  LoginRequest, 
  RegisterRequest, 
  TokenResponse, 
  User 
} from '@/types'

export const authService = {
  login: async (data: LoginRequest): Promise<ApiResponse<TokenResponse>> => {
    const response = await api.post<ApiResponse<TokenResponse>>('/auth/login', data)
    return response.data
  },

  register: async (data: RegisterRequest): Promise<ApiResponse<TokenResponse>> => {
    const response = await api.post<ApiResponse<TokenResponse>>('/auth/register', data)
    return response.data
  },

  getCurrentUser: async (): Promise<ApiResponse<User>> => {
    const response = await api.get<ApiResponse<User>>('/auth/me')
    return response.data
  },

  logout: () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  },

  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
  },

  getToken: (): string | null => {
    return localStorage.getItem('accessToken')
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('accessToken')
  },
}