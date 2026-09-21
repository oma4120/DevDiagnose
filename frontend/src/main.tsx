import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { RoleProvider } from '@/components/role-context'
import { ToastProvider } from '@/components/ui/toast'
import { DataProvider } from '@/lib/data-context'
import './globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RoleProvider>
        <ToastProvider>
          <DataProvider>
            <App />
          </DataProvider>
        </ToastProvider>
      </RoleProvider>
    </BrowserRouter>
  </StrictMode>,
)