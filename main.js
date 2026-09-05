import * as THREE from "three";

import ParticleMorph from "./ParticleMorph.js";

const canvas = document.getElementById("webgl-canvas");


// --------------------------------------------------
// Scene
// --------------------------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030305);

// --------------------------------------------------
// Camera
// --------------------------------------------------

const camera = new THREE.PerspectiveCamera(45,  window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 11);


// --------------------------------------------------
// Renderer
// --------------------------------------------------

const renderer =
    new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    });

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

// --------------------------------------------------
// Particle Morph
// --------------------------------------------------

const particleMorph = new ParticleMorph(scene);

// --------------------------------------------------
// Resize
// --------------------------------------------------

window.addEventListener("resize", onWindowResize);

function onWindowResize()
{
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}


// --------------------------------------------------
// Update
// --------------------------------------------------

const clock = new THREE.Clock();


function update()
{
    requestAnimationFrame(update);

    const deltaTime = Math.min(clock.getDelta(), 0.05);
    particleMorph.update(deltaTime);
    renderer.render(scene, camera);
}

update();