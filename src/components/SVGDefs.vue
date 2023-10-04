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
          fill="rgba(0, 0, 0, 0.1)"
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
          <textPath href="#over-path" textLength="17%">Over</textPath>
        </text>
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
  stroke-linejoin: round;
  stroke-linecap: round;
}
.game-over {
  font:
    bold 1.3px 'Arial',
    sans-serif;
  fill: red;
  stroke: yellow;
  stroke-width: 0.035px;
  stroke-linejoin: round;
  stroke-linecap: round;
}
</style>
