
import {TRNG} from '../TRNG.browser.js'
import {log, pageSetup, e} from '../wrapped-elements/wrapped-elements.js'

pageSetup({
  title: 'UFO Experiment',
  favicon: 'icon.png',
  stylesheets: 'style.css',
  stylesheetsAsLinks: true // LiveReload compat.
})

let start, stop, ufo

document.body.append(
  e.h1('UFO Experiment'),
  e.p('Use your mind to make it hover. ', e.small(
    'One of my different ',
    e.a.href('../')('TRNG based experiments'), '.'
  )),
  start = e.button('Start experiment'),
  stop = e.button.hidden(true)('Stop experiment'),
  ufo = e.img.id('ufo').src('ufo.png').style({bottom: '0px'})()
)

log('All is good! 😎')

const trng = new TRNG({ // one u32 30 times per second
  blockSize: Math.trunc(44100 / 30),
  outputLength: 1
})

let running, wakeLock
let topPosition = window.innerHeight - ufo.offsetHeight
let position = 0

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
  if (await trng.start()) {
    start.remove()
    running = true
    wakeLock = await navigator.wakeLock?.request()
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
    wakeLock?.release()
  }
}
