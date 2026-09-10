import { redirect } from 'next/navigation'

// Root entry: route to the dashboard. A real auth gate lives in middleware;
// for the starter we redirect to /dashboard (and /login for explicit login).
export default function RootPage() {
  redirect('/dashboard')
}
