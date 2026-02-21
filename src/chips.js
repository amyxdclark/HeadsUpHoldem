/**
 * chips.js — Chip factory: procedural canvas textures, Three.js meshes,
 *            Rapier physics bodies, spawn rack.
 */
import * as THREE from 'three';
import { createChipBody } from './physics.js';
import { TABLE } from './table.js';

// Real-ish scale chip: radius ~19mm, height ~3.2mm — scaled ×5 for visibility
export const CHIP = {
  radius: 0.095,  // 19mm × 5
  height: 0.016,  // 3.2mm × 5
  halfH:  0.008,
};

// Chip denominations: value → { color, textColor, label }
export const DENOMINATIONS = [
  { value:   1, color: '#e8e8e8', edgeColor: '#aaaaaa', textColor: '#222', label:  '$1' },
  { value:   5, color: '#cc2222', edgeColor: '#881111', textColor: '#fff', label:  '$5' },
  { value:  25, color: '#2255cc', edgeColor: '#113399', textColor: '#fff', label: '$25' },
  { value: 100, color: '#228833', edgeColor: '#115522', textColor: '#fff', label:'$100' },
  { value: 500, color: '#7722bb', edgeColor: '#441188', textColor: '#fff', label:'$500' },
];

// Cache for chip textures
const _textureCache = new Map();

/** Build a 256×256 canvas texture for a chip face */
function makeChipTexture(denom) {
  if (_textureCache.has(denom.value)) return _textureCache.get(denom.value);

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2, r = size / 2 - 2;

  // Base fill
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = denom.color;
  ctx.fill();

  // Edge stripe segments
  const segments = 8;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 0.45) / segments) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? denom.edgeColor : denom.color;
    ctx.fill();
  }

  // Inner white ring
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Inner colored disc
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = denom.color;
  ctx.fill();

  // Label
  ctx.fillStyle = denom.textColor;
  ctx.font = `bold ${size * 0.18}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(denom.label, cx, cy);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  _textureCache.set(denom.value, tex);
  return tex;
}

/** Build side/edge material for a chip using canvas */
function makeChipSideMaterial(denom) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const segments = 16;
  for (let i = 0; i < segments; i++) {
    ctx.fillStyle = i % 2 === 0 ? denom.edgeColor : denom.color;
    ctx.fillRect((i / segments) * 512, 0, 512 / segments, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.1 });
}

// Shared geometry (all chips same size)
let _chipGeo = null;
function getChipGeo() {
  if (!_chipGeo) {
    _chipGeo = new THREE.CylinderGeometry(
      CHIP.radius, CHIP.radius, CHIP.height, 32, 1
    );
  }
  return _chipGeo;
}

/**
 * All live chips: { mesh, body, value }
 */
export const chips = [];

/**
 * Spawn a single chip at world position (x, y, z).
 * @param {object} scene — THREE.Scene
 * @param {number} value — denomination value
 * @param {number} x, y, z — spawn position
 * @returns chip object { mesh, body, value }
 */
export function spawnChip(scene, value, x, y, z) {
  const denom = DENOMINATIONS.find(d => d.value === value) || DENOMINATIONS[1];

  const faceTex = makeChipTexture(denom);
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex, roughness: 0.7, metalness: 0.05,
  });
  const sideMat = makeChipSideMaterial(denom);

  const geo = getChipGeo();
  const mesh = new THREE.Mesh(geo, [sideMat, faceMat, faceMat]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const body = createChipBody(CHIP.radius, CHIP.halfH, x, y, z);

  const chip = { mesh, body, value };
  chips.push(chip);
  return chip;
}

/**
 * Spawn a "buy-in" rack of chips near the player area.
 * @param {object} scene
 * @param {number} totalValue — dollar amount
 * @param {number[]} denomOrder — denominations to break into, largest first
 */
export function spawnRack(scene, totalValue, denomOrder = [100, 25, 5, 1]) {
  // Break totalValue into chips
  const chipList = [];
  let remaining = totalValue;
  for (const dv of denomOrder) {
    while (remaining >= dv) {
      chipList.push(dv);
      remaining -= dv;
    }
  }

  // Lay them out in rows near the near rail (player side)
  const startX = -Math.min(chipList.length, 10) * (CHIP.radius * 2.4) * 0.5;
  const baseZ  =  TABLE.halfD * 0.55;  // near player
  const baseY  =  TABLE.feltY + CHIP.height * 0.5 + 0.004;
  const cols   = 10;

  chipList.forEach((dv, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx  = startX + col * (CHIP.radius * 2.4);
    const cz  = baseZ  - row * (CHIP.radius * 2.4) * 0.5;
    // Slight random offset so they don't stack perfectly (forces physics settle)
    const jx = (Math.random() - 0.5) * 0.003;
    const jz = (Math.random() - 0.5) * 0.003;
    // Spawn above surface so they fall and settle
    const cy  = baseY + row * (CHIP.height * 1.2) + 0.012;
    spawnChip(scene, dv, cx + jx, cy, cz + jz);
  });
}

/**
 * Sync Three.js meshes from Rapier rigid body transforms.
 * Call every frame after physics step.
 */
export function syncChips() {
  for (const chip of chips) {
    const t = chip.body.translation();
    const r = chip.body.rotation();
    chip.mesh.position.set(t.x, t.y, t.z);
    chip.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }
}

/**
 * Remove all chips from the Three.js scene.
 * IMPORTANT: callers must call removeBody(chip.body) for each chip
 * before calling this function to also clean up the physics world.
 */
export function clearAllChips(scene) {
  for (const chip of chips) {
    scene.remove(chip.mesh);
    // physics removal handled in physics.js removeBody; call from caller
  }
  chips.length = 0;
}
