const ARC_SCALE_FLAGS = [true, true, false, false, false, true, true]
const ARC_TRANSLATION_FLAGS = [false, false, false, false, false, true, true]

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
  d.replace(/,/g, ' ')
    .split(/\s+/)
    .forEach((token) => {
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
