import { ref } from 'vue'
import { defineStore } from 'pinia'
// This is broken in production mode
// import arpeggioProcessorUrl from "../audio-processor.ts?url"

const SILENCE = 1e-6

const audioLag = navigator.userAgent.includes('Chrome') ? 0.001 : 0.03

export const useAudioContextStore = defineStore('audio-context', () => {
  const context = ref<AudioContext | null>(null)
  const gain = ref<GainNode | null>(null)
  const arpeggiator0 = ref<AudioWorkletNode | null>(null)
  const arpeggiator1 = ref<AudioWorkletNode | null>(null)
  const noiseFilter = ref<BiquadFilterNode | null>(null)
  const noiseGain = ref<GainNode | null>(null)
  const noise = ref<AudioWorkletNode | null>(null)
  const plopEnvelope = ref<ConstantSourceNode | null>(null)
  const plopDetuner = ref<GainNode | null>(null)
  const plopOscillator = ref<OscillatorNode | null>(null)
  const plopGain = ref<GainNode | null>(null)

  // Should be called in response to user interaction.
  async function initialize() {
    if (context.value) {
      context.value.resume()
      return
    }
    // XXX: Build is broken. Hack it together.
    let url = '/audio-processor.js'
    if (import.meta.env.DEV) {
      url = '/src/audio-processor.ts'
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
    noiseGain.value = context.value.createGain()
    noiseGain.value.gain.setValueAtTime(SILENCE, now)
    noise.value = new AudioWorkletNode(context.value, 'noise-processor')
    noise.value
      .connect(noiseGain.value)
      .connect(noiseFilter.value)
      .connect(context.value.destination)

    plopEnvelope.value = context.value.createConstantSource()
    plopEnvelope.value.offset.setValueAtTime(SILENCE, now)
    plopDetuner.value = context.value.createGain()
    plopDetuner.value.gain.setValueAtTime(1200, now)
    plopOscillator.value = context.value.createOscillator()
    plopOscillator.value.frequency.setValueAtTime(300, now)
    plopGain.value = context.value.createGain()
    plopGain.value.gain.setValueAtTime(0, now)
    plopEnvelope.value.connect(plopDetuner.value).connect(plopOscillator.value.detune)
    plopEnvelope.value.connect(plopGain.value.gain)
    plopOscillator.value.connect(plopGain.value).connect(context.value.destination)
    plopEnvelope.value.start(now)
    plopOscillator.value.start(now)
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
    if (noiseGain.value) {
      noiseGain.value.disconnect()
    }
    if (noise.value) {
      noise.value.disconnect()
    }
    if (plopEnvelope.value) {
      plopEnvelope.value.stop()
      plopEnvelope.value.disconnect()
    }
    if (plopDetuner.value) {
      plopDetuner.value.disconnect()
    }
    if (plopOscillator.value) {
      plopOscillator.value.stop()
      plopOscillator.value.disconnect()
    }
    if (plopGain.value) {
      plopGain.value.disconnect()
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

  function impact(frequencyOffset = 0) {
    if (!context.value || !noise.value || !noiseGain.value || !noiseFilter.value) {
      return
    }
    const now = context.value.currentTime + audioLag
    const nat = noise.value.parameters.get('nat')!
    nat.cancelScheduledValues(now)
    nat.setValueAtTime(Math.log(9000 + Math.random() * 300 + frequencyOffset), now)
    nat.linearRampToValueAtTime(Math.log(6000 + Math.random() * 200 + frequencyOffset), now + 0.11)
    noiseGain.value.gain.cancelScheduledValues(now)
    noiseGain.value.gain.setValueAtTime(0.15, now)
    noiseGain.value.gain.exponentialRampToValueAtTime(SILENCE, now + 0.31)
    noiseFilter.value.frequency.setTargetAtTime(
      3800 + Math.random() * 400 + frequencyOffset * 0.2,
      now,
      0.01
    )
  }

  function plop(frequencyOffset = 0) {
    if (!context.value || !plopEnvelope.value || !plopOscillator.value) {
      return
    }
    const now = context.value.currentTime + audioLag
    plopEnvelope.value.offset.cancelScheduledValues(now)
    plopOscillator.value.frequency.cancelScheduledValues(now)
    plopEnvelope.value.offset.setTargetAtTime(0.33 + Math.random() * 0.05, now, 0.004)
    plopEnvelope.value.offset.setTargetAtTime(SILENCE, now + 0.015, 0.015)
    plopOscillator.value.frequency.setTargetAtTime(
      280 + Math.random() * 40 + frequencyOffset,
      now,
      0.01
    )
  }

  return {
    initialize,
    unintialize,
    arpeggiate,
    impact,
    plop
  }
})
