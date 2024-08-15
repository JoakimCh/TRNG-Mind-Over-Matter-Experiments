
import {RunCountAnalyzer} from './runCountAnalyzer.js'
const scriptPath = new URL(import.meta.url).pathname
const parentDirectory = scriptPath.slice(0, scriptPath.lastIndexOf('/')+1)
const log = console.log
const runCounter = new RunCountAnalyzer({blockSize: 1000, maxLength: 9, onBlockDone: counts => {
  // console.table(counts)
}})

export class TRNG {
  /** @type {Uint32Array} */
  #randomUint32s
  #index = -1
  #ignoreSamples = false

  #lastPrint = Date.now()
  #bytesGenerated = 0
  #bytesLastPrint = 0

  /** @type {AudioContext} */
  #audioContext
  /** @type {MediaStream} */
  #micStream
  /** @type {AudioWorkletNode} */
  #worklet

  #cfg

  /**
   * @param {object} options 
   * @param {object} options.blockSize For each `blockSize` of samples extract `outputLength` of random u32s.
   * @param {object} options.outputLength For each `blockSize` of samples extract only `outputLength` of random u32s or set it to 0 to extract the maximum possible.
   */
  constructor({blockSize = 22050, outputLength = 0} = {}) {
    this.#cfg = {blockSize, outputLength}
  }

  /**
   * @param {object} options 
   * @param {object} options.startDelay Milliseconds to discard from first data.
   */
  async start({startDelay = 0} = {}) {
    if (!this.#audioContext) {
      this.#audioContext = new AudioContext()
      await this.#audioContext.audioWorklet.addModule(parentDirectory+'TRNG.audioWorklet.js')
      this.#worklet = new AudioWorkletNode(this.#audioContext, 'TRNG', {
        processorOptions: {
          blockSize: this.#cfg.blockSize,
          outputSize: this.#cfg.outputLength * 4
        }
        // e.g. for each 1000 samples extract 4 bytes of random data
        // (each output byte will consume a minimum of 16 samples)
      })
      this.#worklet.port.onmessage = ({data: {error, data}}) => {
        if (!error) {
          this.#handleData(data)
        } else {
          this.stop()
          throw error
        }
      }
    }
    if (this.#audioContext.state == 'suspended') {
      await audioCtx.resume()
    }
    if (!this.#micStream) {
      console.log('Starting TRNG.')
      this.#micStream = await navigator.mediaDevices.getUserMedia({audio: true})
      const source = this.#audioContext.createMediaStreamSource(this.#micStream)
      source.connect(this.#worklet).connect(this.#audioContext.destination)
      if (startDelay) {
        this.#ignoreSamples = true
        setTimeout(() => {
          this.#ignoreSamples = false
        }, startDelay)
      }
      return true
    }
  }

  stop() {
    if (!this.#micStream) return
    log('Stopping TRNG.')
    this.#micStream.getTracks().forEach(track => track.stop())
    this.#micStream = undefined
    return true
  }
  
  /** This will always keep the buffer fresh with the newest random data.
   * @param {ArrayBuffer} buffer */
  async #handleData(buffer) {
    if (this.#ignoreSamples) return
    this.#randomUint32s = new Uint32Array(buffer, 0,  Math.trunc(buffer.byteLength / 4))
    this.#index = this.#randomUint32s.length - 1
    // runCounter.processData(buffer)
    // this.#bytesGenerated += buffer.byteLength
    // const now = Date.now()
    // if (now >= this.#lastPrint + 1000) {
    //   this.#lastPrint = now
    //   log('bytes last second:', this.#bytesGenerated - this.#bytesLastPrint)
    //   this.#bytesLastPrint = this.#bytesGenerated
    // }
  }

  async uInt32() {
    while (this.#index == -1) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    return this.#randomUint32s[this.#index--]
  }

  async integer(...minMax) {
    const min = minMax.length > 1 ? Math.round(Math.min(...minMax)) : 0
    const max = Math.round(Math.max(...minMax))
    const range = max - min + 1
    const randomFloat = (range <= 0xFFFF_FFFF ? 
      await this.float32() : await this.float64())
    return Math.floor(min + randomFloat * range)
  }

  /** Generate integers linearly weighted towards the low or high side. */
  async linearlyWeightedInteger(preferLow, ...minMax) {
    const min = minMax.length > 1 ? Math.round(Math.min(...minMax)) : 0
    const max = Math.round(Math.max(...minMax))
    const range = max - min + 1
    const floatFunc = (range <= 0xFFFF_FFFF ? this.float32 : this.float64)
    const r1 = await floatFunc.call(this)
    const r2 = await floatFunc.call(this)
    const linearRandom = preferLow ? Math.min(r1, r2) : Math.max(r1, r2)
    return Math.floor(min + linearRandom * range)
  }

  /** Supply an array of weights and randomly select indexes in it (preffering the highest weight). */
  async weightedInteger(weights) {
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    const randomValue = await this.float32(totalWeight)
    let weightSoFar = 0
    for (let i=0; i<weights.length; i++) {
      weightSoFar += weights[i]
      if (randomValue <= weightSoFar) {
        return i
      }
    }
    throw Error(`Should not happen!`)
  }

  /** A float generated from 32 random bits. */
  async float32(...minMax) {
    const randomFloat = await this.uInt32() / 0x1_0000_0000
    // const randomFloat = await this.uInt32() * 2**-32
    let min
    switch (minMax.length) {
      case 0: return randomFloat
      case 1: min = 0; break
      default: min = Math.min(...minMax)
    }
    return min + randomFloat * (Math.max(...minMax) - min)
  }

  /** A fully saturated float64 between min and max (or 0 to max). */
  async float64(...minMax) {  
    // this creates a float from 0 to 0.9999999999999999 (where every bit in the mantissa has a potential to be set)
    const randomFloat = (await this.uInt32() + (await this.uInt32() >>> 11) * 2 ** 32) * 2 ** -53 // 0 to 0.9999999999999999
    let min
    switch (minMax.length) {
      case 0: return randomFloat
      case 1: min = 0; break
      default: min = Math.min(...minMax)
    }
    return min + randomFloat * (Math.max(...minMax) - min)
  }
}
