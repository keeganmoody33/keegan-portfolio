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
  isBannerDotControl,
  isNowPlayingControl,
  ytMachineOnError,
  ytMachineOnProgress,
  ytMachineOnTick,
  YT_ERROR_SKIP_LIMIT,
  YT_RECOVERY_TITLE,
  YT_STALL_CAP_MS,
  YT_STALL_TIMEOUT_MS,
} from './youtube-playback-errors.ts'

const T0 = 1_000_000
const CLOCK_IDLE = {
  errorTime: null,
  deadline: null,
  progressExtended: false,
}

function fakeEl(label: string, closestSel: string | null = null): Element {
  return {
    getAttribute: (name: string) => (name === 'aria-label' ? label : null),
    closest: (sel: string) => (closestSel === sel ? {} : null),
  } as unknown as Element
}

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
  it('QA 2b: one 150, BUFFERING at 2500ms, then PLAYING, slide stays', () => {
    assert.equal(YT_STALL_TIMEOUT_MS, 10_000)
    assert.equal(YT_STALL_CAP_MS, 25_000)
    let state = createYtErrorMachine()
    state = ytMachineOnError(state, 150, 12, T0)
    assert.deepEqual(state, {
      streak: 1,
      stallArmed: true,
      dropped: false,
      errorTime: T0,
      deadline: T0 + YT_STALL_TIMEOUT_MS,
      progressExtended: false,
    })

    state = ytMachineOnProgress(state, 'buffering', T0 + 2500)
    assert.deepEqual(state, {
      streak: 1,
      stallArmed: true,
      dropped: false,
      errorTime: T0,
      deadline: T0 + YT_STALL_CAP_MS,
      progressExtended: true,
    })

    state = ytMachineOnProgress(state, 'playing', T0 + 3000)
    assert.deepEqual(state, {
      streak: 0,
      stallArmed: false,
      dropped: false,
      ...CLOCK_IDLE,
    })

    state = ytMachineOnTick(state, T0 + YT_STALL_CAP_MS)
    assert.equal(state.dropped, false)
    assert.equal(state.streak, 0)
  })

  it('BUFFERING held 12s after an error, then PLAYING: stays', () => {
    let state = ytMachineOnError(createYtErrorMachine(), 150, 12, T0)
    state = ytMachineOnProgress(state, 'buffering', T0 + 200)
    assert.equal(state.deadline, T0 + YT_STALL_CAP_MS)
    assert.equal(ytMachineOnTick(state, T0 + 12_000).dropped, false)
    state = ytMachineOnProgress(state, 'playing', T0 + 12_000)
    assert.equal(state.dropped, false)
    assert.equal(state.stallArmed, false)
    assert.equal(state.streak, 0)
  })

  it('BUFFERING stuck forever: drops at the cap', () => {
    let state = ytMachineOnError(createYtErrorMachine(), 150, 12, T0)
    state = ytMachineOnProgress(state, 'buffering', T0 + 200)
    assert.equal(state.deadline, T0 + YT_STALL_CAP_MS)
    assert.equal(ytMachineOnTick(state, T0 + YT_STALL_CAP_MS - 1).dropped, false)
    state = ytMachineOnTick(state, T0 + YT_STALL_CAP_MS)
    assert.deepEqual(state, {
      streak: 1,
      stallArmed: false,
      dropped: true,
      errorTime: T0,
      deadline: T0 + YT_STALL_CAP_MS,
      progressExtended: true,
    })
  })

  it('BUFFERING/CUED churn every 3s: drops at the cap, not later', () => {
    let state = ytMachineOnError(createYtErrorMachine(), 150, 12, T0)
    const kinds = ['buffering', 'cued'] as const
    for (let offset = 3000; offset <= 24_000; offset += 3000) {
      state = ytMachineOnProgress(
        state,
        kinds[(offset / 3000) % 2],
        T0 + offset
      )
      assert.equal(state.deadline, T0 + YT_STALL_CAP_MS)
      assert.equal(state.progressExtended, true)
      assert.equal(state.dropped, false)
    }
    assert.equal(ytMachineOnTick(state, T0 + YT_STALL_CAP_MS - 1).dropped, false)
    state = ytMachineOnTick(state, T0 + YT_STALL_CAP_MS)
    assert.equal(state.dropped, true)
    assert.equal(state.deadline, T0 + YT_STALL_CAP_MS)
  })

  it('one 150 then silence: drops at about 10s', () => {
    let state = ytMachineOnError(createYtErrorMachine(), 150, 12, T0)
    assert.equal(state.deadline, T0 + YT_STALL_TIMEOUT_MS)
    assert.equal(ytMachineOnTick(state, T0 + YT_STALL_TIMEOUT_MS - 1).dropped, false)
    state = ytMachineOnTick(state, T0 + YT_STALL_TIMEOUT_MS)
    assert.deepEqual(state, {
      streak: 1,
      stallArmed: false,
      dropped: true,
      errorTime: T0,
      deadline: T0 + YT_STALL_TIMEOUT_MS,
      progressExtended: false,
    })
  })

  it('3 real errors, drops', () => {
    let state = createYtErrorMachine()
    state = ytMachineOnError(state, 150, 12, T0)
    state = ytMachineOnError(state, 101, 12, T0 + 100)
    state = ytMachineOnError(state, 100, 12, T0 + 200)
    assert.deepEqual(state, {
      streak: 3,
      stallArmed: false,
      dropped: true,
      ...CLOCK_IDLE,
    })
  })

  it('error, PLAYING, 2 errors, stays', () => {
    let state = createYtErrorMachine()
    state = ytMachineOnError(state, 150, 12, T0)
    state = ytMachineOnProgress(state, 'playing', T0 + 100)
    assert.deepEqual(state, {
      streak: 0,
      stallArmed: false,
      dropped: false,
      ...CLOCK_IDLE,
    })
    state = ytMachineOnError(state, 150, 12, T0 + 200)
    state = ytMachineOnError(state, 150, 12, T0 + 300)
    assert.deepEqual(state, {
      streak: 2,
      stallArmed: true,
      dropped: false,
      errorTime: T0 + 300,
      deadline: T0 + 300 + YT_STALL_TIMEOUT_MS,
      progressExtended: false,
    })
  })

  it('does not increment the streak on a stall timeout', () => {
    let state = ytMachineOnError(createYtErrorMachine(), 150, 12, T0)
    const streakBefore = state.streak
    state = ytMachineOnTick(state, T0 + YT_STALL_TIMEOUT_MS)
    assert.equal(state.streak, streakBefore)
  })

  it('still drops immediately on the first 150 when the playlist has one video', () => {
    const state = ytMachineOnError(createYtErrorMachine(), 150, 1, T0)
    assert.deepEqual(state, {
      streak: 1,
      stallArmed: false,
      dropped: true,
      ...CLOCK_IDLE,
    })
  })

  it('CUED and a new video id keep the stall armed and do not move the cap', () => {
    let state = ytMachineOnError(createYtErrorMachine(), 150, 12, T0)
    state = ytMachineOnProgress(state, 'cued', T0 + 100)
    assert.equal(state.stallArmed, true)
    assert.equal(state.deadline, T0 + YT_STALL_CAP_MS)
    state = ytMachineOnProgress(state, 'new_video_id', T0 + 400)
    assert.equal(state.stallArmed, true)
    assert.equal(state.deadline, T0 + YT_STALL_CAP_MS)
    assert.equal(state.dropped, false)
  })
})

describe('focus handoff predicates', () => {
  it('treats rotator dots as non-targets', () => {
    assert.equal(isBannerDotControl(fakeEl('Switch to Now Playing')), true)
    assert.equal(isBannerDotControl(fakeEl('GitHub activity', '[data-banner-dots]')), true)
    assert.equal(isBannerDotControl(fakeEl('GitHub activity, last 14 days')), false)
  })

  it('treats Play/Pause as the dropping slide, not a landing target', () => {
    assert.equal(isNowPlayingControl(fakeEl('Play')), true)
    assert.equal(isNowPlayingControl(fakeEl('Pause')), true)
    assert.equal(isNowPlayingControl(fakeEl('Play', '[data-now-playing]')), true)
    assert.equal(isNowPlayingControl(fakeEl('GitHub activity, last 14 days')), false)
  })

  it('does not treat a leftover GitHub control as a rotator dot or Play', () => {
    const leftover = fakeEl('GitHub activity, last 14 days')
    assert.equal(isBannerDotControl(leftover), false)
    assert.equal(isNowPlayingControl(leftover), false)
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
