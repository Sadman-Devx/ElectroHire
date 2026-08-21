import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { Avatar } from '@/components/ui/avatar'

describe('Avatar', () => {
  it('renders the image when a src is given', () => {
    render(<Avatar src="https://example.com/photo.jpg" alt="Karim Uddin" />)

    const img = screen.getByRole('img', { name: 'Karim Uddin' })
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
  })

  it('shows the person-icon fallback when no src is given', () => {
    render(<Avatar src={null} alt="Karim Uddin" />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  // The actual bug this component exists to fix: ProviderCard,
  // ProviderProfileHeader, ProviderSummaryCard and
  // ContactHistorySection all used to render a bare <img src={photo}>
  // with no error handling, so a broken/expired photo URL left the
  // browser's native "broken image" glyph on screen instead of
  // degrading to the person icon like the "no photo at all" case
  // already did.
  it('falls back to the person icon if the image fails to load', () => {
    render(<Avatar src="https://example.com/broken.jpg" alt="Karim Uddin" />)

    const img = screen.getByRole('img', { name: 'Karim Uddin' })
    fireEvent.error(img)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('resets the fallback when src changes to a new, working image', () => {
    const { rerender } = render(<Avatar src="https://example.com/broken.jpg" alt="Karim Uddin" />)
    fireEvent.error(screen.getByRole('img', { name: 'Karim Uddin' }))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    rerender(<Avatar src="https://example.com/working.jpg" alt="Karim Uddin" />)

    expect(screen.getByRole('img', { name: 'Karim Uddin' })).toHaveAttribute(
      'src',
      'https://example.com/working.jpg'
    )
  })
})