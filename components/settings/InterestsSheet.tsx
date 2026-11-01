import React, { useEffect, useState } from 'react';
import { storage } from '../../lib/storage';
import { BottomSheet, Button } from '../ui';
import { InterestPicker } from '../onboarding/InterestPicker';

/** Edit the event types Discover puts first. Saved on this device. */
export function InterestsSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: (n: number) => void }) {
  const [value, setValue] = useState<string[]>([]);

  useEffect(() => {
    if (visible) storage.getInterests().then(setValue);
  }, [visible]);

  const save = async () => {
    await storage.setInterests(value);
    onSaved(value.length);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Your interests"
      subtitle="Discover shows these kinds of events first."
      footer={<Button title="Save" onPress={save} fullWidth />}
    >
      <InterestPicker value={value} onChange={setValue} />
    </BottomSheet>
  );
}
