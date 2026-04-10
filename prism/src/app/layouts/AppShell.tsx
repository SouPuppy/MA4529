import { Outlet } from 'react-router-dom'
import { SideNav } from './SideNav'

export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <SideNav />
      <div className="flex-1 min-w-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
