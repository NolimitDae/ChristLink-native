import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { AppText, BottomSheet, Button, Field, ListGroup, ListRow } from '../ui';

export interface NewChurchDraft {
  name: string;
  city: string;
  state: string;
  address: string;
  denomination: string;
  /** Pastor or staff: they own the new page. Otherwise it's listed unclaimed so its leaders can claim it. */
  leads: boolean;
}

interface AddChurchSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Prefills the name from what the person searched for. */
  initialName?: string;
  onSubmit: (draft: NewChurchDraft) => Promise<void>;
}

/** Quick "my church isn't listed" form: name and city are enough; everything else can be added later. */
export function AddChurchSheet({ visible, onClose, initialName = '', onSubmit }: AddChurchSheetProps) {
  const t = useTheme();
  const [draft, setDraft] = useState<NewChurchDraft>({ name: '', city: '', state: '', address: '', denomination: '', leads: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setDraft({ name: initialName.trim(), city: '', state: '', address: '', denomination: '', leads: false });
  }, [visible, initialName]);

  const set = (k: keyof NewChurchDraft) => (v: string | boolean) => setDraft(d => ({ ...d, [k]: v }));
  const ready = draft.name.trim().length >= 2 && draft.city.trim().length >= 2;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await onSubmit({ ...draft, name: draft.name.trim(), city: draft.city.trim(), state: draft.state.trim(), address: draft.address.trim(), denomination: draft.denomination.trim() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Add your church"
      subtitle="Can’t find it? Add the basics and it’ll be listed for everyone. Service times and photos can come later."
      footer={<Button title="Add church" icon="add" onPress={submit} loading={busy} disabled={!ready} fullWidth />}
    >
      <View style={{ gap: t.space.sm }}>
        <Field label="Church name" value={draft.name} onChangeText={set('name')} placeholder="e.g. Grace Chapel" maxLength={120} autoCapitalize="words" />
        <View style={{ flexDirection: 'row', gap: t.space.sm }}>
          <Field label="City" value={draft.city} onChangeText={set('city')} placeholder="Atlanta" maxLength={120} autoCapitalize="words" containerStyle={{ flex: 2 }} />
          <Field label="State" value={draft.state} onChangeText={set('state')} placeholder="GA" maxLength={60} autoCapitalize="characters" containerStyle={{ flex: 1 }} />
        </View>
        <Field label="Street address (optional)" value={draft.address} onChangeText={set('address')} placeholder="123 Main St" maxLength={300} />
        <Field label="Denomination (optional)" value={draft.denomination} onChangeText={set('denomination')} placeholder="e.g. Baptist, Non-denominational" maxLength={120} />
        <ListGroup>
          <ListRow
            icon="church-outline"
            title="I’m a pastor or on staff here"
            subtitle={draft.leads ? 'You’ll manage the church page. We verify church leaders before showing a badge.' : 'Leave off if you attend. Your church’s leaders can claim the page later.'}
            toggle={draft.leads}
            onToggle={set('leads')}
            last
          />
        </ListGroup>
        <AppText variant="caption" tone="faint">
          Church pages are public. Please add only real churches; listings are reviewed.
        </AppText>
      </View>
    </BottomSheet>
  );
}
