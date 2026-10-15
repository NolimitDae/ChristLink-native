import React from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { BottomSheet, ListGroup, ListRow } from '../ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface MenuAction {
  label: string;
  icon: IconName;
  onPress: () => void;
  destructive?: boolean;
}

// iOS cannot present an Alert or another Modal while a sheet is still animating out.
const AFTER_CLOSE_MS = 320;

export function ActionMenu({
  visible,
  onClose,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: MenuAction[];
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title ?? 'Options'}>
      <ListGroup>
        {actions.map((a, i) => (
          <ListRow
            key={a.label}
            icon={a.icon}
            title={a.label}
            destructive={a.destructive}
            last={i === actions.length - 1}
            onPress={() => {
              onClose();
              setTimeout(a.onPress, AFTER_CLOSE_MS);
            }}
          />
        ))}
      </ListGroup>
    </BottomSheet>
  );
}
