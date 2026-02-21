/**
 * table.js — Build the 3D poker table: felt surface, raised rail, wood trim.
 *            Also creates corresponding Rapier colliders.
 */
import * as THREE from 'three';
import { createStaticBox } from './physics.js';

// Table dimensions (meters, world units)
export const TABLE = {
  halfW: 1.1,   // half-width  (X)
  halfD: 0.65,  // half-depth  (Z)
  feltY: 0.0,   // felt surface Y position
  railH: 0.028, // rail height above felt
  railW: 0.06,  // rail width
  legH:  0.72,  // leg height (below felt)
};

/** Build the complete table group (Three.js objects) and its physics colliders. */
export function buildTable(scene) {
  const group = new THREE.Group();

  // ── Felt surface ──────────────────────────────────────────────────────────
  const feltGeo = new THREE.BoxGeometry(
    (TABLE.halfW - TABLE.railW) * 2,
    0.012,
    (TABLE.halfD - TABLE.railW) * 2
  );
  const feltMat = new THREE.MeshStandardMaterial({
    color: 0x1b6b30,
    roughness: 0.95,
    metalness: 0.0,
  });
  const felt = new THREE.Mesh(feltGeo, feltMat);
  felt.receiveShadow = true;
  felt.position.set(0, TABLE.feltY - 0.006, 0);
  group.add(felt);

  // ── Physics: felt collider plane ──────────────────────────────────────────
  createStaticBox(
    TABLE.halfW - TABLE.railW,
    0.006,
    TABLE.halfD - TABLE.railW,
    0, TABLE.feltY - 0.006, 0,
    1.1, 0.04 // felt friction / restitution
  );

  // ── Rail (4 sides) ────────────────────────────────────────────────────────
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x3b1e0e,
    roughness: 0.85,
    metalness: 0.05,
  });

  // front / back rails (along X)
  const fbrailGeo = new THREE.BoxGeometry(
    TABLE.halfW * 2,
    TABLE.railH,
    TABLE.railW
  );
  [-1, 1].forEach(sign => {
    const rail = new THREE.Mesh(fbrailGeo, railMat);
    rail.castShadow = true;
    rail.receiveShadow = true;
    const zPos = sign * (TABLE.halfD - TABLE.railW * 0.5);
    rail.position.set(0, TABLE.feltY + TABLE.railH * 0.5, zPos);
    group.add(rail);

    createStaticBox(
      TABLE.halfW, TABLE.railH * 0.5, TABLE.railW * 0.5,
      0, TABLE.feltY + TABLE.railH * 0.5, zPos,
      0.8, 0.1
    );
  });

  // left / right rails (along Z)
  const lrrailGeo = new THREE.BoxGeometry(
    TABLE.railW,
    TABLE.railH,
    TABLE.halfD * 2
  );
  [-1, 1].forEach(sign => {
    const rail = new THREE.Mesh(lrrailGeo, railMat);
    rail.castShadow = true;
    rail.receiveShadow = true;
    const xPos = sign * (TABLE.halfW - TABLE.railW * 0.5);
    rail.position.set(xPos, TABLE.feltY + TABLE.railH * 0.5, 0);
    group.add(rail);

    createStaticBox(
      TABLE.railW * 0.5, TABLE.railH * 0.5, TABLE.halfD,
      xPos, TABLE.feltY + TABLE.railH * 0.5, 0,
      0.8, 0.1
    );
  });

  // ── Wood trim (thin strip at top of rail) ─────────────────────────────────
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x6b3e12,
    roughness: 0.6,
    metalness: 0.1,
  });
  const trimThick = 0.007;

  // front/back trims
  const fbTrimGeo = new THREE.BoxGeometry(TABLE.halfW * 2, trimThick, TABLE.railW);
  [-1, 1].forEach(sign => {
    const trim = new THREE.Mesh(fbTrimGeo, trimMat);
    trim.castShadow = true;
    trim.position.set(
      0,
      TABLE.feltY + TABLE.railH + trimThick * 0.5,
      sign * (TABLE.halfD - TABLE.railW * 0.5)
    );
    group.add(trim);
  });

  // left/right trims
  const lrTrimGeo = new THREE.BoxGeometry(TABLE.railW, trimThick, TABLE.halfD * 2);
  [-1, 1].forEach(sign => {
    const trim = new THREE.Mesh(lrTrimGeo, trimMat);
    trim.castShadow = true;
    trim.position.set(
      sign * (TABLE.halfW - TABLE.railW * 0.5),
      TABLE.feltY + TABLE.railH + trimThick * 0.5,
      0
    );
    group.add(trim);
  });

  // ── Table body / apron ────────────────────────────────────────────────────
  const apronMat = new THREE.MeshStandardMaterial({
    color: 0x2a1206,
    roughness: 0.8,
    metalness: 0.08,
  });
  const apronGeo = new THREE.BoxGeometry(
    TABLE.halfW * 2 + TABLE.railW * 2,
    0.04,
    TABLE.halfD * 2 + TABLE.railW * 2
  );
  const apron = new THREE.Mesh(apronGeo, apronMat);
  apron.receiveShadow = true;
  apron.castShadow = true;
  apron.position.set(0, TABLE.feltY - 0.02, 0);
  group.add(apron);

  // ── Legs ──────────────────────────────────────────────────────────────────
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1a0a03, roughness: 0.9, metalness: 0.1 });
  const legGeo = new THREE.CylinderGeometry(0.04, 0.05, TABLE.legH, 8);
  const legPositions = [
    [ TABLE.halfW * 0.8,  0,  TABLE.halfD * 0.8],
    [-TABLE.halfW * 0.8,  0,  TABLE.halfD * 0.8],
    [ TABLE.halfW * 0.8,  0, -TABLE.halfD * 0.8],
    [-TABLE.halfW * 0.8,  0, -TABLE.halfD * 0.8],
  ];
  legPositions.forEach(([lx, _ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.castShadow = true;
    leg.position.set(lx, TABLE.feltY - 0.04 - TABLE.legH * 0.5, lz);
    group.add(leg);
  });

  scene.add(group);
  return group;
}
