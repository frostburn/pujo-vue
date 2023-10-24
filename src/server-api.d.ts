import {
  type Replay,
  type ApplicationInfo,
  ReplayMetadata,
  ReplayResult,
  SimpleGame
} from 'pujo-puyo-core'

// TODO: Move to a third repository as co-dependency of pujo-ws-server and pujo-vue.

type GameType = Replay['metadata']['type']

type NormalMove = {
  type: 'move'
  x1: number
  y1: number
  hardDrop: boolean
  pass: false
  msRemaining: number
}

interface OrientedMove extends NormalMove {
  orientation: number
}

interface CoordinatedMove extends NormalMove {
  orientation: undefined
  x2: number
  y2: number
}

type PassingMove = {
  type: 'move'
  pass: true
  msRemaining: number
}

type MoveMessage = OrientedMove | CoordinatedMove | PassingMove

// Incoming (server's perspective)

type GameRequest = {
  type: 'game request'
  gameType: GameType
}

type UserMessage = {
  type: 'user'
  username?: string
  clientInfo?: ApplicationInfo
  authUuid?: string
  socketId?: number
}

type SimpleStateRequest = {
  type: 'simple state request'
}

type ResultMessage = {
  type: 'result'
  reason: 'resignation' | 'timeout'
}

type ClientMessage = GameRequest | UserMessage | SimpleStateRequest | ResultMessage | MoveMessage

// Outgoing (server's perspective)

interface ServerNormalMove extends NormalMove {
  player: number
  x2: number
  y2: number
  orientation: number
}

interface ServerPassingMove extends PassingMove {
  player: number
}

type ServerMoveMessage = ServerNormalMove | ServerPassingMove

type GameParams = {
  type: 'game params'
  colorSelection: Replay['colorSelection']
  screenSeed: Replay['screenSeed']
  targetPoints: Replay['targetPoints']
  marginFrames: Replay['marginFrames']
  identity: number
  metadata: ReplayMetadata
}

type BagMessage = {
  type: 'bag'
  player: number
  bag: number[]
}

type GameResult = {
  type: 'game result'
  winner: ReplayResult['winner']
  reason: ReplayResult['reason']
  msSince1970: ReplayMetadata['endTime']
  gameSeed: Replay['gameSeed']
}

type SimpleState = {
  type: 'simple state'
  state: SimpleGame
}

type TimerMessage = {
  type: 'timer'
  player: number
  msRemaining: number
}

type ServerUserMessage = {
  type: 'user'
  username: string
  eloRealtime: number
  eloPausing: number
}

type ServerMessage =
  | GameParams
  | BagMessage
  | GameResult
  | SimpleState
  | TimerMessage
  | ServerMoveMessage
  | ServerUserMessage
