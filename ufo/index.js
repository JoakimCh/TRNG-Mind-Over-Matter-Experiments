
import {TRNG} from '../TRNG.browser.js'
import {log, css} from '../common.js'

css.fromFile('style.css')

const trng = new TRNG({
  // one u32 60 times per second
  blockSize: Math.trunc(44100 / 30),
  outputLength: 1
})

const start = document.createElement('button')
const stop = document.createElement('button')
start.textContent = 'Start experiment'
stop.textContent = 'Stop experiment'
document.body.append(start)

let running
const ufo = document.createElement('img')
document.body.append(ufo)
ufo.id = 'ufo'
ufo.src = 'ufo.png'
let topPosition = window.innerHeight - ufo.offsetHeight
let position = 0
ufo.style.bottom = `${Math.trunc(position)}px`

window.addEventListener('resize', () => {
  const positionF =  position / topPosition
  topPosition = window.innerHeight - ufo.offsetHeight
  position = topPosition * positionF
  ufo.style.bottom = `${Math.trunc(position)}px`
})

function updateUfoPosition() {
  if (running) {
    requestAnimationFrame(updateUfoPosition)
  } else {
    position = 0
  }
  if (position > topPosition || position < 0) {
    position = Math.max(0, Math.min(position, topPosition))
  }
  ufo.style.bottom = `${Math.trunc(position)}px`
}

start.onclick = async () => {
  if (trng.start()) {
    start.remove()
    // document.body.append(stop)
    running = true
    updateUfoPosition()
    while (running) {
      const u32 = await trng.uInt32()
      let deviation = 0
      for (let i=0; i<32; i++) {
        const bit = u32 >> i & 1
        deviation += bit ? 1 : -1
      }
      position += Math.abs(deviation) / 5
      if (position > 0) {
        position --
      }
    }
  }
}
stop.onclick = () => {
  if (trng.stop()) {
    stop.remove()
    document.body.append(start)
    running = false
  }
}
