import { ref } from 'vue'
import { defineStore } from 'pinia'
// This is broken in production mode
// import arpeggioProcessorUrl from "../audio-processor.ts?url"

export const useAudioContextStore = defineStore('audio-context', () => {
  const context = ref<AudioContext | null>(null)
  const gain = ref<GainNode | null>(null)
  const processor0 = ref<AudioWorkletNode | null>(null)
  const processor1 = ref<AudioWorkletNode | null>(null)

  // Should be called in response to user interaction.
  async function initialize() {
    if (context.value !== null) {
      return
    }
    // XXX: Build is broken. Hack it together.
    let url = 'audio-processor.js'
    if (process.env.NODE_ENV === 'development') {
      url = 'src/audio-processor.ts'
    }
    context.value = new AudioContext({ latencyHint: 'interactive' })
    await context.value.audioWorklet.addModule(url)
    gain.value = context.value.createGain()
    gain.value.gain.setValueAtTime(0.3, context.value.currentTime)
    processor0.value = new AudioWorkletNode(context.value, 'arpeggio-processor')
    processor0.value.connect(gain.value).connect(context.value.destination)
    processor1.value = new AudioWorkletNode(context.value, 'arpeggio-processor')
    processor1.value.connect(gain.value)
  }

  async function unintialize() {
    if (context.value === null) {
      return
    }
    if (gain.value) {
      gain.value.disconnect()
    }
    if (processor0.value) {
      processor0.value.disconnect()
    }
    if (processor1.value) {
      processor1.value.disconnect()
    }
    await context.value.close()
    context.value = null
  }

  function arpeggiate(channel: number, params: any) {
    if (processor0.value === null || processor1.value === null) {
      return
    }
    if (channel) {
      processor1.value.port.postMessage(params)
    } else {
      processor0.value.port.postMessage(params)
    }
  }

  return {
    initialize,
    unintialize,
    arpeggiate
  }
})
