import { redirect } from 'next/navigation'

// Logging now lives on the Talk page (one front door). Keep this route as a
// redirect so old links / bookmarks land on the unified surface.
export default function LogPage() {
  redirect('/')
}
