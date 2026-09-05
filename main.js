import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
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

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure =  1.0;

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass =
    new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.55,   // strength
        0.45,   // radius
        0.72    // threshold
    );

composer.addPass(bloomPass);

// --------------------------------------------------
// Controls
// --------------------------------------------------

const controls = new OrbitControls(camera, renderer.domElement);

controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

controls.minDistance = 4;
controls.maxDistance = 25;

controls.update();

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

    composer.setSize(window.innerWidth, window.innerHeight);
}

// --------------------------------------------------
// Debug Panel
// --------------------------------------------------

const debugPanel = document.getElementById("debug-panel");

let frameCounter = 0;
let fpsTimer = 0;
let displayedFps = 0;


function updateDebugPanel(deltaTime)
{
    frameCounter++;
    fpsTimer += deltaTime;

    if (fpsTimer >= 0.25)
    {
        displayedFps = Math.round(frameCounter / fpsTimer);
        frameCounter = 0;
        fpsTimer = 0;
    }

    debugPanel.innerHTML = `
        Particles: ${particleMorph.particleCount.toLocaleString()}<br>
        FPS: ${displayedFps}<br>
        Shape: ${particleMorph.currentShapeName}<br>
        Phase: ${particleMorph.phaseName}<br>
        Transition: ${particleMorph.transition.toFixed(3)}<br>
        Draw Calls: ${renderer.info.render.calls}
    `;
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

    composer.render();
    //renderer.render(scene, camera);

    updateDebugPanel(deltaTime)
}

update();