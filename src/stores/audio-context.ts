import { ref } from 'vue'
import { defineStore } from 'pinia'
// This is broken in production mode
// import arpeggioProcessorUrl from "../audio-processor.ts?url"

const SILENCE = 1e-6

export const useAudioContextStore = defineStore('audio-context', () => {
  const context = ref<AudioContext | null>(null)
  const gain = ref<GainNode | null>(null)
  const arpeggiator0 = ref<AudioWorkletNode | null>(null)
  const arpeggiator1 = ref<AudioWorkletNode | null>(null)
  const noiseFilter = ref<BiquadFilterNode | null>(null)
  const noiseGate = ref<GainNode | null>(null)
  const noise = ref<AudioWorkletNode | null>(null)

  // Should be called in response to user interaction.
  async function initialize() {
    if (context.value) {
      return
    }
    // XXX: Build is broken. Hack it together.
    let url = 'audio-processor.js'
    if (process.env.NODE_ENV === 'development') {
      url = 'src/audio-processor.ts'
    }
    context.value = new AudioContext({ latencyHint: 'interactive' })
    await context.value.audioWorklet.addModule(url)

    const now = context.value.currentTime
    gain.value = context.value.createGain()
    gain.value.gain.setValueAtTime(0.3, now)
    arpeggiator0.value = new AudioWorkletNode(context.value, 'arpeggio-processor')
    arpeggiator0.value.connect(gain.value).connect(context.value.destination)
    arpeggiator1.value = new AudioWorkletNode(context.value, 'arpeggio-processor')
    arpeggiator1.value.connect(gain.value)

    noiseFilter.value = context.value.createBiquadFilter()
    noiseFilter.value.type = 'lowpass'
    noiseFilter.value.frequency.setValueAtTime(4000, now)
    noiseFilter.value.Q.setValueAtTime(2.9, now)
    noiseGate.value = context.value.createGain()
    noiseGate.value.gain.setValueAtTime(SILENCE, now)
    noise.value = new AudioWorkletNode(context.value, 'noise-processor')
    noise.value
      .connect(noiseGate.value)
      .connect(noiseFilter.value)
      .connect(context.value.destination)
  }

  async function unintialize() {
    if (!context.value) {
      return
    }
    if (gain.value) {
      gain.value.disconnect()
    }
    if (arpeggiator0.value) {
      arpeggiator0.value.disconnect()
    }
    if (arpeggiator1.value) {
      arpeggiator1.value.disconnect()
    }
    if (noiseFilter.value) {
      noiseFilter.value.disconnect()
    }
    if (noiseGate.value) {
      noiseGate.value.disconnect()
    }
    if (noise.value) {
      noise.value.disconnect()
    }
    await context.value.close()
    context.value = null
  }

  function arpeggiate(channel: number, params: any) {
    if (!arpeggiator0.value || !arpeggiator1.value) {
      return
    }
    if (channel) {
      arpeggiator1.value.port.postMessage(params)
    } else {
      arpeggiator0.value.port.postMessage(params)
    }
  }

  function impact() {
    if (!context.value || !noise.value || !noiseGate.value || !noiseFilter.value) {
      return
    }
    const now = context.value.currentTime
    const nat = noise.value.parameters.get('nat')!
    nat.cancelScheduledValues(now)
    nat.setValueAtTime(Math.log(9000 + Math.random() * 300), now)
    nat.linearRampToValueAtTime(Math.log(6000 + Math.random() * 200), now + 0.11)
    noiseGate.value.gain.cancelScheduledValues(now)
    noiseGate.value.gain.setValueAtTime(0.15, now)
    noiseGate.value.gain.exponentialRampToValueAtTime(SILENCE, now + 0.31)
    noiseFilter.value.frequency.setTargetAtTime(3800 + Math.random() * 400, now, 0.01)
  }

  return {
    initialize,
    unintialize,
    arpeggiate,
    impact
  }
})
