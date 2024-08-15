
class TRNG extends AudioWorkletProcessor {
  #cfg = {
    blockSize: 1000, // num of samples to collect before extracting random data
    outputSize: 0, // size of random data to extract from the block
  }
  /** @type {Float32Array} */
  #block
  #blockIndex = 0

  constructor({processorOptions}) {
    super(...arguments)
    if (typeof processorOptions == 'object') {
      for (const key in processorOptions) {
        if (key in this.#cfg) {
          this.#cfg[key] = processorOptions[key]
        }
      }
    }
    console.log(this.#cfg)
    this.#block = new Float32Array(this.#cfg.blockSize)
  }

  process(inputs) {
    const samples = inputs[0][0] // as Float32Array
    if (!samples) return true
    if (samples[0] === 0 && samples[1] === 0 && samples[2] === 0) {
      return true // skip if zero filled
    }
    this.#handleSamples(samples)
    return true // returning true forces the browser to keep the node alive
  }

  #handleSamples(samples) {
    let samplesIndex = 0
    // fill up blocks and handle them
    while (samplesIndex < samples.length && this.#blockIndex < this.#block.length) {
      const missingSamples = this.#block.length - this.#blockIndex
      const toInsert = samples.subarray(samplesIndex, samplesIndex + missingSamples)
      samplesIndex += toInsert.length
      this.#block.set(toInsert, this.#blockIndex)
      this.#blockIndex += toInsert.length
      if (this.#blockIndex == this.#block.length) {
        this.#blockIndex = 0
        this.#samplesToRandomData() // handle the block
      }
    }
  }

  /** Use noise in the samples to create random data. */
  #samplesToRandomData() {
    // The idea here is to make it so a soul/spirit (or mind over matter) could easily push for a desired outcome without having to change too many bits (less friction).
    const samples = this.#block
    fisherYatesShuffle(samples) // (to pick from random time offsets)
    // if a size is set use it else it's at least used 16 samples to create 1 byte
    const bytes = new Uint8Array(this.#cfg.outputSize || Math.trunc(samples.length / 16))
    let randomByte = 0, bitIndex = 0, sampleIndex = 0, byteIndex = 0
    while (sampleIndex <= samples.length - 2) {
      // convert f32 to u16 then read bits from the abs (2 bits of noise)
      const a = Math.abs(Math.trunc(samples[sampleIndex++] * 32767)) & 0b11
      const b = Math.abs(Math.trunc(samples[sampleIndex++] * 32767)) & 0b11
      if (a == b) continue
      if (a < b) {
        randomByte |= 1 << bitIndex
      }
      if (++bitIndex == 8) {
        bytes[byteIndex++] = randomByte
        randomByte = 0
        bitIndex = 0
        if (this.#cfg.outputSize && byteIndex == this.#cfg.outputSize) {
          break
        }
      }
    }
    if (this.#cfg.outputSize == 0 || byteIndex == this.#cfg.outputSize) {
      const buffer = (byteIndex == bytes.length ? bytes.buffer : bytes.buffer.slice(0, byteIndex))
      this.port.postMessage({data: buffer}, [buffer])
    } else {
      this.port.postMessage({
        data: bytes.buffer,
        truncated: byteIndex,
        error: `TRNG outputSize (${this.#cfg.outputSize}) is more than it could gather (${byteIndex}) from the blockSize (${this.#cfg.blockSize}). Which usually means that it's receiving poor input data or has a too small blockSize.`
      }, [bytes.buffer])
    }
  }
}

registerProcessor('TRNG', TRNG)

function fisherYatesShuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}
