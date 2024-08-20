
import {TRNG} from '../TRNG.browser.js'
import {log, pageSetup, e, tags, wrap, unwrap} from '../wrapped-elements/wrapped-elements.js'

pageSetup({
  title: 'UFO Experiment',
  favicon: 'icon.png',
  stylesheets: 'style.css'
})

document.body.append(...unwrap(
  e.h1('UFO Experiment'),
  e.p('Use your mind to make it hover. ', e.small(
    'One of my different ',
    e.a('TRNG based experiments').href('../'), '.'
  )),
  e.button('Start experiment').tag('start'),
  e.button('Stop experiment').tag('stop').hidden(true),
  e.img.tagAndId('ufo').src('ufo.png').style({bottom: '0px'})
))

const {start, stop, ufo} = tags

log('All is good! 😎')

const trng = new TRNG({ // one u32 30 times per second
  blockSize: Math.trunc(44100 / 30),
  outputLength: 1
})

let running
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

let wakeLock
start.onclick = async () => {
  if (await trng.start()) {
    start.remove()
    // document.body.append(stop)
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
