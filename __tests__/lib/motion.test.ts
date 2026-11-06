import { project, rubberband, spring, SPRING } from '../../lib/motion';

describe('motion', () => {
  it('turns damping ratio + response into spring physics', () => {
    const s = spring(0.5, 1);
    expect(s.mass).toBe(1);
    expect(s.stiffness).toBeCloseTo((2 * Math.PI / 0.5) ** 2);
    // critically damped: damping = 2·sqrt(k·m)
    expect(s.damping).toBeCloseTo(2 * Math.sqrt(s.stiffness));
    expect(SPRING.momentum.damping).toBeLessThan(2 * Math.sqrt(SPRING.momentum.stiffness));
  });
  it('projects a flick forward like scroll deceleration', () => {
    expect(project(0)).toBe(0);
    expect(project(1000)).toBeCloseTo(499, 0);
    expect(project(-1000, 0.99)).toBeCloseTo(-99, 0);
  });
  it('rubber-bands: follows less the further past the edge, never past the dimension', () => {
    const a = rubberband(50, 300);
    const b = rubberband(200, 300);
    expect(a).toBeLessThan(50);
    expect(b / 200).toBeLessThan(a / 50);
    expect(rubberband(10_000, 300)).toBeLessThan(300);
    expect(rubberband(-50, 300)).toBeCloseTo(-a);
  });
});
