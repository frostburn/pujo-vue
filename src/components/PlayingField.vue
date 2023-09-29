<script setup lang="ts">
import { HEIGHT, MultiplayerGame, WIDTH } from 'pujo-puyo-core';
import { onMounted, onUnmounted, ref } from 'vue';

// Frames per millisecond
const GAME_FRAME_RATE = 30 / 1000;

const game = new MultiplayerGame();

let tickId: number | null = null;

let gameAge = 0;
let gameStart: null | DOMHighResTimeStamp = null;

// Game logic goes here and runs independent of animation.
function tick() {
    const timeStamp = window.performance.now();
    if (gameStart === null) {
        gameStart = timeStamp;
    }
    const intendedAge = (timeStamp - gameStart) * GAME_FRAME_RATE;
    while (gameAge < intendedAge) {
        // Make random moves just to demonstrate.
        if (Math.random() < 0.05 && !game.games[0].active) {
            game.play(Math.floor(Math.random() * 2), Math.floor(Math.random() * WIDTH), 2, 0);
        }
        game.tick();
        gameAge++;
    }
    const nextTickTime = gameAge / GAME_FRAME_RATE + gameStart;
    const now = window.performance.now();
    tickId = window.setTimeout(tick, nextTickTime - now);
}

const gameState = ref(game.state);

const lastFrameDrawn = ref<number|null>(null);

const frameId = ref<number|null>(null);

const start = ref<DOMHighResTimeStamp|null>(null);

// Animation goes here.
function draw(timeStamp: DOMHighResTimeStamp) {
    if (start.value === null) {
        start.value = timeStamp;
    }
    if (lastFrameDrawn.value !== gameAge) {
        gameState.value = game.state;
        lastFrameDrawn.value = gameAge;
    }

    frameId.value = window.requestAnimationFrame(draw);
}

onMounted(() => {
    gameAge = 0;
    gameStart = null;
    tickId = window.setTimeout(tick, 1);
    frameId.value = window.requestAnimationFrame(draw);
});

onUnmounted(() => {
    if (tickId !== null) {
        window.clearTimeout(tickId);
    }
    if (frameId.value !== null) {
        window.cancelAnimationFrame(frameId.value);
    }
});

const FILLS = ["#922", "#292", "#882", "#229", "#828", "rgba(30, 255, 255, 0.94)"];

function getFill(colorIndex: number) {
    if (colorIndex < 0) {
        return "none";
    } else if (colorIndex < FILLS.length) {
        return FILLS[colorIndex];
    }
    return "magenta";
}

</script>

<template>
  <svg width="100%" height="100%" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <template v-for="state, playerIndex in gameState" :key="playerIndex">
        <circle 
            v-for="colorIndex, index in state.screen.grid"
            :key="index"
            :cx="1 + 9 * playerIndex + (index % WIDTH)"
            :cy="1 + Math.floor(index / WIDTH)" r="0.4"
            :fill="getFill(colorIndex)">
        </circle>
        <text :x="1 + 9 * playerIndex" :y="2 + HEIGHT">
            <tspan class="score-label">Score: </tspan>
            <tspan class="score">{{ state.score }}</tspan>
        </text>
    </template>
  </svg>
</template>

<style scoped>
.score-label {
    font: bold 0.7px "Arial", sans-serif; fill:azure;
}
.score {
    font: bold 0.7px "Lucida Console", monospace; fill:azure;
}
</style>