import { zhCN } from '@clerk/localizations'
import { ClerkProvider, useUser } from '@clerk/nextjs'
import { AuthContext } from '@/lib/auth-context'

function ClerkAuthBridge({ children }) {
  const { isLoaded, isSignedIn, user } = useUser()

  return (
    <AuthContext.Provider value={{ isLoaded, isSignedIn, user }}>
      {children}
    </AuthContext.Provider>
  )
}

export default function ClerkBoundary({ children }) {
  return (
    <ClerkProvider localization={zhCN}>
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  )
}
