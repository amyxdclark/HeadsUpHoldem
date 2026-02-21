/**
 * physics.js — Rapier3D physics world setup and helpers
 */
import RAPIER from '@dimforge/rapier3d-compat';

export let world = null;
export let rapier = null;

/** Initialize Rapier and create the physics world */
export async function initPhysics() {
  await RAPIER.init();
  rapier = RAPIER;

  const gravity = { x: 0.0, y: -9.81, z: 0.0 };
  world = new RAPIER.World(gravity);

  // Increase solver iterations for stack stability
  world.numSolverIterations = 16;
  world.numAdditionalFrictionIterations = 8;

  return { world, rapier };
}

/**
 * Step the physics world using a fixed-timestep accumulator.
 * @param {number} deltaMs — wall-clock ms since last frame
 * @param {number} fixedDt — fixed timestep in seconds (default 1/60)
 */
const MAX_PHYSICS_STEPS_PER_FRAME = 4;

let _accumulator = 0;
export function stepPhysics(deltaMs, fixedDt = 1 / 60) {
  _accumulator += deltaMs / 1000;
  let stepped = 0;
  while (_accumulator >= fixedDt && stepped < MAX_PHYSICS_STEPS_PER_FRAME) {
    world.step();
    _accumulator -= fixedDt;
    stepped++;
  }
}

/**
 * Create a static rigid body with a cuboid collider (for the table felt plane).
 */
export function createStaticBox(hx, hy, hz, x, y, z, friction = 1.0, restitution = 0.05) {
  const bodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(x, y, z);
  const body = world.createRigidBody(bodyDesc);
  const colliderDesc = rapier.ColliderDesc.cuboid(hx, hy, hz)
    .setFriction(friction)
    .setRestitution(restitution);
  world.createCollider(colliderDesc, body);
  return body;
}

/**
 * Create a static rigid body with a cylinder collider (for the rail ring).
 * Rapier cylinder: halfHeight, radius
 */
export function createStaticCylinder(halfHeight, radius, x, y, z, friction = 0.8, restitution = 0.1) {
  const bodyDesc = rapier.RigidBodyDesc.fixed().setTranslation(x, y, z);
  const body = world.createRigidBody(bodyDesc);
  const colliderDesc = rapier.ColliderDesc.cylinder(halfHeight, radius)
    .setFriction(friction)
    .setRestitution(restitution);
  world.createCollider(colliderDesc, body);
  return body;
}

/**
 * Create a dynamic chip rigid body + cylinder collider.
 * chipRadius, chipHalfH: collider dimensions
 */
export function createChipBody(chipRadius, chipHalfH, x, y, z) {
  const bodyDesc = rapier.RigidBodyDesc.dynamic()
    .setTranslation(x, y, z)
    .setLinearDamping(0.6)
    .setAngularDamping(1.0)
    .setCcdEnabled(true);
  const body = world.createRigidBody(bodyDesc);

  const colliderDesc = rapier.ColliderDesc.cylinder(chipHalfH, chipRadius * 0.98)
    .setFriction(0.9)
    .setRestitution(0.04)
    .setDensity(8.0);
  world.createCollider(colliderDesc, body);
  return body;
}

/**
 * Create a kinematic position-based body used as the grab target.
 */
export function createKinematicBody(x, y, z) {
  const bodyDesc = rapier.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(x, y, z);
  return world.createRigidBody(bodyDesc);
}

/**
 * Create a spherical (ball-socket) joint between two bodies.
 * anchor1 / anchor2 are local-space Vec3 on each body.
 */
export function createSphericalJoint(body1, body2, anchor1, anchor2) {
  const params = rapier.JointData.spherical(anchor1, anchor2);
  return world.createImpulseJoint(params, body1, body2, true);
}

/** Remove a rigid body and all its associated colliders from the world */
export function removeBody(body) {
  if (body && world.bodies.contains(body.handle)) {
    world.removeRigidBody(body);
  }
}

/** Remove a joint */
export function removeJoint(joint) {
  if (joint && world.impulseJoints.contains(joint.handle)) {
    world.removeImpulseJoint(joint, true);
  }
}
