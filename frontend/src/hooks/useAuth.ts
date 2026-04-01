import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import type { LoginRequest, RegisterRequest } from '@/types'

export const useLogin = () => {
  const { setUser } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: authService.login,
    onSuccess: (data) => {
      const { accessToken, refreshToken, user } = data.data
      authService.setTokens(accessToken, refreshToken)
      setUser(user)
      queryClient.setQueryData(['currentUser'], user)
    },
  })
}

export const useRegister = () => {
  const { setUser } = useAuthStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: authService.register,
    onSuccess: (data) => {
      const { accessToken, refreshToken, user } = data.data
      authService.setTokens(accessToken, refreshToken)
      setUser(user)
      queryClient.setQueryData(['currentUser'], user)
    },
  })
}

export const useCurrentUser = () => {
  const { setUser, setLoading } = useAuthStore()

  return useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      setLoading(true)
      try {
        const response = await authService.getCurrentUser()
        setUser(response.data)
        return response.data
      } finally {
        setLoading(false)
      }
    },
    enabled: authService.isAuthenticated(),
    retry: false,
  })
}

export const useLogout = () => {
  const { logout } = useAuthStore()
  const queryClient = useQueryClient()

  return () => {
    authService.logout()
    logout()
    queryClient.clear()
    window.location.href = '/login'
  }
}