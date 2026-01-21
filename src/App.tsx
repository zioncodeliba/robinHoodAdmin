import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { UsersList } from '@/pages/UsersList'
import { CustomerFile } from '@/pages/CustomerFile'
import { Meetings } from '@/pages/Meetings'
import { AffiliatesList } from '@/pages/AffiliatesList'
import { AffiliateDetail } from '@/pages/AffiliateDetail'
import { ContactSubmissions } from '@/pages/ContactSubmissions'
import { Settings } from '@/pages/Settings'
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { getActiveAdminAuth } from '@/lib/auth-storage'

function RequireAuth() {
  const location = useLocation()
  const auth = getActiveAdminAuth()

  if (!auth) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/users" element={<UsersList />} />
          <Route path="/users/:id" element={<CustomerFile />} />
          <Route path="/leads" element={<Navigate to="/users" replace />} />
          <Route path="/leads/:id" element={<Navigate to="/users" replace />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/affiliates" element={<AffiliatesList />} />
          <Route path="/affiliates/:id" element={<AffiliateDetail />} />
          <Route path="/contact" element={<ContactSubmissions />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<div>פרופיל</div>} />
          <Route path="/admin-management" element={<div>ניהול מנהלים</div>} />
        </Route>
      </Route>
    </Routes>
  )
}
