const DEFAULT_SHARPNESS = 1
const DEFAULT_PHASE_MODULATION = 0
const DEFAULT_PHASE_MODULATION_INDEX = 1
const DEFAULT_NOTE_DURATION = 0.05
const DEFAULT_GLIDE = 0.003
const DEFAULT_TIMBRAL_DECAY = 0
const DEFAULT_DECAY = 4
const DEFAULT_ATTACK = 0.01

const MAX_TIME = 10

type ArpeggioParams = {
  frequencies: number[]
  sharpness: number
  phaseModulation: number
  phaseModulationIndex: number
  noteDuration: number
  attack: number
  glide: number
  timbralDecay: number
  decay: number
}

function setDefaults(params: any): ArpeggioParams {
  // These overwrite 0, but that's a bad value anyway
  return {
    frequencies: params.frequencies,
    sharpness: params.sharpness || DEFAULT_SHARPNESS,
    phaseModulation: params.phaseModulation || DEFAULT_PHASE_MODULATION,
    phaseModulationIndex: params.phaseModulationIndex || DEFAULT_PHASE_MODULATION_INDEX,
    noteDuration: params.noteDuration || DEFAULT_NOTE_DURATION,
    attack: params.attack || DEFAULT_ATTACK,
    glide: params.glide || DEFAULT_GLIDE,
    timbralDecay: params.timbralDecay || DEFAULT_TIMBRAL_DECAY,
    decay: params.decay || DEFAULT_DECAY
  }
}

class ArpeggioProcessor extends AudioWorkletProcessor {
  t: number
  theta: number
  deltas: number[]
  params: ArpeggioParams
  newParams: ArpeggioParams | null

  constructor(options?: AudioWorkletNodeOptions) {
    super(options)
    this.t = 10000
    this.theta = 0
    this.params = {
      frequencies: [432, 540, 648],
      sharpness: DEFAULT_SHARPNESS,
      phaseModulation: DEFAULT_PHASE_MODULATION,
      phaseModulationIndex: DEFAULT_PHASE_MODULATION_INDEX,
      noteDuration: DEFAULT_NOTE_DURATION,
      attack: DEFAULT_ATTACK,
      glide: DEFAULT_GLIDE,
      timbralDecay: DEFAULT_TIMBRAL_DECAY,
      decay: DEFAULT_DECAY
    }
    this.newParams = null

    this.deltas = [] // Don't you cry little transpiler.
    this.calculateDeltas()

    this.port.onmessage = this.onMessage.bind(this)
  }

  calculateDeltas() {
    const dTheta = (2 * Math.PI) / sampleRate
    this.deltas = this.params.frequencies.map((f) => dTheta * f)
  }

  onMessage(event: MessageEvent) {
    this.newParams = setDefaults(event.data)
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    parameters: Record<string, Float32Array>
  ) {
    if (this.newParams !== null) {
      this.params = this.newParams
      this.newParams = null
      this.t = 0
      this.theta = 0
      this.calculateDeltas()
    }

    if (this.t > MAX_TIME) {
      return true
    }

    const dt = 1 / sampleRate

    // Process mono
    for (let i = 0; i < outputs[0][0].length; ++i) {
      const timbre = this.params.sharpness * Math.exp(-this.t * this.params.timbralDecay)
      outputs[0][0][i] =
        (Math.tanh(
          Math.sin(
            this.theta +
              this.params.phaseModulation * Math.sin(this.theta * this.params.phaseModulationIndex)
          ) * timbre
        ) /
          Math.tanh(timbre)) *
        Math.exp(-this.t * this.params.decay)
      if (this.t < this.params.attack) {
        outputs[0][0][i] *= this.t / this.params.attack
      }
      const index = Math.floor(this.t / this.params.noteDuration)
      const noteT = this.t - index * this.params.noteDuration
      if (noteT < this.params.noteDuration - this.params.glide) {
        this.theta += this.deltas[index % this.deltas.length]
      } else {
        const mu = (noteT - this.params.noteDuration + this.params.glide) / this.params.glide
        this.theta +=
          mu * this.deltas[index % this.deltas.length] +
          (1 - mu) * this.deltas[(index + 1) % this.deltas.length]
      }

      this.t += dt
    }

    // Copy to other channels
    for (let k = 0; k < outputs.length; ++k) {
      for (let j = 0; j < outputs[k].length; ++j) {
        if (!k && !j) {
          continue
        }
        for (let i = 0; i < outputs[k][j].length; ++i) {
          outputs[k][j][i] = outputs[0][0][i]
        }
      }
    }

    return true
  }
}

registerProcessor('arpeggio-processor', ArpeggioProcessor)
