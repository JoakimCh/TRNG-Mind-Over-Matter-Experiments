
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

const tag = {}

document.body.append(...unwrap(
  e.div.tagAndId('mainContainer', tag)(
    e.h1('The Guess Experiment'),
    e.p('Connect to a peer and try to guess the randomly selected card shown on their screen. This can be done using remote viewing (extra sensory perception) or telepathy with the peer who can see the card. Version: 0.2.'),
    peerConnection.uiContainer,
    e.form.tagAndId('form_selectSide', tag)(
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
          e.input.tagAndId('checkbox_ready', tag)
          .type('checkbox').name('ready').value('me')
        ),
        e.label('Peer:',
          e.input.tagAndId('checkbox_peerReady', tag)
          .type('checkbox').name('ready').value('peer')
        ).style({pointerEvents: 'none'})
      )
    ).class('horizontal').hidden(true),
    e.div.tagAndId('ui_game', tag)(
      e.div.tagAndId('ui_table', tag)(...((cards = []) => {
        for (const variant of ['star','box','waves','cross','circle']) {
          const card = e.div(
            e.img.draggable(false).src(`zener/${variant}.svg`)
          ).class('card')
          cards.push(card)
        }
        return cards
      })()).set('disabled'),
      e.div.tagAndId('ui_viewer', tag)(
        e.p(`This is the card your peer must guess to score.`, e.br, 
        `(either through remote viewing or telepathic ability)`, e.br, 
          `You can help by transmitting it telepathically!`)
      ).class('vertical').hidden(true),
      e.div.tagAndId('ui_guesser1', tag)(
        e.p(`A random card is shown to your peer, to score see if you can guess which!`, e.br, 
        `(remote view it or use telepathic abilities)`),
        e.button.tag('button_viewCards', tag)('Make your guess')
      ).class('vertical').hidden(true),
      e.div.tagAndId('ui_guesser2', tag)(
        e.button('Submit your guess!').tag('button_guess', tag),
      ).class('vertical').hidden(true),
      e.div.tagAndId('ui_score', tag).class('vertical')(
        e.span('Total score: ', e.span('0 / 0').tag('text_myScore', tag)),
        e.span('Last 10 guesses: ', e.span('0 / 0').tag('text_myLast10', tag))
      ).hidden(true),
    ),
    e.p('Made by Joakim L. Christiansen.', e.br, 'See the open source ', e.a('code at GitHub').href('https://github.com/JoakimCh/TRNG-Mind-Over-Matter-Experiments/tree/main/guess'), '.')
  )
))

const cards = document.querySelectorAll('.card')
//const cards = document.getElementsByClassName('card')
const prng = new PRNG()
const peerRpc = new RPCBridge()
let lastSide
peerConnection.setRpcBridge(peerRpc)
peerRpc.on('open', () => {
  tag.form_selectSide.hidden = false
  // score = {
  //   me:   new Score(peerConnection.myId),
  //   peer: new Score(peerConnection.peerId),
  // }
})
peerRpc.on('peerReady', ready => {
  tag.checkbox_peerReady.checked = ready
})
parallel(tag.form_selectSide.elements['ready']).onchange = () => {
  const ready = tag.checkbox_ready.checked && tag.checkbox_peerReady.checked
  if (!ready || !peerConnection.isDominant) {
    return // not ready or not the deciding side
  }
  let mySide = tag.form_selectSide.elements['side'].value
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
  hide('form_selectSide')
  if (side == 'guesser') {
    hide('ui_table'); show('ui_guesser1')
    tag.button_viewCards.onclick = () => {
      hide('ui_guesser1'); show('ui_guesser2', 'ui_table')
      enable('ui_table')
      disable('button_guess')
      parallel(cards).onclick = ({currentTarget}) => {
        parallel(cards).classList.remove('selected')
        currentTarget.classList.add('selected')
        enable('button_guess')
      }
      tag.button_guess.onclick = () => {
        disable('button_guess')
        let correctIndex = prng.integer(4)
        cards[correctIndex].classList.add('correct')
        parallel(cards).classList.add('showdown')
        // the css hides cards with .showdown which is missing .correct or .selected
        const selectedIndex = 
        parallel(cards).classList.contains('selected').indexOf(true)
        log(correctIndex, selectedIndex)
        if (selectedIndex == correctIndex) {
          
        }
      }
    }
  } else if (side == 'viewer') {

  } else throw Error('lol')
})

peerRpc.localEmit('open'); tag.checkbox_peerReady.checked = true
peerRpc.localEmit('gameStart', {side: 'guesser'})


// parallel(cards).classList.remove('correct', 'selected', 'hidden')

//#region shit
function groupPropChange(group, elementNames, prop, value) {
  for (const elementName of elementNames) {
    group[elementName][prop] = value
  }
}
function groupAttrChange(group, elementNames, attribute, present) {
  for (const elementName of elementNames) {
    if (present) {
      group[elementName].setAttribute(attribute,'')
    } else {
      group[elementName].removeAttribute(attribute)
    }
  }
}
function hide(...elementNames) {
  groupPropChange(tag, elementNames, 'hidden', true)
}
function show(...elementNames) {
  groupPropChange(tag, elementNames, 'hidden', false)
}
function disable(...elementNames) {
  groupAttrChange(tag, elementNames, 'disabled', true)
}
function enable(...elementNames) {
  groupAttrChange(tag, elementNames, 'disabled', false)
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
