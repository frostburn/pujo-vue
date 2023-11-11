import {
  BLUE,
  GREEN,
  PURPLE,
  RED,
  YELLOW,
  type ApplicationInfo,
  type Replay,
  parseReplay
} from 'pujo-puyo-core'
import { name, version } from '../package.json'
import { packages } from '../package-lock.json'
import type { GameParams, GameResult } from './server-api'

declare const __COMMIT_HASH__: string

export const MAX_REPLAYS = 10

export type CursorType = 'snake' | 'lock-orbit'

export const LEFT_SCREEN_X = 1.2
export const RIGHT_SCREEN_X = 11
export const SCREEN_Y = 2

const STROKES = ['#d22', '#2d2', '#dd2', '#22e', '#d2c', 'rgba(20, 160, 160, 0.88)']
const DARK_STROKES = ['#522', '#252', '#552', '#226', '#524', 'rgba(20, 80, 80, 0.88)']
const FILLS = ['#922', '#292', '#882', '#229', '#828', 'rgba(30, 255, 255, 0.94)']
export const MISSING_FILL = 'black'
export const MISSING_STROKE = '#0a0a0a'
export const MISSING_SYMBOL = '#cross'
export const STROKE_WIDTH = 0.15

const ARC_SCALE_FLAGS = [true, true, false, false, false, true, true]
const ARC_TRANSLATION_FLAGS = [false, false, false, false, false, true, true]

const SEPARATOR = new RegExp(',|\\s')
const ALPHA = new RegExp('[A-Za-z]')

function tokenizePath(d: string): string[] {
  const result = []
  let token = ''
  for (const character of d) {
    if (ALPHA.test(character) && character !== 'e' && character !== 'E') {
      if (token) {
        result.push(token)
      }
      result.push(character)
      token = ''
    } else if (SEPARATOR.test(character)) {
      if (token) {
        result.push(token)
        token = ''
      }
    } else {
      token += character
    }
  }
  if (token) {
    result.push(token)
  }
  return result
}

/**
 * Transform <path> element's definition by first re-scaling it and then translating the points.
 * NOTE: Likely incomplete and pretty much untested.
 */
export function transformPath(d: string, scale = 1, dx = 0, dy = 0) {
  const transformed: string[] = []
  let scaleFlags: boolean[] = []
  let translationFlags: boolean[] = []
  let relative = false
  let horizontal = true
  tokenizePath(d).forEach((token) => {
    let num = parseFloat(token)
    if (isNaN(num)) {
      transformed.push(token)
      relative = false
      horizontal = true
      if (token.toUpperCase() === 'A') {
        scaleFlags = [...ARC_SCALE_FLAGS]
        translationFlags = [...ARC_TRANSLATION_FLAGS]
      } else if (token.toUpperCase() === 'V') {
        horizontal = false
      }
      if (token !== 'm' && token === token.toLowerCase()) {
        relative = true
      }
    } else {
      let scaleFlag = true
      let translationFlag = true
      if (scaleFlags.length) {
        scaleFlag = scaleFlags.shift()!
      }
      if (translationFlags.length) {
        translationFlag = translationFlags.shift()!
      }
      if (scaleFlag) {
        num *= scale
      }
      if (translationFlag && !relative) {
        num += horizontal ? dx : dy
        horizontal = !horizontal
      }
      transformed.push(num.toString())
    }
  })
  return transformed.join(' ')
}

export function getStroke(colorIndex: number, dark = false) {
  if (colorIndex < 0) {
    return 'none'
  } else if (colorIndex < STROKES.length) {
    if (dark) {
      return DARK_STROKES[colorIndex]
    }
    return STROKES[colorIndex]
  }
  return 'white'
}

export function getFill(colorIndex: number) {
  if (colorIndex < 0) {
    return 'none'
  } else if (colorIndex < FILLS.length) {
    return FILLS[colorIndex]
  }
  return 'magenta'
}

export function panelSymbol(color: number, jiggle = false) {
  if (color === RED) {
    return jiggle ? '#jiggling-heart' : '#heart'
  } else if (color === GREEN) {
    return jiggle ? '#jiggling-circle' : '#small-circle'
  } else if (color === YELLOW) {
    return jiggle ? '#jiggling-star' : '#small-star'
  } else if (color === BLUE) {
    return jiggle ? '#jiggling-moon' : '#small-moon'
  } else if (color === PURPLE) {
    return jiggle ? '#jiggling-diamond' : '#small-diamond'
  }
  return ''
}

export function getClientInfo(): ApplicationInfo {
  const core = packages['node_modules/pujo-puyo-core']
  return {
    name,
    version,
    resolved: __COMMIT_HASH__,
    core: {
      version: core.version,
      resolved: core.resolved
    }
  }
}

export function getCursorType(): CursorType {
  const DEFAULT_CURSOR_TYPE = window.matchMedia('(pointer: coarse)').matches
    ? 'snake'
    : 'lock-orbit'
  const result = localStorage.getItem('cursorType') ?? DEFAULT_CURSOR_TYPE
  return result === 'snake' ? 'snake' : 'lock-orbit'
}

// Prepare partial replay from game parameters
export function prepareReplay(message: GameParams): Replay {
  const replay: Replay = {
    gameSeeds: [-1, -1],
    screenSeeds: [...message.screenSeeds],
    colorSelections: message.colorSelections.map((cs) => [...cs]),
    initialBags: message.initialBags.map((ib) => [...ib]),
    targetPoints: [...message.targetPoints],
    marginFrames: message.marginFrames,
    mercyFrames: message.mercyFrames,
    moves: [],
    metadata: { ...message.metadata },
    result: {
      reason: 'ongoing'
    }
  }

  replay.metadata.names = [...replay.metadata.names]
  replay.metadata.elos = [...replay.metadata.elos]
  replay.metadata.priorWins = [...replay.metadata.priorWins]
  if (replay.metadata.clients) {
    replay.metadata.clients = [...replay.metadata.clients]
  }
  if (message.identity) {
    replay.screenSeeds.reverse()
    replay.colorSelections.reverse()
    replay.initialBags.reverse()
    replay.targetPoints.reverse()
    replay.metadata.names.reverse()
    replay.metadata.elos.reverse()
    if (replay.metadata.clients) {
      replay.metadata.clients.reverse()
    }
  }

  return replay
}

export function finalizeReplay(replay: Replay, message: GameResult, identity: number): void {
  replay.gameSeeds = [...message.gameSeeds]
  replay.initialBags = message.initialBags.map((ib) => [...ib])
  if (identity) {
    replay.gameSeeds.reverse()
    replay.initialBags.reverse()
  }
  replay.result.reason = message.reason
  replay.metadata.endTime = message.msSince1970
  if (message.winner === identity) {
    replay.result.winner = 0
  } else if (message.winner === undefined) {
    replay.result.winner = undefined
  } else {
    replay.result.winner = 1
  }
}

export function goFullscreen() {
  // Apple fix your browsers...
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen()
  }
}

export function exitFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  }
}

export function mmod(a: number, b: number) {
  return ((a % b) + b) % b
}

export function saveReplay(replay: Replay) {
  const ringIndex = parseInt(localStorage.getItem('replayRingIndex') ?? '0')
  localStorage.setItem(`replay.ring.${ringIndex}`, JSON.stringify(replay))
  localStorage.setItem('replayRingIndex', mmod(ringIndex + 1, MAX_REPLAYS).toString())
}

export function updateReplay(replay: Replay) {
  const ringIndex = mmod(parseInt(localStorage.getItem('replayRingIndex') ?? '0') - 1, MAX_REPLAYS)
  localStorage.setItem(`replay.ring.${ringIndex}`, JSON.stringify(replay))
}

export function loadReplay(age = 0) {
  const ringIndex = mmod(
    parseInt(localStorage.getItem('replayRingIndex') ?? '0') - 1 - age,
    MAX_REPLAYS
  )
  const serialized = localStorage.getItem(`replay.ring.${ringIndex}`)
  if (!serialized) {
    return undefined
  }
  return parseReplay(serialized)
}
