import type { Metadata } from 'next'
import '../styles/globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'

export const metadata: Metadata = {
  title: 'PBX Console',
  description: 'Multi-tenant PBX/UC platform control panel — dialer, contacts, call history, voicemail.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Apply the persisted theme before paint to avoid a flash. Inline
          script reads localStorage and toggles the `dark` class on <html>.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('pbx.theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body>
        <div className="min-h-screen">
          <Sidebar presence="available" userName="Agent" tenantName="Acme PBX" />
          <div className="flex min-h-screen flex-col md:pl-64">
            <Topbar tenantName="Acme PBX" userName="Agent" />
            <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
