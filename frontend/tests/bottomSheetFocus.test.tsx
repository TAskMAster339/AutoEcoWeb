import { useState } from 'react'
import { Button } from '@mui/material'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BottomSheet } from '../src/components/common/BottomSheet'

function BottomSheetHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Открыть фильтры</Button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Фильтры">
        <Button>Применить</Button>
      </BottomSheet>
    </>
  )
}

describe('BottomSheet focus lifecycle', () => {
  it('restores focus to its trigger after closing', async () => {
    render(<BottomSheetHarness />)
    const trigger = screen.getByRole('button', { name: 'Открыть фильтры' })

    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('button', { name: 'Закрыть' }))

    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
