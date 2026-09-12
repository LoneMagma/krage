import { PerspectiveCamera } from 'three';
import { type Actor, eye } from './core.js';
/** Three's +X rotation turns its -Z forward vector UP, matching simulation pitch. */
export function syncView(camera: PerspectiveCamera, actor: Actor) {
  camera.position.copy(eye(actor));
  camera.rotation.order = 'YXZ';
  camera.rotation.set(actor.pitch, actor.yaw, 0);
}
