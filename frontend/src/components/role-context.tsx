import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Role } from '@/lib/types'

interface RoleContextValue {
  role: Role
  setRole: (role: Role) => void
  hasQA: boolean
  setHasQA: (value: boolean) => void
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('Developer')
  const [hasQA, setHasQA] = useState(true)

  return (
    <RoleContext.Provider value={{ role, setRole, hasQA, setHasQA }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used within RoleProvider')
  return ctx
}