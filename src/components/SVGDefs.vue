<script setup lang="ts">
import { transformPath } from '@/util'
import { VISIBLE_HEIGHT, WIDTH } from 'pujo-puyo-core'

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

const pieceBoxTransform = `translate(${WIDTH + 0.5}, 0)`
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
    </defs>
  </svg>
</template>
