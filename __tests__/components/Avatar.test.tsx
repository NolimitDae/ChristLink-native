import React from 'react';
import { render } from '@testing-library/react-native';
import { Avatar } from '../../components/Avatar';

describe('Avatar', () => {
  it('shows initials when there is no photo', () => {
    const { getByText } = render(<Avatar name="Alice Smith" />);
    expect(getByText('AS')).toBeTruthy();
  });

  it('shows a single initial for one name and ? when missing', () => {
    expect(render(<Avatar name="Bob" />).getByText('B')).toBeTruthy();
    expect(render(<Avatar />).getByText('?')).toBeTruthy();
  });

  it('renders the web app gradient colors without crashing', () => {
    const { getByLabelText } = render(<Avatar name="Dee" color="linear-gradient(135deg,#059669,#064E3B)" />);
    expect(getByLabelText("Dee's photo")).toBeTruthy();
  });

  it('adds a ring when requested', () => {
    const { toJSON } = render(<Avatar name="Ring" ringColor="#C9A84C" size={60} />);
    expect(JSON.stringify(toJSON())).toContain('#C9A84C');
  });
});
