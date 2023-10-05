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
