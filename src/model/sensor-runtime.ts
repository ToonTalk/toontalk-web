/**
 * Drive every sensor in the world from one input snapshot. Call once per frame
 * (and on the house tick as a fallback). Notifies the view only when a sensor's
 * displayed value actually changed, so static sensors are cheap.
 */
import type { World } from './world';
import type { InputState } from '../input/input-state';
import { isSensor } from './sensor';

export function updateSensors(world: World, input: InputState): void {
  for (const t of world.all()) {
    if (isSensor(t) && t.update(input)) world.notifyChanged(t);
  }
}
