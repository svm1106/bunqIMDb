'use client'

import Link from 'next/link'
import { Button } from "@/components/ui/button"

export default function NavBar() {
  return (
    <header className="w-full border-b bg-background py-3">
      <div className="container mx-auto flex items-center justify-center gap-4">
        <Button asChild variant="ghost">
          <Link href="/">Enrich Excel</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/posters">Posters</Link>
        </Button>
      </div>
    </header>
  )
}