/**
 * main.js — Scene setup, renderer, camera, lights, animate loop.
 */
import * as THREE from 'three';
import { initPhysics, stepPhysics } from './physics.js';
import { buildTable } from './table.js';
import { syncChips, chips } from './chips.js';
import { initInteraction, tickAssist } from './interaction.js';
import { initUI, updateChipCountDisplay } from './ui.js';

async function main() {
  // ── Renderer ───────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace  = THREE.SRGBColorSpace;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.useLegacyLights   = false;

  const container = document.getElementById('canvas-container');
  container.appendChild(renderer.domElement);

  // ── Scene ──────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);
  scene.fog = new THREE.Fog(0x0d1117, 4, 14);

  // ── Camera — broadcast-style angled down ~40° ──────────────────────────────
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.01, 20);
  // Position above and slightly in front of table, looking down at ~40°
  camera.position.set(0, 1.55, 1.65);
  camera.lookAt(0, 0.05, -0.1);

  // ── Lights ─────────────────────────────────────────────────────────────────
  // Ambient base
  const ambient = new THREE.AmbientLight(0xfff5e0, 0.35);
  scene.add(ambient);

  // Warm key light (top-right)
  const keyLight = new THREE.DirectionalLight(0xffd580, 2.8);
  keyLight.position.set(1.5, 3.5, 1.0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width  = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near   = 0.5;
  keyLight.shadow.camera.far    = 12;
  keyLight.shadow.camera.left   = -2.5;
  keyLight.shadow.camera.right  =  2.5;
  keyLight.shadow.camera.top    =  2;
  keyLight.shadow.camera.bottom = -2;
  keyLight.shadow.bias = -0.0003;
  scene.add(keyLight);

  // Cool fill light (opposite side)
  const fillLight = new THREE.DirectionalLight(0x88aaff, 0.9);
  fillLight.position.set(-2, 2, -1);
  scene.add(fillLight);

  // Soft rim light (from behind)
  const rimLight = new THREE.DirectionalLight(0xffc090, 0.5);
  rimLight.position.set(0, 1.5, -3);
  scene.add(rimLight);

  // Overhead soft point (casino feel)
  const overhead = new THREE.PointLight(0xfff8e8, 1.4, 5.5);
  overhead.position.set(0, 2.5, 0);
  overhead.castShadow = false;
  scene.add(overhead);

  // ── Physics ────────────────────────────────────────────────────────────────
  await initPhysics();

  // ── Table ──────────────────────────────────────────────────────────────────
  buildTable(scene);

  // ── Interaction ────────────────────────────────────────────────────────────
  initInteraction(camera, scene, renderer);

  // ── UI ─────────────────────────────────────────────────────────────────────
  initUI(scene);

  // ── Resize handler ─────────────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── Animate loop ──────────────────────────────────────────────────────────
const MAX_DELTA_MS = 50; // cap to prevent spiral of death

  function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const deltaMs = Math.min(now - prevTime, MAX_DELTA_MS);
    prevTime = now;

    // Fixed-timestep physics
    stepPhysics(deltaMs);

    // Sync Three.js meshes
    syncChips();

    // Stack assist
    tickAssist(deltaMs / 1000);

    // Update chip count every frame (cheap)
    updateChipCountDisplay();

    renderer.render(scene, camera);
  }

  animate();
}

main().catch(err => {
  console.error('Fatal error during init:', err);
  const container = document.getElementById('canvas-container');
  if (container) {
    container.innerHTML = `<div style="color:red;padding:2em;font-family:monospace;">
      <b>Error loading 3D scene:</b><br>${err.message || err}
    </div>`;
  }
});
