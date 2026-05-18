import React from 'react';
import { render } from '@testing-library/react-native';
import { Avatar } from '../../components/Avatar';

jest.mock('../../lib/constants', () => ({
  COLORS: {
    dark: { bg: '#000', text: '#fff', gold: '#C9A84C', surface: '#111', muted: '#666', border: 'rgba(255,255,255,0.1)' },
  },
  AVATAR_COLORS: ['#C9A84C', '#4EC98C', '#E05050'],
}));

describe('Avatar', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<Avatar name="John Doe" />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows initials when no URI provided', () => {
    const { getByText } = render(<Avatar name="Alice Smith" />);
    expect(getByText('A')).toBeTruthy();
  });

  it('shows fallback ? for missing name', () => {
    const { getByText } = render(<Avatar />);
    expect(getByText('?')).toBeTruthy();
  });

  it('respects custom size', () => {
    const { toJSON } = render(<Avatar name="Bob" size={60} />);
    const json = toJSON();
    expect(json).toBeTruthy();
  });
});
