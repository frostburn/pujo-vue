import type { TickResult } from 'pujo-puyo-core'
import { useAudioContextStore } from './stores/audio-context'

export function edArpeggio(notes: number[], divisions = 12, equave = 2, baseFrequency = 440) {
  return notes.map((note) => baseFrequency * Math.pow(equave, note / divisions))
}

const MIRACLE_HEXAD_RATIOS = [1.12373, 1.24848, 1.42557, 1.60195, 1.75156]
const MIRACLE_CHORD = [830]
for (let i = 0; i < 5; ++i) {
  MIRACLE_CHORD.push(MIRACLE_HEXAD_RATIOS[i] * 830)
}
for (let i = 3; i >= 0; --i) {
  MIRACLE_CHORD.push(MIRACLE_HEXAD_RATIOS[i] * 1660)
}

const CHAIN_ARPEGGIO_FREQUENCIES = [
  edArpeggio([0, 1, 2, 3], 7, 2, 430), // 7-edo cluster, slightly lower.
  edArpeggio([0, 2, 4, 6]), // Whole-tone cluster.
  edArpeggio([0, 1, 2, 3], 5, 2, 453), // 5-edo cluster, slightly higher.
  edArpeggio([1, 4, 7, 10]), // Fully diminished chord.
  [494, 494 * (6 / 5), 494 * (3 / 2), 494 * (9 / 5)], // Just minor seventh chord.
  [523, 523 * (5 / 4), 523 * (6 / 4), 523 * (7 / 4)], // Harmonic seventh chord.
  edArpeggio([4, 8, 12, 16]), // Augmented chord.
  [587, 587 * (4 / 3), 587 * (16 / 9), 587 * (64 / 27)], // Stack of just fourths.
  [622, 622 * (11 / 8), 622 * (121 / 60), 622 * (1331 / 512)], // Stack of just superfourths.
  [659, 659 * (3 / 2), 659 * (9 / 4), 659 * (27 / 8)], // Stack of just fifths.
  [6660 / 9, 6660 / 8, 6660 / 7, 6660 / 6, 6660 / 5, 6660 / 4, 6660 / 3], // Subharmonics 9-3.
  edArpeggio([0, 1, 3, 5, 7, 11, 13], 9, 2, 698), // Prime steps of 9-edo.
  [8624 / 11, 8624 / 10, 8624 / 9, 8624 / 8, 8624 / 7, 8624 / 6, 8624 / 5, 8624 / 4], // Subharmonics 11-4.
  MIRACLE_CHORD, // Essentially tempered Miracle hexad.
  [
    880,
    880 * (13 / 10),
    880 * (15 / 10),
    880 * (16 / 10),
    880 * (19 / 10),
    880 * (18 / 10),
    880 * (25 / 10),
    880 * (24 / 10)
  ], // Supermajor chord with otonal extensions.
  edArpeggio([0, 7, 13, 40, 36, 34, 20, 26, 30], 23, 2, 932), // Anti-minor chord with random extensions.
  [2303, 1523, 3754, 2910, 3312, 2563, 3259, 1061, 2888], // Completely random chord.
  [1209, 1336, 1477, 1633, 697, 770, 852, 941], // DTMF.
  edArpeggio([0, 2, 3, 5, 2, 2, -2, 0, 0, -12, 12, 12]) // The Lick.
]

const LEFT_PARAMS = {
  sharpness: 6,
  timbralDecay: 2,
  phaseModulation: 0.3,
  phaseModulationIndex: 3
}

const RIGHT_PARAMS = {
  sharpness: 5.5,
  timbralDecay: 2,
  phaseModulation: 0.8
}

export function chainFX(
  context: ReturnType<typeof useAudioContextStore>,
  player: number,
  chainNumber: number
) {
  if (!chainNumber) {
    return
  }
  if (context === null) {
    context = useAudioContextStore()
  }

  const params: any = player ? { ...RIGHT_PARAMS } : { ...LEFT_PARAMS }
  params.frequencies = CHAIN_ARPEGGIO_FREQUENCIES[chainNumber - 1]
  context.arpeggiate(player, params)
}

export function processTickSounds(
  context: ReturnType<typeof useAudioContextStore>,
  tickResults: TickResult[]
) {
  let impactOffset = 0
  let plopOffset = 0
  for (let i = 0; i < tickResults.length; ++i) {
    if (tickResults[i].didClear) {
      chainFX(context, i, tickResults[i].chainNumber)
    }
    // For technical reasons hard-dropped pieces only jiggle and never "land" as they have zero airtime.
    if (
      tickResults[i].coloredLanded ||
      (tickResults[i].didJiggle && !tickResults[i].garbageLanded)
    ) {
      impactOffset += 1 + 2000 * i
    }
    if (tickResults[i].garbageLanded) {
      plopOffset += 1 + 20 * i
    }
  }
  if (impactOffset) {
    context.impact(impactOffset)
  }
  if (plopOffset) {
    context.plop(plopOffset)
  }
}
