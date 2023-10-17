import { BLUE, GREEN, PURPLE, RED, YELLOW, type ApplicationInfo } from 'pujo-puyo-core'
import { name, version } from '../package.json'
import { packages } from '../package-lock.json'

declare const __COMMIT_HASH__: string

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
