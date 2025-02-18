
import {e, unwrap, parallel, log, debug, pageSetup} from 'wrapped-elements'
import {PRNG} from 'tiny-prng'
import {RPCBridge} from 'rpc-bridge'
// import {BinaryTemplate, t} from 'jlc-serializer'

await pageSetup({
  title: 'Guess Experiment',
  allowDarkTheme: false, // skip the style injection for this
  stylesheets: 'style.css',
  favicon: false // set to a blank one
})

// peerConnection.uiContainer can then adopt the stylesheets loaded
const peerConnection = await import('./peerConnection.js')

/* todo 
on connection hide table and display side selector,
radio for which peer is remote viewer:
remote viewer: you (), peer (), alternate (*)
whenever someone clicks it changes for both... so they can fight
then ready checkbox and a text indicating if peer is ready, ready is deselected on each switch
when both ready it starts, first with text on which side you are:
"A random card is shown to your peer, to score see if you can guess which!
     (remote view it or use your telepathic ability)"
[show cards] (then shows the cards and you can make selection)
other side:
header below cards: "this is the card your peer must guess to score
        (either through remote viewing or telepathic ability)
          you can help by transmitting it telepathically"

stats are stored in the browser and can be downloaded as a csv
then stats for each peer and session and total stats, etc
a stat viewer is WIP...

if alternating then total and last10 lines can include stats for both e.g. 10 / 10 (me) 10 / 10 (peer)
*/

const ui = {}//, button = {}, container = {}, text = {}

document.body.append(
  ui.mainContainer = e.div.id('mainContainer')(
    e.h1('The Guess Experiment'),
    e.p('Connect to a peer and try to guess the randomly selected card shown on their screen. This can be done using remote viewing (extra sensory perception) or telepathy with the peer who can see the card. Version: 0.2.'),
    peerConnection.uiContainer,
    ui.selectSide = e.form.id('form_selectSide')(
      e.fieldset(e.legend('Select side:'),
        e.label('Guesser:',
          e.input.type('radio').name('side').value('guesser')
        ),
        e.label('Viewer:',
          e.input.type('radio').name('side').value('viewer')
        ),
        e.label('Alternate:',
          e.input.type('radio').name('side').value('alternate')
          .checked(true)
        )
      ),
      e.fieldset(e.legend('Ready to start?'),
        e.label('Me:',
          ui.checkbox_ready = e.input.id('checkbox_ready')
          .type('checkbox').name('ready').value('me')
        ),
        e.label('Peer:',
          ui.checkbox_peerReady = e.input.id('checkbox_peerReady')
          .type('checkbox').name('ready').value('peer')
        ).style({pointerEvents: 'none'})
      )
    ).class('horizontal').hidden(true),
    ui.game = e.div.id('ui_game')(
      ui.table = e.div.id('ui_table')(...((cards = []) => {
        for (const variant of ['star','box','waves','cross','circle']) {
          const card = e.div(
            e.img.draggable(false).src(`zener/${variant}.svg`)
          ).class('card')
          cards.push(card)
        }
        return cards
      })()).set('disabled'),
      ui.score = e.div.id('ui_score').class('vertical')(
        ui.text_myScore = e.span('Total score: ', e.span('0 / 0')),
        ui.text_myLast10 = e.span('Last 10 guesses: ', e.span('0 / 0'))
      ).hidden(true),
    ),
    e.p('Made by Joakim L. Christiansen.', e.br, 'See the open source ', e.a('code at GitHub').href('https://github.com/JoakimCh/TRNG-Mind-Over-Matter-Experiments/tree/main/guess'), '.')
  ).element
)

const cards = document.querySelectorAll('.card')
//const cards = document.getElementsByClassName('card')
const prng = new PRNG()
const peerRpc = new RPCBridge()
let lastSide
peerConnection.setRpcBridge(peerRpc)
peerRpc.on('open', () => {
  ui.selectSide.hidden = false
  // score = {
  //   me:   new Score(peerConnection.myId),
  //   peer: new Score(peerConnection.peerId),
  // }
})
peerRpc.on('peerReady', ready => {
  ui.checkbox_peerReady.checked = ready
})
parallel(ui.selectSide.elements['ready']).onchange = () => {
  const ready = ui.checkbox_ready.checked && ui.checkbox_peerReady.checked
  if (!ready || !peerConnection.isDominant) {
    return // not ready or not the deciding side
  }
  let mySide = ui.selectSide.elements['side'].value
  if (mySide == 'alternate') {
    mySide = (lastSide == 'viewer' ? 'guesser' : 'viewer')
  }
  lastSide = mySide
  peerRpc.localEmit('gameStart', {
    side: mySide
  })
  // peerRpc.emit('gameStart', {
  //   side: (mySide == 'viewer' ? 'guesser' : 'viewer')
  // })
}
peerRpc.on('gameStart', ({side, }) => {
  hide(ui.selectSide)
  if (side == 'guesser') {
    hide(ui.table)
    const container = e.div.class('vertical')(
      e.p(`A random card is shown to your peer, to score see if you can guess which!`, e.br, `(remote view it or use telepathic abilities)`),
      e.button('Make your guess').onclick(viewCards)
    )
    ui.table.after(container.element)
    function viewCards() {
      container.replaceChildren()
      show(ui.table); enable(ui.table)
      let firstGuess = true
      parallel(cards).onclick = ({currentTarget}) => {
        parallel(cards).classList.remove('selected')
        currentTarget.classList.add('selected')
        if (firstGuess) { firstGuess = false
          container.add(e.button('Submit your guess!').onclick(submitGuess))
        }
      }
    }
    function submitGuess({currentTarget}) {
      currentTarget.remove()
      let correctIndex = prng.integer(4)
      cards[correctIndex].classList.add('correct')
      parallel(cards).classList.add('showdown')
      // the css hides cards with .showdown which is missing .correct or .selected
      const selectedIndex = parallel(cards).classList.contains('selected').indexOf(true)
      if (selectedIndex == correctIndex) {
        container.add(e.p(`Correct!`))
      } else {
        container.add(e.p(`Wrong.`))
      }
      container.add(e.button('Ready for next round').onclick(waitNextRound))
    }
    function waitNextRound({currentTarget}) {
      currentTarget.remove()
      container.add(e.p(`Waiting for the peer to be ready...`))
      // fake for now:
      setTimeout(() => {
        container.remove()
        parallel(cards).classList.remove('correct', 'selected', 'showdown')
        peerRpc.localEmit('gameStart', {side})
      }, 2000)
    }
  } else if (side == 'viewer') {
    // e.div.tagAndId('ui_viewer', ui)(
    //   e.p(`This is the card your peer must guess to score.`, e.br, 
    //   `(either through remote viewing or telepathic ability)`, e.br, 
    //     `You can help by transmitting it telepathically!`)
    // ).class('vertical').hidden(true),
  } else throw Error('lol')
})

peerRpc.localEmit('open'); ui.checkbox_peerReady.checked = true
peerRpc.localEmit('gameStart', {side: 'guesser'})

//#region shit
function hide(...elements) {
  parallel(elements).hidden = true
}
function show(...elements) {
  parallel(elements).hidden = false
}
function disable(...elements) {
  parallel(elements).setAttribute('disabled','')
}
function enable(...elements) {
  parallel(elements).removeAttribute('disabled')
}

class Score {
  id = ''; total = 0; games = 0; last10 = []
  constructor(id) {
    this.id = id
  }
  register(win) {
    this.games ++
    if (win) this.total ++
    last10.push(win)
    if (this.last10.length > 10) {
      this.last10.shift()
    }
  }
}
let score
//#endregion
