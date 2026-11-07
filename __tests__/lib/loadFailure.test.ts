import { ApiError } from '../../lib/api';
import { FeatureError } from '../../lib/features';
import { loadFailure } from '../../lib/loadFailure';

describe('loadFailure (what a failed screen should say)', () => {
  it('only blames the connection when no answer came back', () => {
    expect(loadFailure(new ApiError('Network error. Please check your connection.', 0, true))).toBe('offline');
    expect(loadFailure(new FeatureError('Request timed out', false, 0))).toBe('offline');
  });
  it('asks signed-out visitors to sign in', () => {
    expect(loadFailure(new ApiError('Unauthorized', 401, false))).toBe('signin');
    expect(loadFailure(new FeatureError('Please sign in first.', false, 401))).toBe('signin');
  });
  it('calls anything else a server problem', () => {
    expect(loadFailure(new ApiError('Internal error', 500, true))).toBe('server');
    expect(loadFailure(new FeatureError('Bad request', false, 400))).toBe('server');
    expect(loadFailure(new Error('boom'))).toBe('server');
  });
});
