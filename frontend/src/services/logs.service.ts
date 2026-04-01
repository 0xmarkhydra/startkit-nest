import api from './api'
import type { ApiResponse, RequestLog, UsageStats, PaginationParams } from '@/types'

export const logsService = {
  getLogs: async (params?: PaginationParams & { startDate?: string; endDate?: string; model?: string }): Promise<ApiResponse<RequestLog[]>> => {
    const response = await api.get<ApiResponse<RequestLog[]>>('/logs', { params })
    return response.data
  },

  getStats: async (params?: { startDate?: string; endDate?: string }): Promise<ApiResponse<UsageStats>> => {
    const response = await api.get<ApiResponse<UsageStats>>('/logs/stats', { params })
    return response.data
  },

  getLogById: async (id: string): Promise<ApiResponse<RequestLog>> => {
    const response = await api.get<ApiResponse<RequestLog>>(`/logs/${id}`)
    return response.data
  },
}