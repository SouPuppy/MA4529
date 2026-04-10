import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

/** Layout for public site pages (Home, About, Docs). */
export function SiteLayout() {
  return (
    <div className="min-h-screen bg-base">
      <Navbar />
      <Outlet />
    </div>
  )
}
