/**
 * YouTube playback-error skip/drop counter.
 *
 * Run from portfolio-site/:
 *   node --experimental-strip-types --test lib/youtube-playback-errors.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isSkippablePlaybackError,
  playbackErrorSkipLimit,
  playlistLengthFromPlayer,
  recordPlaybackError,
  skipRecovered,
  YT_ERROR_SKIP_LIMIT,
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

  it('resets when the caller starts the streak at 0 after PLAYING', () => {
    const afterPlay = recordPlaybackError(150, 0, null)
    assert.deepEqual(afterPlay, { streak: 1, shouldDrop: false, shouldSkip: true })
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

describe('skipRecovered', () => {
  const playing = 1
  const buffering = 3

  it('treats PLAYING or BUFFERING as recovered', () => {
    assert.equal(
      skipRecovered({
        playerState: playing,
        playingState: playing,
        bufferingState: buffering,
      }),
      true
    )
    assert.equal(
      skipRecovered({
        playerState: buffering,
        playingState: playing,
        bufferingState: buffering,
      }),
      true
    )
  })

  it('treats a new video id as recovered', () => {
    assert.equal(
      skipRecovered({
        playerState: -1,
        playingState: playing,
        bufferingState: buffering,
        currentVideoId: 'b',
        failedVideoId: 'a',
      }),
      true
    )
  })

  it('does not recover when state is dead and the video id is empty or unchanged', () => {
    assert.equal(
      skipRecovered({
        playerState: -1,
        playingState: playing,
        bufferingState: buffering,
        currentVideoId: '',
        failedVideoId: '',
      }),
      false
    )
    assert.equal(
      skipRecovered({
        playerState: 5,
        playingState: playing,
        bufferingState: buffering,
        currentVideoId: 'a',
        failedVideoId: 'a',
      }),
      false
    )
  })
})
