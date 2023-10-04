class MonoProcessor extends AudioWorkletProcessor {
  constructor(options?: AudioWorkletNodeOptions) {
    super(options)
    this.port.onmessage = this.onMessage.bind(this)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onMessage(event: MessageEvent) {}

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    parameters: Record<string, Float32Array>
  ) {
    // Copy to other channels
    for (let j = 0; j < outputs.length; ++j) {
      for (let i = 0; i < outputs[j].length; ++i) {
        if (j || i) {
          outputs[j][i].set(outputs[0][0])
        }
      }
    }

    return true
  }
}

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

class ArpeggioProcessor extends MonoProcessor {
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

    return super.process(inputs, outputs, parameters)
  }
}

registerProcessor('arpeggio-processor', ArpeggioProcessor)

/**
 * IBM's RANDU is widely considered to be one of the most ill-conceived random number generators ever designed,
 * and was described as "truly horrible" by Donald Knuth. It fails the spectral test badly for dimensions greater than 2[...]
 * from: https://en.wikipedia.org/wiki/RANDU
 **/
class RANDU {
  v: number

  constructor(v?: number) {
    if (v === undefined) {
      v = 1 + 2 * Math.floor(Math.random() * 1073741823)
    }
    if (!(v & 1)) {
      throw new Error('Value must be odd')
    }
    this.v = v | 0
  }

  // Return a pseudorandom odd number in the interval [1, Math.pow(2, 31) − 1], inclusive.
  step() {
    this.v = (this.v * 65539) & 2147483647
    return this.v
  }

  // Return a pseudorandom number in the interval (0, 1), exclusive.
  step01() {
    return this.step() * 4.656612873077393e-10
  }
}

/**
 * Stepwise noise generator with frequency control.
 */
class NoiseProcessor extends MonoProcessor {
  rng: RANDU
  value: number
  mu: number

  // Static getter to define AudioParam objects in this custom processor.
  static get parameterDescriptors() {
    return [
      /* Pitch in natural units with 1Hz base frequency */
      {
        name: 'nat',
        defaultValue: Math.log(440)
      }
    ]
  }

  constructor(options?: AudioWorkletNodeOptions) {
    super(options)
    this.rng = new RANDU()
    this.value = 0
    this.mu = 0
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ) {
    // Can happen due to user passing in crazy values.
    if (isNaN(this.mu)) {
      this.mu = 0
    }
    const dt = 1 / sampleRate
    const natValues = parameters.nat
    const frequencies = natValues.map(Math.exp)
    for (let i = 0; i < outputs[0][0].length; ++i) {
      const frequency = frequencies[Math.min(frequencies.length - 1, i)]
      // Advance using heavy jitter to reduce aliasing.
      this.mu += (0.5 + this.rng.step01()) * frequency * dt
      if (this.mu >= 1) {
        this.value = this.rng.step01() * 2 - 1
        this.mu %= 1
      }
      outputs[0][0][i] = this.value
    }

    return super.process(inputs, outputs, parameters)
  }
}

registerProcessor('noise-processor', NoiseProcessor)
