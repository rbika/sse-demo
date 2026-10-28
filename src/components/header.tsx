import Link from 'next/link'

import { Container } from '@/components/container'
import { uiPaths } from '@/utils/paths'

const Header = () => {
  return (
    <nav className="bg-background fixed top-0 right-0 left-0 z-20 h-12 w-full border-b">
      <Container className="flex h-full items-center">
        <Link href={uiPaths.home()} className="flex items-center gap-2">
          <h1 className="text-xl font-bold">SSE Demo</h1>
        </Link>
      </Container>
    </nav>
  )
}

export { Header }
