import { redirect } from 'next/navigation'

// Today is now the landing page at "/". Keep this route working for any
// bookmarks or in-app links by redirecting.
export default function TodayRedirect() {
  redirect('/')
}
