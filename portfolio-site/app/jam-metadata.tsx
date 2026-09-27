'use client'

import { useEffect } from 'react'
import { jam } from '@jam.dev/sdk'

let metadataRegistered = false

export function JamMetadata() {
  useEffect(() => {
    if (metadataRegistered) return

    jam.metadata(() => ({
      path: window.location.pathname,
    }))
    metadataRegistered = true
  }, [])

  return null
}
