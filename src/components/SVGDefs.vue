<script setup lang="ts">
import { VISIBLE_HEIGHT, WIDTH } from "pujo-puyo-core";

const pieceBoxTransform = `translate(${WIDTH + 0.5}, 0)`;

</script>

<template>
    <svg width="0" height="0" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <g id="screen-outline">
                <!--Main screen-->
                <rect x="-0.1" y="-0.1" rx="0.1" :width="WIDTH + 0.2" :height="VISIBLE_HEIGHT + 0.2"></rect>
                <!--Piece box-->
                <path d="
                    M -0.1 0
                    A 0.1 0.1 0 0 1 0 -0.1
                    H 1
                    A 0.1 0.1 0 0 1 1.1 0  
                    V 2  
                    A 0.1 0.1 0 0 0 1.2 2.1  
                    H 1.5  
                    A 0.1 0.1 0 0 1 1.6 2.2  
                    V 4.2  
                    A 0.1 0.1 0 0 1 1.5 4.3  
                    H 0.5  
                    A 0.1 0.1 0 0 1 0.4 4.2  
                    V 2.2  
                    A 0.1 0.1 0 0 0 0.3 2.1  
                    H 0  
                    A 0.1 0.1 0 0 1 -0.1 2  
                    Z
                    "
                    :transform=pieceBoxTransform
                ></path>
            </g>
            <g id="screen">
                <!--Dark background-->
                <use href="#screen-outline" fill="rgba(0, 0, 0, 0.1)" stroke="#101" stroke-width="0.16"></use>
                <!--Light dashes-->
                <use href="#screen-outline" fill="none" stroke="#112" stroke-width="0.06" stroke-dasharray="0.14 0.1 0.2 0.1"></use>
            </g>
        </defs>
    </svg>
</template>
