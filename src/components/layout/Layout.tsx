import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { Toaster } from '@/components/ui/toaster'
import { UsersProvider } from '@/lib/users-store'
import { AffiliatesProvider } from '@/lib/affiliates-store'
import { ContactProvider } from '@/lib/contact-store'
import { MessagesProvider } from '@/lib/messages-store'
import { MobileDrawer, MobileDrawerContent } from '@/components/ui/mobile-drawer'

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <UsersProvider>
      <AffiliatesProvider>
        <ContactProvider>
          <MessagesProvider>
            <div className="min-h-screen bg-[var(--color-background)] p-3 sm:p-6">
              <div dir="ltr" className="mx-auto flex w-full max-w-[1920px] gap-3 sm:gap-6">
                <div dir="rtl" className="min-w-0 flex flex-1 flex-col gap-3 sm:gap-6">
                  <TopBar onMenuClick={() => setDrawerOpen(true)} />
                  <main className="min-w-0 flex-1">
                    <Outlet />
                  </main>
                </div>
                {/* Desktop sidebar */}
                <div dir="rtl" className="hidden lg:block shrink-0">
                  <div className="sticky top-6 h-[calc(100vh-3rem)] w-72 overflow-hidden rounded-3xl border border-[var(--color-border)] shadow-sm">
                    <Sidebar />
                  </div>
                </div>
              </div>
              <Toaster />
            </div>

            {/* Mobile drawer */}
            <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen}>
              <MobileDrawerContent>
                <div dir="rtl" className="h-full">
                  <Sidebar onNavClick={() => setDrawerOpen(false)} />
                </div>
              </MobileDrawerContent>
            </MobileDrawer>
          </MessagesProvider>
        </ContactProvider>
      </AffiliatesProvider>
    </UsersProvider>
  )
}
