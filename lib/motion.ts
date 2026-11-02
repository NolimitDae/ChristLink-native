/**
 * Motion vocabulary (Apple's "Designing Fluid Interfaces"): springs are described by a damping ratio
 * (1 = no overshoot) and a response (seconds to reach the target), then converted for Animated.spring.
 * Critically damped is the default; bounce only follows a gesture that carried momentum (a flick, a throw).
 */
export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

/** stiffness = (2π / response)², damping = 4π·ζ / response, with mass 1. */
export function spring(response: number, dampingRatio = 1): SpringConfig {
  const w = (2 * Math.PI) / response;
  return { stiffness: w * w, damping: 2 * dampingRatio * w, mass: 1 };
}

export const SPRING = {
  /** Press feedback settling back after release. */
  press: spring(0.25),
  /** Moving or repositioning a control (tab highlight, segmented thumb). */
  move: spring(0.35),
  /** Sheets settling into place after opening or a drag. */
  sheet: spring(0.32),
  /** A flicked or thrown element: a little overshoot because the gesture had momentum. */
  momentum: spring(0.35, 0.8),
  /** Small celebratory pop (save heart). */
  pop: spring(0.3, 0.55),
} as const;

/**
 * Where a flick would come to rest, like scroll deceleration (Apple's sample code).
 * @param velocity px per second
 * @param decelerationRate 0.998 normal, 0.99 snappier
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past an edge: the further you pull, the less it follows. Never a hard stop. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
