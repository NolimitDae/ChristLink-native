import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { GoldButton } from '../../components/GoldButton';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { createEvent, uploadEventImage, createTicketType, publishEvent } from '../../lib/api';
import { COLORS, EVENT_TYPES, EVENT_FORMATS, AGE_GROUPS } from '../../lib/constants';
import type { CreateEventPayload } from '../../lib/types';

const C = COLORS.dark;

type Step = 1 | 2 | 3 | 4;

interface TicketDraft {
  name: string;
  price: string;
  quantity: string;
}

const EVENT_TYPE_OPTIONS = EVENT_TYPES.slice(1); // Remove 'All'

export default function HostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState(EVENT_TYPE_OPTIONS[0]);
  const [isPaid, setIsPaid] = useState(false);
  const [format, setFormat] = useState<'in_person' | 'online' | 'hybrid'>('in_person');
  const [ageGroup, setAgeGroup] = useState('All Ages');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [onlineUrl, setOnlineUrl] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [forumEnabled, setForumEnabled] = useState(false);
  const [tickets, setTickets] = useState<TicketDraft[]>([
    { name: 'General Admission', price: '', quantity: '' },
  ]);

  const isAuthenticated = !!session;

  const handlePickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCoverUri(asset.uri);
      if (asset.base64 && session?.access_token) {
        setCoverUploading(true);
        try {
          const ext = asset.uri.split('.').pop() ?? 'jpg';
          const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
          const dataUrl = `data:${mimeType};base64,${asset.base64}`;
          const { url } = await uploadEventImage(dataUrl, 'cover', session.access_token);
          setCoverUri(url);
          showToast('Cover image uploaded', 'success');
        } catch (err) {
          showToast('Failed to upload image', 'error');
        } finally {
          setCoverUploading(false);
        }
      }
    }
  };

  const addTicket = () => {
    setTickets(prev => [...prev, { name: '', price: '', quantity: '' }]);
  };

  const removeTicket = (index: number) => {
    setTickets(prev => prev.filter((_, i) => i !== index));
  };

  const updateTicket = (index: number, field: keyof TicketDraft, value: string) => {
    setTickets(prev => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };

  const handleCreateEvent = async () => {
    if (!session?.access_token) {
      showToast('Please sign in to create an event', 'error');
      return;
    }
    if (!name.trim()) {
      showToast('Event name is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateEventPayload = {
        name: name.trim(),
        description: description.trim() || undefined,
        event_type: eventType,
        age_group: ageGroup,
        format,
        is_paid: isPaid,
        absorb_stripe_fee: true,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        venue_name: venueName.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zip: zip.trim() || undefined,
        online_url: onlineUrl.trim() || undefined,
        max_capacity: maxCapacity ? parseInt(maxCapacity, 10) : undefined,
        forum_enabled: forumEnabled,
        cover_url: coverUri && coverUri.startsWith('http') ? coverUri : undefined,
      };

      const event = await createEvent(payload, session.access_token);
      setCreatedEventId(event.id);

      // Create ticket types for paid events
      if (isPaid && tickets.length > 0) {
        const validTickets = tickets.filter(t => t.name && t.price);
        for (const ticket of validTickets) {
          await createTicketType(
            {
              event_id: event.id,
              name: ticket.name,
              price_cents: Math.round(parseFloat(ticket.price) * 100),
              quantity: ticket.quantity ? parseInt(ticket.quantity, 10) : undefined,
            },
            session.access_token,
          );
        }
      }

      showToast('Event created as draft!', 'success');
      setStep(4);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create event';
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!session?.access_token || !createdEventId) return;
    setSubmitting(true);
    try {
      await publishEvent(createdEventId, session.access_token);
      showToast('Event published!', 'success');
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to publish';
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    showToast('Event saved as draft', 'info');
    router.replace('/(tabs)/profile');
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="calendar-outline" size={64} color={C.muted} />
        <Text style={styles.guestTitle}>Host an Event</Text>
        <Text style={styles.guestSubtext}>Sign in to create and manage faith events</Text>
        <GoldButton title="Sign In" onPress={() => router.push('/auth')} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Host an Event</Text>
          <View style={styles.stepIndicator}>
            {([1, 2, 3, 4] as Step[]).map(s => (
              <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]} />
            ))}
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Basic Information</Text>
              <Text style={styles.stepSubtitle}>Tell us about your event</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Event Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }}>
                  <View style={styles.typeRow}>
                    {EVENT_TYPE_OPTIONS.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.typeChip, eventType === t && styles.typeChipActive]}
                        onPress={() => setEventType(t)}
                      >
                        <Text style={[styles.typeChipText, eventType === t && styles.typeChipTextActive]}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Event Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Sunday Morning Worship"
                  placeholderTextColor={C.muted}
                  maxLength={120}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe your event..."
                  placeholderTextColor={C.muted}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  maxLength={2000}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Age Group</Text>
                <View style={styles.chipRow}>
                  {AGE_GROUPS.map(ag => (
                    <TouchableOpacity
                      key={ag}
                      style={[styles.chip, ageGroup === ag && styles.chipActive]}
                      onPress={() => setAgeGroup(ag)}
                    >
                      <Text style={[styles.chipText, ageGroup === ag && styles.chipTextActive]}>
                        {ag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <View style={styles.switchRow}>
                  <View>
                    <Text style={styles.label}>Paid Event</Text>
                    <Text style={styles.labelHint}>Charge tickets for attendance</Text>
                  </View>
                  <Switch
                    value={isPaid}
                    onValueChange={setIsPaid}
                    trackColor={{ false: C.surface2, true: C.gold }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <GoldButton
                title="Next: Date & Location"
                onPress={() => {
                  if (!name.trim()) {
                    showToast('Please enter an event name', 'error');
                    return;
                  }
                  setStep(2);
                }}
              />
            </View>
          )}

          {/* Step 2: Date & Location */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Date & Location</Text>
              <Text style={styles.stepSubtitle}>When and where is your event?</Text>

              <View style={styles.field}>
                <Text style={styles.label}>Format</Text>
                <View style={styles.chipRow}>
                  {EVENT_FORMATS.map(f => (
                    <TouchableOpacity
                      key={f}
                      style={[styles.chip, format === f && styles.chipActive]}
                      onPress={() => setFormat(f)}
                    >
                      <Text style={[styles.chipText, format === f && styles.chipTextActive]}>
                        {f === 'in_person' ? 'In Person' : f.charAt(0).toUpperCase() + f.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Start Date & Time</Text>
                <TextInput
                  style={styles.input}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="e.g. 2025-06-15T10:00:00"
                  placeholderTextColor={C.muted}
                />
                <Text style={styles.fieldHint}>Format: YYYY-MM-DDTHH:MM:SS</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>End Date & Time</Text>
                <TextInput
                  style={styles.input}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="e.g. 2025-06-15T13:00:00"
                  placeholderTextColor={C.muted}
                />
              </View>

              {(format === 'in_person' || format === 'hybrid') && (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Venue Name</Text>
                    <TextInput
                      style={styles.input}
                      value={venueName}
                      onChangeText={setVenueName}
                      placeholder="e.g. Grace Community Church"
                      placeholderTextColor={C.muted}
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Street Address</Text>
                    <TextInput
                      style={styles.input}
                      value={address}
                      onChangeText={setAddress}
                      placeholder="123 Main St"
                      placeholderTextColor={C.muted}
                    />
                  </View>
                  <View style={styles.row2}>
                    <View style={[styles.field, { flex: 2 }]}>
                      <Text style={styles.label}>City</Text>
                      <TextInput
                        style={styles.input}
                        value={city}
                        onChangeText={setCity}
                        placeholder="City"
                        placeholderTextColor={C.muted}
                      />
                    </View>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.label}>State</Text>
                      <TextInput
                        style={styles.input}
                        value={state}
                        onChangeText={setState}
                        placeholder="ST"
                        placeholderTextColor={C.muted}
                        maxLength={2}
                        autoCapitalize="characters"
                      />
                    </View>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.label}>ZIP</Text>
                      <TextInput
                        style={styles.input}
                        value={zip}
                        onChangeText={setZip}
                        placeholder="12345"
                        placeholderTextColor={C.muted}
                        keyboardType="numeric"
                        maxLength={10}
                      />
                    </View>
                  </View>
                </>
              )}

              {(format === 'online' || format === 'hybrid') && (
                <View style={styles.field}>
                  <Text style={styles.label}>Online URL</Text>
                  <TextInput
                    style={styles.input}
                    value={onlineUrl}
                    onChangeText={setOnlineUrl}
                    placeholder="https://zoom.us/..."
                    placeholderTextColor={C.muted}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Max Capacity (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={maxCapacity}
                  onChangeText={setMaxCapacity}
                  placeholder="Leave blank for unlimited"
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.field}>
                <View style={styles.switchRow}>
                  <View>
                    <Text style={styles.label}>Event Forum</Text>
                    <Text style={styles.labelHint}>Allow attendees to chat</Text>
                  </View>
                  <Switch
                    value={forumEnabled}
                    onValueChange={setForumEnabled}
                    trackColor={{ false: C.surface2, true: C.gold }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <View style={styles.buttonRow}>
                <GoldButton
                  title="Back"
                  variant="outline"
                  onPress={() => setStep(1)}
                  style={{ flex: 1 }}
                />
                <GoldButton
                  title="Next: Cover Photo"
                  onPress={() => setStep(3)}
                  style={{ flex: 2 }}
                />
              </View>
            </View>
          )}

          {/* Step 3: Cover Photo */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Cover Photo</Text>
              <Text style={styles.stepSubtitle}>Add an eye-catching photo for your event</Text>

              <TouchableOpacity
                style={styles.coverPicker}
                onPress={handlePickCover}
                disabled={coverUploading}
              >
                {coverUri ? (
                  <Image source={{ uri: coverUri }} style={styles.coverPreview} resizeMode="cover" />
                ) : (
                  <View style={styles.coverPlaceholder}>
                    <Ionicons name="image-outline" size={48} color={C.muted} />
                    <Text style={styles.coverPlaceholderText}>Tap to add a cover photo</Text>
                    <Text style={styles.coverPlaceholderHint}>Recommended: 1600×900px</Text>
                  </View>
                )}
                {coverUploading && (
                  <View style={styles.coverUploading}>
                    <Text style={styles.coverUploadingText}>Uploading...</Text>
                  </View>
                )}
              </TouchableOpacity>

              {coverUri && (
                <TouchableOpacity
                  style={styles.removeCover}
                  onPress={() => setCoverUri(null)}
                >
                  <Ionicons name="trash-outline" size={16} color={C.red} />
                  <Text style={styles.removeCoverText}>Remove photo</Text>
                </TouchableOpacity>
              )}

              <View style={[styles.buttonRow, { marginTop: 24 }]}>
                <GoldButton
                  title="Back"
                  variant="outline"
                  onPress={() => setStep(2)}
                  style={{ flex: 1 }}
                />
                <GoldButton
                  title={isPaid ? 'Next: Tickets' : 'Create Event'}
                  onPress={isPaid ? () => setStep(4) : handleCreateEvent}
                  loading={submitting && !isPaid}
                  style={{ flex: 2 }}
                />
              </View>
            </View>
          )}

          {/* Step 4: Tickets (paid) or Confirmation */}
          {step === 4 && !createdEventId && isPaid && (
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Ticket Types</Text>
              <Text style={styles.stepSubtitle}>Set up your ticket options</Text>

              {tickets.map((ticket, index) => (
                <View key={index} style={styles.ticketRow}>
                  <View style={styles.ticketHeader}>
                    <Text style={styles.ticketLabel}>Ticket {index + 1}</Text>
                    {tickets.length > 1 && (
                      <TouchableOpacity onPress={() => removeTicket(index)}>
                        <Ionicons name="trash-outline" size={18} color={C.red} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                      style={styles.input}
                      value={ticket.name}
                      onChangeText={v => updateTicket(index, 'name', v)}
                      placeholder="e.g. General Admission"
                      placeholderTextColor={C.muted}
                    />
                  </View>
                  <View style={styles.row2}>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.label}>Price ($)</Text>
                      <TextInput
                        style={styles.input}
                        value={ticket.price}
                        onChangeText={v => updateTicket(index, 'price', v)}
                        placeholder="0.00"
                        placeholderTextColor={C.muted}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={styles.label}>Qty (optional)</Text>
                      <TextInput
                        style={styles.input}
                        value={ticket.quantity}
                        onChangeText={v => updateTicket(index, 'quantity', v)}
                        placeholder="Unlimited"
                        placeholderTextColor={C.muted}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.addTicketBtn} onPress={addTicket}>
                <Ionicons name="add-circle-outline" size={20} color={C.gold} />
                <Text style={styles.addTicketText}>Add another ticket type</Text>
              </TouchableOpacity>

              <View style={[styles.buttonRow, { marginTop: 24 }]}>
                <GoldButton
                  title="Back"
                  variant="outline"
                  onPress={() => setStep(3)}
                  style={{ flex: 1 }}
                />
                <GoldButton
                  title="Create Event"
                  onPress={handleCreateEvent}
                  loading={submitting}
                  style={{ flex: 2 }}
                />
              </View>
            </View>
          )}

          {/* Step 4: Success / Publish */}
          {step === 4 && createdEventId && (
            <View style={[styles.stepContent, styles.centered]}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark-circle" size={80} color={C.gold} />
              </View>
              <Text style={styles.successTitle}>Event Created!</Text>
              <Text style={styles.successSubtext}>
                Your event has been saved as a draft. Publish it to make it visible to the community.
              </Text>

              <GoldButton
                title="Publish Now"
                onPress={handlePublish}
                loading={submitting}
                style={styles.publishBtn}
              />
              <GoldButton
                title="Save as Draft"
                variant="outline"
                onPress={handleSaveDraft}
                style={styles.draftBtn}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
  },
  stepDotActive: {
    backgroundColor: C.gold,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  stepContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  stepTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  stepSubtitle: {
    color: C.muted,
    fontSize: 14,
    marginBottom: 24,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  labelHint: {
    color: C.muted,
    fontSize: 12,
    marginTop: 2,
  },
  fieldHint: {
    color: C.muted,
    fontSize: 11,
    marginTop: 4,
  },
  input: {
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  typeRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  typeChipActive: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderColor: C.gold,
  },
  typeChipText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  typeChipTextActive: {
    color: C.gold,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderColor: C.gold,
  },
  chipText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: C.gold,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  row2: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  coverPicker: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  coverPreview: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  coverPlaceholderText: {
    color: C.muted,
    fontSize: 15,
    fontWeight: '600',
  },
  coverPlaceholderHint: {
    color: C.muted,
    fontSize: 12,
  },
  coverUploading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverUploadingText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  removeCover: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  removeCoverText: {
    color: C.red,
    fontSize: 14,
  },
  ticketRow: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ticketLabel: {
    color: C.gold,
    fontSize: 14,
    fontWeight: '700',
  },
  addTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  addTicketText: {
    color: C.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    color: C.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtext: {
    color: C.muted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  publishBtn: {
    width: '100%',
    marginBottom: 12,
  },
  draftBtn: {
    width: '100%',
  },
  guestTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 16,
  },
  guestSubtext: {
    color: C.muted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
});
