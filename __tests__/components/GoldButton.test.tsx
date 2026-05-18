import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GoldButton } from '../../components/GoldButton';

jest.mock('../../lib/constants', () => ({
  COLORS: {
    dark: { gold: '#C9A84C', gold2: '#E8C97A', surface: '#111', muted: '#666', border: 'rgba(255,255,255,0.1)', text: '#fff' },
  },
}));

describe('GoldButton', () => {
  it('renders with title', () => {
    const { getByText } = render(<GoldButton title="Press Me" onPress={() => {}} />);
    expect(getByText('Press Me')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<GoldButton title="Tap" onPress={onPress} />);
    fireEvent.press(getByText('Tap'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(<GoldButton title="Disabled" onPress={onPress} disabled />);
    fireEvent.press(getByText('Disabled'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows loading indicator when loading', () => {
    const { queryByText, toJSON } = render(
      <GoldButton title="Loading" onPress={() => {}} loading />,
    );
    expect(queryByText('Loading')).toBeNull();
    expect(toJSON()).toBeTruthy();
  });

  it('renders outline variant', () => {
    const { toJSON } = render(
      <GoldButton title="Outline" onPress={() => {}} variant="outline" />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
