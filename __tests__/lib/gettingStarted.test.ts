import { SETUP_GROUPS, SETUP_STEP_COPY, setupPending, setupProgress, setupSummary } from '../../lib/gettingStarted';
import type { GettingStarted, SetupStepId } from '../../lib/types';

const ALL: SetupStepId[] = ['photo', 'cover', 'bio', 'interests', 'church', 'post', 'event'];
const status = (done: number, extra: Partial<GettingStarted> = {}): GettingStarted => ({
  steps: ALL.map((id, i) => ({ id, done: i < done })),
  done,
  total: 7,
  welcome: false,
  show: true,
  celebrate: false,
  completed_at: null,
  ...extra,
});

describe('getting started checklist', () => {
  it('has copy for every step the server sends, each shown once', () => {
    expect(Object.keys(SETUP_STEP_COPY).sort()).toEqual([...ALL].sort());
    expect(SETUP_GROUPS.flatMap(g => g.steps).sort()).toEqual([...ALL].sort());
  });

  it('progress is a 0–1 fraction', () => {
    expect(setupProgress(null)).toBe(0);
    expect(setupProgress(status(0))).toBe(0);
    expect(setupProgress(status(3))).toBeCloseTo(3 / 7);
    expect(setupProgress({ done: 9, total: 7 })).toBe(1);
    expect(setupProgress({ done: 0, total: 0 })).toBe(0);
  });

  it('summarises what is left', () => {
    expect(setupSummary(status(0))).toBe('7 quick steps to make this place yours.');
    expect(setupSummary(status(5))).toBe('2 steps left.');
    expect(setupSummary(status(6))).toBe('One step left.');
    expect(setupSummary(status(7))).toBe('All done. Thank you!');
  });

  it('the bell shows a dot only while steps are waiting', () => {
    expect(setupPending(null)).toBe(false);
    expect(setupPending(status(2))).toBe(true);
    expect(setupPending(status(2, { show: false }))).toBe(false);
    expect(setupPending(status(7))).toBe(false);
  });
});
