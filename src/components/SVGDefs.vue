<script setup lang="ts">
import JiggleAnimation from './JiggleAnimation.vue'
import { transformPath } from '@/util'
import {
  CONNECTS_DOWN,
  CONNECTS_LEFT,
  CONNECTS_RIGHT,
  CONNECTS_UP,
  VISIBLE_HEIGHT,
  WIDTH
} from 'pujo-puyo-core'

const pieceBoxD = transformPath(
  'M -0.1 0 ' +
    'A 0.1 0.1 0 0 1 0 -0.1 ' +
    'H 1 ' +
    'A 0.1 0.1 0 0 1 1.1 0 ' +
    'V 2 ' +
    'A 0.1 0.1 0 0 0 1.2 2.1 ' +
    'H 1.5 ' +
    'A 0.1 0.1 0 0 1 1.6 2.2 ' +
    'V 4.2 ' +
    'A 0.1 0.1 0 0 1 1.5 4.3 ' +
    'H 0.5 ' +
    'A 0.1 0.1 0 0 1 0.4 4.2 ' +
    'V 2.2 ' +
    'A 0.1 0.1 0 0 0 0.3 2.1 ' +
    'H 0 ' +
    'A 0.1 0.1 0 0 1 -0.1 2 ' +
    'Z',
  1,
  WIDTH + 0.5
)

const sparkAttrs: { cx: number; cy: number; r: number; key: number }[] = []
for (let i = 0; i < 5; ++i) {
  const theta = (2 * Math.PI * i) / 5
  sparkAttrs.push({
    cx: Math.cos(theta) * 0.3,
    cy: Math.sin(theta) * 0.3,
    r: 0.1,
    key: i
  })
}

// Garbage queue indicators

const spadeD = transformPath(
  'M 0.3 0 ' +
    'Q 0 0.6 0.5 0.8 ' +
    'H -0.5 ' +
    'Q 0 0.6 -0.3 0 ' +
    'C -0.1 1 -1.8 0 0 -1 ' +
    'C 1.8 0 0.1 1 0.3 0 ' +
    'Z',
  0.45
)

let starD = 'M 0 0.3'
const spikeDelta = Math.PI / 5
for (let i = 1; i < 6; ++i) {
  const theta = (2 * Math.PI * i) / 5
  const x1 = 0.7 * Math.sin(theta - spikeDelta)
  const y1 = 0.7 * Math.cos(theta - spikeDelta)
  const x = 0.3 * Math.sin(theta)
  const y = 0.3 * Math.cos(theta)
  starD += ` Q ${x1} ${y1} ${x} ${y}`
}
starD += ' Z'

const moonD = transformPath('M 0 1 A 1.1 1.1 0 1 0 0 -1 A 1.04 1.04 0 0 1 0 1 Z', 0.35, -0.25)

const diamondD = transformPath(
  'M 0 1 Q 0.55 0.55 1 0 Q 0.55 -0.55 0 -1 Q -0.55 -0.55 -1 0 Q -0.55 0.55 0 1 Z',
  0.4
)

const cometD = transformPath(
  'M 0 1 A 1 1 0 0 1 0 -1 L 2 -1 L 0.5 -0.5 L 2.5 -0.1 L 0.3 0.3 L 1 1 Z',
  0.3,
  -0.15
)

// Panels

const connectedPanels: { id: string; points: string; 'clip-path': string }[] = []
for (let i = 0; i < 16; ++i) {
  let points = [
    [0.4, 0.3],
    [0.3, 0.4]
  ]
  if (i & CONNECTS_DOWN) {
    points = points.concat([
      [0.3, 0.6],
      [0.4, 0.7],
      [-0.4, 0.7],
      [-0.3, 0.6]
    ])
  }
  points = points.concat([
    [-0.3, 0.4],
    [-0.4, 0.3]
  ])
  if (i & CONNECTS_LEFT) {
    points = points.concat([
      [-0.6, 0.3],
      [-0.7, 0.4],
      [-0.7, -0.4],
      [-0.6, -0.3]
    ])
  }
  points = points.concat([
    [-0.4, -0.3],
    [-0.3, -0.4]
  ])
  if (i & CONNECTS_UP) {
    points = points.concat([
      [-0.3, -0.6],
      [-0.4, -0.7],
      [0.4, -0.7],
      [0.3, -0.6]
    ])
  }
  points = points.concat([
    [0.3, -0.4],
    [0.4, -0.3]
  ])
  if (i & CONNECTS_RIGHT) {
    points = points.concat([
      [0.6, -0.3],
      [0.7, -0.4],
      [0.7, 0.4],
      [0.6, 0.3]
    ])
  }

  connectedPanels.push({
    id: `panel${i}`,
    points: points.map((pair) => pair.join(',')).join(' '),
    'clip-path': 'url(#square)'
  })
}

// Panel identifiers
const heartD = transformPath('M 0 1 C 1.8 0 0 -1 0 0 C 0 -1 -1.8 0 0 1 Z', 0.3, -0.01, -0.07)
const smallStarD = transformPath(starD, -0.6, 0, -0.015)
const smallMoonD = transformPath(moonD, -0.6)
const smallDiamondD = transformPath(diamondD, -0.6)

// Win counter
const trophyD = transformPath(
  'M 0.5 0 c 0 -1 1 0 0 0 z' +
    'M -0.5 0 c -1 0 0 -1 0 0 z' +
    'M 0.3 1' +
    'C 0.5 -0.5' +
    '  1.1 0.8' +
    '  1.1 -0.6' +
    'H -1.1' +
    'C -1.1 0.8' +
    '  -0.5 -0.5' +
    '  -0.3 1' +
    'q -0.3 0 -0.3 0.3' +
    'H 0.6' +
    'q 0 -0.3 -0.3 -0.3' +
    'Z',
  0.35
)

// Branding
const crescentD = transformPath('M 0 0 A 1 1 0 1 1 0.9 0.8 A 0.8 0.8 0 1 0 0 0 z', 0.95, 0.05, 1.2)
const leafBodyD = transformPath(
  'M 95.475041,101.30591 C 80.828481,79.440826 71.382451,88.591836 56.704531,86.004596 ' +
    'c 2.92477,-1.03198 4.7018,-2.47636 6.31563,-2.95284 -1.426,-4.29393 -2.62952,-1.8623 -5.54008,-2.02377 1.26036,-2.70646 -3.24566,-1.33314 ' +
    '-6.11568,-0.99976 3.06824,-4.89796 6.92345,-2.27433 9.08064,-4.34038 -7.73865,-3.08276 -18.86406,-8.03653 -19.41956,-11.43155 1.98947,-0.002 ' +
    '2.62155,0.93495 4.39894,0.79981 -1.89868,-4.02329 -6.59425,-4.16468 -7.92738,-7.15182 0.85838,-0.1594 1.36744,-0.27273 2.03591,-0.55342 ' +
    '-1.02818,-1.76526 -3.7121,-1.00564 -3.49413,-4.62106 3.04571,1.05035 8.11103,5.73378 10.78526,4.71601 0.55342,-0.80569 -0.0645,-1.02402 ' +
    '-0.45847,-1.49253 2.85789,-1.8117 3.28758,8.10686 15.05493,10.70244 -1.52303,-3.48409 -2.79516,-1.72263 -3.83338,-7.85669 11.75731,2.49057 ' +
    '11.67966,5.3176 17.43009,12.25562 -2.37932,-5.43335 -0.45222,-3.62927 -2.04595,-7.24469 4.698,1.40382 15.45276,11.03961 14.63077,16.50103 ' +
    '3.7731,2.13882 9.32287,9.82569 9.12709,16.0547 0.36976,1.56321 0.7383,2.840194 -1.25412,4.940214 z',
  0.029,
  -0.99,
  -1.2
)
const leafVeinDs = [
  'm 96,98.328566 c -10.25056,-15.90605 -47.2233,-37.04343 -55.91861,-41.85059',
  'm 76.130461,73.090966 c 5.08994,4.52439 9.04878,13.85593 9.04878,13.85593',
  'm 61.638281,62.274846 c 6.78658,6.99867 9.19016,13.50248 9.19016,13.50248',
  'm 61.214111,78.534376 c 7.42283,0 16.47161,2.47427 16.47161,2.47427'
].map((d) => transformPath(d, 0.029, -0.99, -1.2))
</script>

<template>
  <svg width="0" height="0" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <g id="screen-outline">
        <!--Main screen-->
        <rect x="-0.1" y="-0.1" rx="0.1" :width="WIDTH + 0.2" :height="VISIBLE_HEIGHT + 0.2"></rect>
        <!--Piece box-->
        <path :d="pieceBoxD"></path>
      </g>
      <g id="screen">
        <!--Dark background-->
        <use
          href="#screen-outline"
          fill="rgba(0, 0, 0, 0.5)"
          stroke="#101"
          stroke-width="0.16"
        ></use>
        <!--Light dashes-->
        <use
          href="#screen-outline"
          fill="none"
          stroke="#112"
          stroke-width="0.06"
          stroke-dasharray="0.14 0.1 0.2 0.1"
        ></use>
      </g>

      <linearGradient id="fade-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="27%" stop-color="#000"></stop>
        <stop offset="75%" stop-color="#fff"></stop>
      </linearGradient>
      <mask id="fade-mask" maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
        <rect x="-1" y="-1" width="3" height="3" fill="url(#fade-gradient)"></rect>
      </mask>

      <g id="sparks">
        <circle v-for="attrs in sparkAttrs" v-bind="attrs" :key="attrs.key"></circle>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0"
          to="360"
          dur="3s"
          repeatCount="indefinite"
        ></animateTransform>
      </g>

      <!--Garbage queue indicators-->
      <circle id="small" r="0.2"></circle>
      <circle id="large" r="0.39"></circle>
      <path id="spade" :d="spadeD" stroke-linejoin="round"></path>
      <path id="star" :d="starD"></path>
      <path id="moon" :d="moonD"></path>
      <path id="diamond" :d="diamondD"></path>
      <path id="comet" :d="cometD"></path>

      <!--In-grid Garbage-->
      <circle id="garbage" r="0.414"></circle>
      <ellipse id="jiggling-garbage" rx="0.39" ry="0.414">
        <animate
          attributeName="rx"
          values="0.39;0.414;0.39"
          dur="0.25s"
          repeatCount="indefinite"
        ></animate>
        <animate
          attributeName="ry"
          values="0.414;0.39;0.414"
          dur="0.25s"
          repeatCount="indefinite"
        ></animate>
      </ellipse>

      <!--Panels-->
      <clipPath id="square">
        <rect x="-0.505" y="-0.505" width="1.1" height="1.1"></rect>
      </clipPath>
      <polygon v-for="(attrs, i) in connectedPanels" :key="i" v-bind="attrs"></polygon>

      <!--Panel identifiers-->
      <path id="heart" :d="heartD"></path>
      <use id="jiggling-heart" href="#heart">
        <JiggleAnimation />
      </use>
      <path id="small-star" :d="smallStarD"></path>
      <use id="jiggling-star" href="#small-star">
        <JiggleAnimation />
      </use>
      <circle id="small-circle" r="0.2"></circle>
      <use id="jiggling-circle" href="#small-circle">
        <JiggleAnimation />
      </use>
      <path id="small-moon" :d="smallMoonD"></path>
      <use id="jiggling-moon" href="#small-moon">
        <JiggleAnimation />
      </use>
      <path id="small-diamond" :d="smallDiamondD"></path>
      <use id="jiggling-diamond" href="#small-diamond">
        <JiggleAnimation />
      </use>

      <!--Missing panel identifier-->
      <polygon
        id="cross"
        points="0,0.1 0.1,0.2 0.2,0.1 0.1,0 0.2,-0.1 0.1,-0.2 0,-0.1 -0.1,-0.2 -0.2,-0.1 -0.1,0, -0.2,0.1 -0.1,0.2"
      ></polygon>

      <!--Pre-ignition-->
      <filter id="pre-ignite">
        <rect id="flashing" fill="gray">
          <animate
            attributeName="fill"
            values="white;black;white"
            dur="1s"
            repeatCount="indefinite"
          ></animate>
        </rect>
        <feBlend in="SourceGraphic" in2="flashing" mode="overlay"></feBlend>
      </filter>

      <!--All Clear indicator-->
      <path id="all-clear-path" d="M 1.2 2 q 2.05 -0.5 4.2 0"></path>
      <text id="all-clear" class="all-clear">
        <textPath href="#all-clear-path">All Clear</textPath>
      </text>

      <!--Game Over indicator-->
      <g id="game-over">
        <ellipse
          cx="3"
          cy="4.2"
          rx="2.6"
          ry="1.7"
          fill="rgba(0, 0, 0, 0.6)"
          stroke="rgba(0, 0, 0, 0.7)"
          stroke-width="0.1"
        ></ellipse>
        <path id="game-path" d="M 1.2 4 q 1.9 0.4 3.8 0" fill="none"></path>
        <path
          id="over-path"
          d="M 1.4 5.2 q 1.65 0.2 3.3 0"
          fill="none"
          stroke="red"
          stroke-width="0.2"
        ></path>
        <text class="game-over">
          <textPath href="#game-path" textLenght="20%">Game</textPath>
        </text>
        <text class="game-over">
          <textPath href="#over-path" textLength="16%">Over</textPath>
        </text>
      </g>
      <!--Timeout indicator-->
      <g id="timeout">
        <ellipse
          cx="3"
          cy="8.2"
          rx="2.6"
          ry="1.7"
          fill="rgba(10, 20, 50, 0.6)"
          stroke="rgba(10, 20, 50, 0.7)"
          stroke-width="0.1"
        ></ellipse>
        <path
          id="timeout-path"
          d="M 1 8.5 q 2 0.2 4 0"
          fill="none"
          stroke="green"
          stroke-width="0.2"
        ></path>
        <text class="timeout">
          <textPath href="#timeout-path">Timeout</textPath>
        </text>
      </g>
      <!--Opponent thinking indicator-->
      <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.06"></feGaussianBlur>
      </filter>
      <g id="thinking">
        <g>
          <rect
            x="-0.2"
            y="-1.0"
            width="5.5"
            height="2.6"
            rx="0.9"
            ry="0.5"
            fill="black"
            filter="url(#blur)"
          ></rect>
          <rect
            x="-0.25"
            y="-1.1"
            width="5.5"
            height="2.6"
            rx="0.9"
            ry="0.5"
            fill="rgba(230, 240, 256, 0.5)"
            filter="url(#blur)"
          ></rect>
          <animate
            attributeName="opacity"
            values="0.9;0.7;0.9"
            dur="1.5s"
            repeatCount="indefinite"
          ></animate>
        </g>
        <text class="waiting">
          <tspan x="0">Waiting for</tspan>
          <tspan x="0" dy="1em">opponent...</tspan>
        </text>
      </g>

      <!--Win indicator-->
      <path id="trophy" :d="trophyD" fill="gold" stroke="goldenrod" stroke-width="0.04"></path>

      <!--Branding-->
      <g id="logo">
        <path :d="crescentD" fill="goldenrod"></path>
        <path :d="leafBodyD" fill="green"></path>
        <path
          v-for="(d, i) of leafVeinDs"
          :key="i"
          :d="d"
          fill="none"
          stroke="darkgreen"
          stroke-width="0.04"
        ></path>
      </g>
      <g id="plain-logo">
        <path :d="crescentD"></path>
        <path :d="leafBodyD"></path>
      </g>
      <filter id="halo">
        <feGaussianBlur in="sourceGraphic" stdDeviation="0.05"></feGaussianBlur>
      </filter>
      <g id="full-logo">
        <g fill="white" filter="url(#halo)" opacity="0.5">
          <rect x="0" y="1.4" width="3.8" height="0.05"></rect>
          <text x="0" y="1.3" class="artemisia-title">Artemisia</text>
          <text x="0" y="1.92" class="artemisia-subtitle">a.k.a. Pujo Puyo</text>
          <use href="#plain-logo" x="4.55"></use>
        </g>
        <g fill="#887">
          <rect x="0" y="1.4" width="3.8" height="0.05"></rect>
          <text x="0" y="1.3" class="artemisia-title">Artemisia</text>
          <text x="0" y="1.92" class="artemisia-subtitle">a.k.a. Pujo Puyo</text>
        </g>
        <use href="#logo" x="4.55"></use>
      </g>
    </defs>
  </svg>
</template>

<style>
.all-clear {
  font:
    bold 1px 'Arial',
    sans-serif;
  fill: aliceblue;
  stroke: cornflowerblue;
  stroke-width: 0.035px;
}
.game-over {
  font:
    bold 1.3px 'Arial',
    sans-serif;
  fill: red;
  stroke: yellow;
  stroke-width: 0.035px;
}
.timeout {
  font:
    bold 1.05px 'Arial',
    sans-serif;
  fill: #8fa;
  stroke: #246;
  stroke-width: 0.03px;
}
.waiting {
  font:
    bold 1px 'Arial',
    sans-serif;
  fill: cadetblue;
  stroke: #234;
  stroke-width: 0.035px;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.score-label {
  font:
    bold 0.7px 'Arial',
    sans-serif;
  fill: azure;
}
.score {
  font:
    bold 0.7px 'Lucida Console',
    monospace;
  fill: azure;
}
.danger {
  fill: mistyrose;
  stroke: red;
  stroke-width: 0.02;
}
.chain {
  font:
    bold 0.8px 'Arial',
    sans-serif;
  fill: #fee;
  stroke: rgba(85, 83, 80, 0.7);
  stroke-width: 0.04px;
}
.control {
  fill: #444;
  stroke: #333;
  stroke-width: 0.11;
  cursor: pointer;
}
.control text {
  fill: #221;
  stroke: none;
  font:
    bold 0.5px 'Arial',
    sans-serif;
  text-anchor: middle;
}
.control.active {
  fill: burlywood;
  stroke: sienna;
}
.control.active text {
  fill: #110;
}
.control.disabled {
  cursor: not-allowed;
}
.artemisia-title {
  font:
    1.5px 'Italianno',
    cursive;
}
.artemisia-subtitle {
  font: italic 0.5px serif;
}
.name {
  fill: lightgray;
  font-size: 0.5px;
  font-family: serif;
}
.countdown {
  fill: red;
  stroke: white;
  stroke-width: 0.04;
  font:
    bold 3px 'Arial',
    sans-serif;
  text-anchor: middle;
}
</style>
