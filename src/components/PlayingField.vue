<script setup lang="ts">
import { HEIGHT, MultiplayerGame, WIDTH } from 'pujo-puyo-core';
import { computed, onMounted, onUnmounted, ref } from 'vue';

// Frames per millisecond
const GAME_FRAME_RATE = 30 / 1000;
const MS_PER_FRAME = 1 / GAME_FRAME_RATE;

const game = new MultiplayerGame();

let tickId: number | null = null;

let gameAge = 0;
let gameStart: null | DOMHighResTimeStamp = null;
let lastTickTime: number | null = null;

// Game logic goes here and runs independent of animation.
function tick() {
    const timeStamp = window.performance.now();
    if (gameStart === null) {
        gameStart = timeStamp;
    }
    const intendedAge = (timeStamp - gameStart) * GAME_FRAME_RATE;
    while (gameAge < intendedAge) {
        // Make random moves just to demonstrate.
        const player = Math.floor(Math.random() * 2);
        if (Math.random() < 0.1 && !game.games[player].active) {
            game.play(player, Math.floor(Math.random() * WIDTH), 2, 0);
        }
        game.tick();
        gameAge++;
    }
    const nextTickTime = gameAge * MS_PER_FRAME + gameStart;
    lastTickTime = window.performance.now();
    tickId = window.setTimeout(tick, nextTickTime - lastTickTime);
}

const gameState = ref(game.state);

const fallMu = ref(0);

let lastFrameDrawn: number|null = null;

let frameId: number|null = null;

let start: DOMHighResTimeStamp|null = null;

// Animation goes here.
function draw(timeStamp: DOMHighResTimeStamp) {
    if (start === null) {
        start = timeStamp;
    }
    const drawTime = window.performance.now();
    if (lastTickTime === null) {
        fallMu.value = 0;
    } else {
        fallMu.value = Math.max(0, Math.min(1, (drawTime - lastTickTime) * GAME_FRAME_RATE));
    }

    if (lastFrameDrawn !== gameAge) {
        lastFrameDrawn = gameAge;

        gameState.value = game.state;
    }

    frameId = window.requestAnimationFrame(draw);
}

onMounted(() => {
    gameAge = 0;
    gameStart = null;
    tickId = window.setTimeout(tick, 1);
    frameId = window.requestAnimationFrame(draw);
});

onUnmounted(() => {
    if (tickId !== null) {
        window.clearTimeout(tickId);
    }
    if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
    }
});

const STROKES = ["#d22", "#2d2", "#dd2", "#22e", "#d2c", "rgba(20, 160, 160, 0.88)"];
const FILLS = ["#922", "#292", "#882", "#229", "#828", "rgba(30, 255, 255, 0.94)"];

function getStroke(colorIndex: number) {
    if (colorIndex < 0) {
        return "none";
    } else if (colorIndex < STROKES.length) {
        return STROKES[colorIndex];
    }
    return "white";
}

function getFill(colorIndex: number) {
    if (colorIndex < 0) {
        return "none";
    } else if (colorIndex < FILLS.length) {
        return FILLS[colorIndex];
    }
    return "magenta";
}

const puyoPropss = computed(() => {
    const result = [];
    for (const playerState of gameState.value) {
        const playerPuyos = [];
        let index = 0;
        for (const colorIndex of playerState.screen.grid) {
            let y = Math.floor(index / WIDTH);
            let fill = getFill(colorIndex);
            let stroke = getStroke(colorIndex);
            if (playerState.screen.falling[index]) {
                y += fallMu.value;
            }
            if (playerState.screen.ignited[index]) {
                fill = "white";
            }
            playerPuyos.push({
                index,
                x: index % WIDTH,
                y,
                fill,
                stroke,
            });
            index++;
        }
        result.push(playerPuyos);
    }
    return result;
});

</script>

<template>
  <svg width="100%" height="100%" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <template v-for="puyoProps, playerIndex in puyoPropss" :key="playerIndex">
        <circle 
            v-for="p in puyoProps"
            r="0.4"
            stroke-width="0.1"
            :key="p.index"
            :cx="1 + 9 * playerIndex + p.x"
            :cy="1 + p.y"
            :fill="p.fill"
            :stroke="p.stroke"
        >
        </circle>
        <text :x="1 + 9 * playerIndex" :y="2 + HEIGHT">
            <tspan class="score-label">Score: </tspan>
            <tspan class="score">{{ gameState[playerIndex].score }}</tspan>
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