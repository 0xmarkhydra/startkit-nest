import api from './api'
import type { ApiResponse, ApiKey, CreateApiKeyRequest } from '@/types'

export const apiKeyService = {
  getAllKeys: async (): Promise<ApiResponse<ApiKey[]>> => {
    const response = await api.get<ApiResponse<ApiKey[]>>('/api-keys')
    return response.data
  },

  createKey: async (data: CreateApiKeyRequest): Promise<ApiResponse<ApiKey>> => {
    const response = await api.post<ApiResponse<ApiKey>>('/api-keys', data)
    return response.data
  },

  deleteKey: async (id: string): Promise<ApiResponse<null>> => {
    const response = await api.delete<ApiResponse<null>>(`/api-keys/${id}`)
    return response.data
  },
}