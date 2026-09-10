import { createContext, useContext } from 'react'

const defaultAuthState = {
  isLoaded: true,
  isSignedIn: false,
  user: false
}

export const AuthContext = createContext(defaultAuthState)

export const useAuthState = () => useContext(AuthContext)
