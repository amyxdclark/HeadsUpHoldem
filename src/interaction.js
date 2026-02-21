/**
 * interaction.js — Raycast chip picking, physics-based drag via kinematic body
 *                  + spherical joint, stack-assist nudge.
 */
import * as THREE from 'three';
import { world, rapier, createKinematicBody, createSphericalJoint, removeBody, removeJoint } from './physics.js';
import { chips, CHIP } from './chips.js';

const _raycaster = new THREE.Raycaster();
const _pointer   = new THREE.Vector2();

// Drag state
let _grabbed     = null; // { chip, kinBody, joint, offsetY }
let _dragPlaneY  = 0;
let _camera      = null;
let _scene       = null;
let _renderer    = null;
let _assistEnabled = true;

const ASSIST_CHECK_INTERVAL = 0.25; // seconds between assist checks (4× per second)

let _assistTimer = 0;

export function initInteraction(camera, scene, renderer) {
  _camera   = camera;
  _scene    = scene;
  _renderer = renderer;

  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown',  onPointerDown,  { passive: false });
  canvas.addEventListener('pointermove',  onPointerMove,  { passive: false });
  canvas.addEventListener('pointerup',    onPointerUp,    { passive: false });
  canvas.addEventListener('pointercancel',onPointerUp,    { passive: false });
}

export function setAssistEnabled(val) { _assistEnabled = val; }

/** Update pointer coords from event (normalized device coords) */
function setPointer(event) {
  const rect = _renderer.domElement.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  _pointer.x =  ((clientX - rect.left)  / rect.width)  * 2 - 1;
  _pointer.y = -((clientY - rect.top)   / rect.height) * 2 + 1;
}

/** Cast ray from camera through pointer, return intersected chip (if any) */
function pickChip() {
  _raycaster.setFromCamera(_pointer, _camera);
  const meshes = chips.map(c => c.mesh);
  const hits = _raycaster.intersectObjects(meshes, false);
  if (!hits.length) return null;
  const hitMesh = hits[0].object;
  return chips.find(c => c.mesh === hitMesh) || null;
}

/** Intersect the drag plane (horizontal plane at _dragPlaneY) */
function getDragPoint() {
  _raycaster.setFromCamera(_pointer, _camera);
  const planeNormal = new THREE.Vector3(0, 1, 0);
  const planePoint  = new THREE.Vector3(0, _dragPlaneY, 0);
  const denom = planeNormal.dot(_raycaster.ray.direction);
  if (Math.abs(denom) < 1e-6) return null;
  const t = planeNormal.dot(planePoint.sub(_raycaster.ray.origin)) / denom;
  if (t < 0) return null;
  return _raycaster.ray.origin.clone().addScaledVector(_raycaster.ray.direction, t);
}

function onPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  setPointer(event);

  const chip = pickChip();
  if (!chip) return;

  // Wake the body in case it's sleeping
  chip.body.wakeUp();

  // The drag plane sits at the chip's current height + a small lift
  const chipT = chip.body.translation();
  _dragPlaneY = chipT.y + CHIP.height * 0.5 + 0.02;

  // Create kinematic target body at chip position
  const kinBody = createKinematicBody(chipT.x, chipT.y, chipT.z);

  // Spherical joint: anchor at origin of both bodies
  const zero = { x: 0, y: 0, z: 0 };
  const joint = createSphericalJoint(kinBody, chip.body, zero, zero);

  _grabbed = { chip, kinBody, joint };

  // Show tooltip
  const tt = document.getElementById('tooltip');
  if (tt) { tt.classList.add('show'); }

  _renderer.domElement.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  event.preventDefault();
  if (!_grabbed) return;
  setPointer(event);

  const pt = getDragPoint();
  if (!pt) return;

  // Move kinematic body to drag point — chip follows via joint
  _grabbed.kinBody.setNextKinematicTranslation({ x: pt.x, y: _dragPlaneY, z: pt.z });
}

function onPointerUp(event) {
  if (!_grabbed) return;

  // Remove joint first, then kinematic body
  removeJoint(_grabbed.joint);
  removeBody(_grabbed.kinBody);

  _grabbed = null;

  // Hide tooltip after a delay
  const tt = document.getElementById('tooltip');
  if (tt) setTimeout(() => tt.classList.remove('show'), 2000);
}

/**
 * Stack Assist: called every frame.
 * When a chip that just came to rest is near the center of another chip/stack,
 * apply a small horizontal impulse to nudge it into alignment.
 */
export function tickAssist(dt) {
  if (!_assistEnabled) return;
  _assistTimer += dt;
  if (_assistTimer < ASSIST_CHECK_INTERVAL) return;
  _assistTimer = 0;

  for (let i = 0; i < chips.length; i++) {
    const a = chips[i];
    if (!a.body.isSleeping()) continue;          // only sleeping (settled) chips
    const at = a.body.translation();

    for (let j = 0; j < chips.length; j++) {
      if (i === j) continue;
      const b = chips[j];
      const bt = b.body.translation();

      // Check if a is roughly above b (within 2 chip radii XZ, within 2 chip heights Y)
      const dx = at.x - bt.x;
      const dz = at.z - bt.z;
      const dy = at.y - bt.y;
      const horizDist = Math.sqrt(dx * dx + dz * dz);

      if (horizDist < CHIP.radius * 1.2 && horizDist > 0.002 &&
          dy > -CHIP.height * 2 && dy < CHIP.height * 4) {
        // Nudge a toward b's center with a tiny impulse
        const scale = 0.0003;
        a.body.wakeUp();
        a.body.applyImpulse(
          { x: -dx * scale, y: 0, z: -dz * scale },
          true
        );
      }
    }
  }
}
