import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { cancelSignup, signUpForShift } from '../../lib/features';
import { cancelReminders, scheduleReminders } from '../../lib/notifications';
import { haptic } from '../../lib/haptics';
import type { ServeShift } from '../../lib/types';
import { errorMessage } from '../church/churchFormat';

export function isMyShift(shift: ServeShift): boolean {
  return !!shift.my_signup_id && (shift.my_status === 'signed_up' || shift.my_status === 'checked_in');
}

export function spotsLeft(shift: ServeShift): number {
  return Math.max(0, shift.spots - shift.taken);
}

const reminderKey = (shiftId: string) => `serve:${shiftId}`;

/** Sign-up and cancel flows for Serve shifts; `onChange` applies the optimistic patch to the caller's list. */
export function useShiftActions(onChange: (shiftId: string, patch: Partial<ServeShift>) => void) {
  const { session } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const signUp = useCallback(
    async (shift: ServeShift): Promise<boolean> => {
      if (!session) {
        router.push('/auth');
        return false;
      }
      setBusyId(shift.shift_id);
      try {
        const res = await signUpForShift(shift.shift_id);
        onChange(shift.shift_id, {
          my_signup_id: res.id,
          my_code: res.code,
          my_status: 'signed_up',
          taken: shift.taken + 1,
        });
        haptic.success();
        showToast(`You're signed up to serve as ${shift.role_name}`, 'success');
        await scheduleReminders(reminderKey(shift.shift_id), `${shift.role_name} shift`, shift.starts_at, [24, 2], {
          shiftId: shift.shift_id,
        });
        return true;
      } catch (err) {
        haptic.error();
        showToast(errorMessage(err, 'Could not sign you up. Please try again.'), 'error');
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [session, router, onChange, showToast],
  );

  const cancel = useCallback(
    (shift: ServeShift) => {
      const signupId = shift.my_signup_id;
      if (!signupId) return;
      Alert.alert('Cancel this shift?', 'The team will be able to offer your spot to someone else.', [
        { text: 'Keep my spot', style: 'cancel' },
        {
          text: 'Cancel shift',
          style: 'destructive',
          onPress: async () => {
            setBusyId(shift.shift_id);
            try {
              await cancelSignup(signupId);
              await cancelReminders(reminderKey(shift.shift_id));
              onChange(shift.shift_id, {
                my_status: 'cancelled',
                my_code: null,
                taken: Math.max(0, shift.taken - 1),
              });
              haptic.warning();
              showToast('Your shift was cancelled', 'info');
            } catch (err) {
              showToast(errorMessage(err, 'Could not cancel. Please try again.'), 'error');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]);
    },
    [onChange, showToast],
  );

  return { signUp, cancel, busyId };
}
