<script setup lang="ts">
import { SimplePuyoScreen, splitIntoTokens, utterAlgebraic, type GameState, applyAlgebraic, algebraicToGameStates } from 'pujo-puyo-core';
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import SVGDefs from './SVGDefs.vue'
import PlayingScreen from './PlayingScreen.vue'

const GAME_TYPE: 'pausing' | 'realtime' = 'pausing'
const LEFT_SCREEN_X = 1.2
const RIGHT_SCREEN_X = 11
const SCREEN_Y = 1

const wins = reactive([0, 0])

function simpleToGameState(screen: SimplePuyoScreen) {
  return {
    screen: screen.state,
    age: 0,
    score: 0,
    hand: [],
    preview: [],
    pendingGarbage: 0,
    lateGarbage: 0,
    allClearBonus: false,
    busy: false,
    lockedOut: false,
  }
}

const dummy = new SimplePuyoScreen();
const gameStates = reactive<GameState[]>([simpleToGameState(dummy), simpleToGameState(dummy)]);

const currentToken = ref("");


onMounted(() => {
  const apn = 'Y1Y2 YfYe G6B6 GaBa R1R2 RdRc G5B5 GbBb R1B1 BcRc B1R1 RbBa*,G3Y3 G3Y2 R4G4,Y5B4 (2xr) YdGc N12456 GdYe*,Y2Y2 Y2Y1,G3G3 B4R5 (2x!r) RcGc N12356 BdYd YeYe R3B2 YcYc R3G4 GbGb G1B2 RcBc B4B4 RbBc G5B5 RbGb R4R4 GaBb* R6B6,G6G6 R6G6,Y3R4 G4R4 G4R4,B5Y5*.,(4xr) BcBc.GeBd ReRd.RdBd GdGc GfRf*.,.,.,(3x!r) ReYe.GcRd RcGc.YeBf RdBe* (8xl) R4B4,B4B4 Y5B5 4Lr (1xr) Y4B5 Lr G6R6 BaBa R3R3*.5Lr BdYe Nb Nbdf Lr (1xl) Y4G4* #r 1-0.(1xl) (RY GY GG l) (YB RG RR r)';
  const tokens = splitIntoTokens(apn);

  const states = algebraicToGameStates(tokens);
  
  function utterMore() {
    if (!tokens.length) {
      return;
    }
    const token = tokens.shift()!;
    currentToken.value = token;
    const utterance = new SpeechSynthesisUtterance(utterAlgebraic(token));
    utterance.addEventListener("end", utterMore);
    speechSynthesis.speak(utterance);

    gameStates[0] = states[0][0];
    gameStates[1] = states[0][1];

    states.shift();

    if (token === '1-0') {
      wins[0]++;
    } if (token === '0-1') {
      wins[1]++;
    }
  }
  utterMore();
});

onUnmounted(() => {
  speechSynthesis.cancel()
})

</script>

<template>
  <svg ref="svg" width="100%" height="100%" viewBox="0 0 20 15" xmlns="http://www.w3.org/2000/svg">
    <SVGDefs />
    <g :transform="`translate(${LEFT_SCREEN_X}, ${SCREEN_Y})`">
      <PlayingScreen
        :gameState="gameStates ? gameStates[0] : null"
        :gameType="GAME_TYPE"
        :fallMu="0"
        :preIgnitions="null"
        :chainCards="[]"
        :wins="wins[0]"
      />
    </g>
    <g :transform="`translate(${RIGHT_SCREEN_X}, ${SCREEN_Y})`">
      <PlayingScreen
        :gameState="gameStates ? gameStates[1] : null"
        :gameType="GAME_TYPE"
        :fallMu="0"
        :preIgnitions="null"
        :chainCards="[]"
        :wins="wins[1]"
      />
    </g>
  </svg>
  <p>{{ currentToken }}</p>
</template>

<style>
p {
  margin-left: 60px;
  font-size: x-large;
}
</style>