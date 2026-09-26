/**
 * YouTube playback-error skip/drop counter.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/youtube-playback-errors.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createYtErrorMachine,
  isSkippablePlaybackError,
  playbackErrorSkipLimit,
  playlistLengthFromPlayer,
  recordPlaybackError,
  nowPlayingRecoveryPresentation,
  ytMachineOnError,
  ytMachineOnProgress,
  ytMachineOnStall,
  YT_ERROR_SKIP_LIMIT,
  YT_RECOVERY_TITLE,
  YT_STALL_TIMEOUT_MS,
} from './youtube-playback-errors.ts'

describe('isSkippablePlaybackError', () => {
  it('treats 2, 5, 100, 101, and 150 as skippable', () => {
    for (const code of [2, 5, 100, 101, 150]) {
      assert.equal(isSkippablePlaybackError(code), true, `code ${code}`)
    }
  })

  it('does not skip unknown codes', () => {
    assert.equal(isSkippablePlaybackError(0), false)
    assert.equal(isSkippablePlaybackError(99), false)
  })
})

describe('playbackErrorSkipLimit', () => {
  it('defaults to 3 when playlist length is unknown', () => {
    assert.equal(playbackErrorSkipLimit(null), YT_ERROR_SKIP_LIMIT)
    assert.equal(playbackErrorSkipLimit(undefined), YT_ERROR_SKIP_LIMIT)
    assert.equal(playbackErrorSkipLimit(0), YT_ERROR_SKIP_LIMIT)
  })

  it('uses the playlist length when it is smaller than 3', () => {
    assert.equal(playbackErrorSkipLimit(1), 1)
    assert.equal(playbackErrorSkipLimit(2), 2)
    assert.equal(playbackErrorSkipLimit(3), 3)
    assert.equal(playbackErrorSkipLimit(12), 3)
  })
})

describe('playlistLengthFromPlayer', () => {
  it('returns the playlist length when getPlaylist has items', () => {
    assert.equal(playlistLengthFromPlayer({ getPlaylist: () => ['a', 'b'] }), 2)
  })

  it('returns null when the playlist is empty or missing', () => {
    assert.equal(playlistLengthFromPlayer({ getPlaylist: () => [] }), null)
    assert.equal(playlistLengthFromPlayer({}), null)
  })

  it('returns null when getPlaylist throws', () => {
    assert.equal(
      playlistLengthFromPlayer({
        getPlaylist: () => {
          throw new Error('not ready')
        },
      }),
      null
    )
  })
})

describe('recordPlaybackError', () => {
  it('skips the first two 150s and drops on the third', () => {
    const first = recordPlaybackError(150, 0, null)
    assert.deepEqual(first, { streak: 1, shouldDrop: false, shouldSkip: true })
    const second = recordPlaybackError(150, first.streak, null)
    assert.deepEqual(second, { streak: 2, shouldDrop: false, shouldSkip: true })
    const third = recordPlaybackError(150, second.streak, null)
    assert.deepEqual(third, { streak: 3, shouldDrop: true, shouldSkip: false })
  })

  it('drops on the first skippable error when the playlist has one video', () => {
    assert.deepEqual(recordPlaybackError(101, 0, 1), {
      streak: 1,
      shouldDrop: true,
      shouldSkip: false,
    })
  })

  it('drops on the second error when the playlist has two videos', () => {
    const first = recordPlaybackError(100, 0, 2)
    assert.equal(first.shouldSkip, true)
    assert.deepEqual(recordPlaybackError(100, first.streak, 2), {
      streak: 2,
      shouldDrop: true,
      shouldSkip: false,
    })
  })

  it('does not increment or skip on an unknown error code', () => {
    assert.deepEqual(recordPlaybackError(99, 2, null), {
      streak: 2,
      shouldDrop: false,
      shouldSkip: false,
    })
  })

  it('treats error 2 and 5 the same as 150', () => {
    assert.equal(recordPlaybackError(2, 0, null).shouldSkip, true)
    assert.equal(recordPlaybackError(5, 2, null).shouldDrop, true)
  })
})

describe('yt error machine', () => {
  it('2b: one 150, BUFFERING at 2500ms, then PLAYING, slide stays', () => {
    assert.equal(YT_STALL_TIMEOUT_MS, 10_000)
    let state = createYtErrorMachine()
    state = ytMachineOnError(state, 150, 12)
    assert.deepEqual(state, { streak: 1, stallArmed: true, dropped: false })

    // BUFFERING restarts the stall clock; it does not drop or disarm
    state = ytMachineOnProgress(state, 'buffering')
    assert.deepEqual(state, { streak: 1, stallArmed: true, dropped: false })

    state = ytMachineOnProgress(state, 'playing')
    assert.deepEqual(state, { streak: 0, stallArmed: false, dropped: false })

    state = ytMachineOnStall(state)
    assert.equal(state.dropped, false)
    assert.equal(state.streak, 0)
  })

  it('P2-F: hang after BUFFERING still drops', () => {
    let state = createYtErrorMachine()
    state = ytMachineOnError(state, 150, 12)
    state = ytMachineOnProgress(state, 'buffering')
    assert.equal(state.stallArmed, true)
    assert.equal(state.dropped, false)
    state = ytMachineOnStall(state)
    assert.deepEqual(state, { streak: 1, stallArmed: false, dropped: true })
  })

  it('one 150, then silence for 10s, drops', () => {
    let state = createYtErrorMachine()
    state = ytMachineOnError(state, 150, 12)
    assert.equal(state.stallArmed, true)
    state = ytMachineOnStall(state)
    assert.deepEqual(state, { streak: 1, stallArmed: false, dropped: true })
  })

  it('3 real errors, drops', () => {
    let state = createYtErrorMachine()
    state = ytMachineOnError(state, 150, 12)
    state = ytMachineOnError(state, 101, 12)
    state = ytMachineOnError(state, 100, 12)
    assert.deepEqual(state, { streak: 3, stallArmed: false, dropped: true })
  })

  it('error, PLAYING, 2 errors, stays', () => {
    let state = createYtErrorMachine()
    state = ytMachineOnError(state, 150, 12)
    state = ytMachineOnProgress(state, 'playing')
    assert.deepEqual(state, { streak: 0, stallArmed: false, dropped: false })
    state = ytMachineOnError(state, 150, 12)
    state = ytMachineOnError(state, 150, 12)
    assert.deepEqual(state, { streak: 2, stallArmed: true, dropped: false })
  })

  it('does not increment the streak on a stall timeout', () => {
    let state = ytMachineOnError(createYtErrorMachine(), 150, 12)
    const streakBefore = state.streak
    state = ytMachineOnStall(state)
    assert.equal(state.streak, streakBefore)
  })

  it('still drops immediately on the first 150 when the playlist has one video', () => {
    const state = ytMachineOnError(createYtErrorMachine(), 150, 1)
    assert.deepEqual(state, { streak: 1, stallArmed: false, dropped: true })
  })

  it('CUED and a new video id keep the stall armed', () => {
    let state = ytMachineOnError(createYtErrorMachine(), 150, 12)
    state = ytMachineOnProgress(state, 'cued')
    assert.equal(state.stallArmed, true)
    state = ytMachineOnProgress(state, 'new_video_id')
    assert.equal(state.stallArmed, true)
    assert.equal(state.dropped, false)
  })
})

describe('nowPlayingRecoveryPresentation', () => {
  it('sets aria-busy and aria-disabled while recovering', () => {
    const ui = nowPlayingRecoveryPresentation(true)
    assert.equal(ui.ariaBusy, true)
    assert.equal(ui.ariaDisabled, true)
    assert.equal(ui.title, YT_RECOVERY_TITLE)
    assert.equal(ui.hideTime, true)
  })

  it('clears recovery chrome when idle', () => {
    const ui = nowPlayingRecoveryPresentation(false)
    assert.equal(ui.ariaBusy, false)
    assert.equal(ui.ariaDisabled, false)
    assert.equal(ui.title, null)
    assert.equal(ui.hideTime, false)
  })
})
