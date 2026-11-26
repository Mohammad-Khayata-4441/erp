import { defineResource } from './resource.types'

export const authResource = defineResource({
  key: 'auth',

  /** Full URL paths (leading slash) — used by api-client fetch calls */
  routes: {
    login: '/auth/login',
    googleLogin: '/auth/google/login',
    register: '/auth/register',
    googleRegister: '/auth/google/register',
    logout: '/auth/logout',
    me: '/auth/me',
    changePassword: '/auth/change-password',
  },

  
})

