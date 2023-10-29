import {
  WIDTH,
  type GameState,
  MultiplayerGame,
  type TickResult,
  GHOST_Y,
  DEFAULT_MARGIN_FRAMES
} from 'pujo-puyo-core'

export type Chain = {
  number: number
  age: number
  x: number
  y: number
}

const MAX_CHAIN_CARD_AGE = 100

export class ChainDeck {
  chains: Chain[][]
  ignitionCenters: number[][]

  constructor() {
    this.chains = [[], []]
    this.ignitionCenters = [
      [0, 0],
      [0, 0]
    ]
  }

  clone(): ChainDeck {
    const result = new ChainDeck()
    result.chains = this.chains.map((cs) => cs.map((c) => ({ ...c })))
    result.ignitionCenters = this.ignitionCenters.map((i) => [...i])
    return result
  }

  processTick(game: MultiplayerGame, tickResults: TickResult[]) {
    for (let i = 0; i < this.chains.length; ++i) {
      for (const chain of this.chains[i]) {
        chain.age++
      }
      while (this.chains[i][0]?.age > MAX_CHAIN_CARD_AGE) {
        this.chains[i].shift()
      }
    }

    let states: GameState[] | undefined
    for (let i = 0; i < tickResults.length; ++i) {
      if (tickResults[i].didJiggle) {
        if (states === undefined) {
          states = game.state
        }
        let numIgnitions = 0
        let x = 0
        let y = 0
        states[i].screen.ignited.slice(WIDTH * (GHOST_Y + 1)).forEach((flag, index) => {
          if (flag) {
            x += index % WIDTH
            y += Math.floor(index / WIDTH)
            numIgnitions++
          }
        })
        if (numIgnitions) {
          this.ignitionCenters[i][0] = x / numIgnitions
          this.ignitionCenters[i][1] = y / numIgnitions
        }
      }
      if (tickResults[i].didClear) {
        this.chains[i].push({
          number: tickResults[i].chainNumber,
          age: 0,
          x: this.ignitionCenters[i][0],
          y: this.ignitionCenters[i][1]
        })
      }
    }
  }
}

export class DeckedGame extends MultiplayerGame {
  deck: ChainDeck

  constructor(
    seed?: number | null,
    colorSelection?: number[],
    screenSeed?: number,
    targetPoints?: number[],
    marginFrames = DEFAULT_MARGIN_FRAMES
  ) {
    super(seed, colorSelection, screenSeed, targetPoints, marginFrames)
    this.deck = new ChainDeck()
  }

  tick() {
    const results = super.tick()
    this.deck.processTick(this, results)
    return results
  }

  clone(preserveSeed = false) {
    const result = super.clone(preserveSeed)
    result.deck = this.deck.clone()
    return result
  }
}
