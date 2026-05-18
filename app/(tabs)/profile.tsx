import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '../../components/Avatar';
import { GoldButton } from '../../components/GoldButton';
import { EventCard } from '../../components/EventCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { updateProfile, uploadAvatar, getMyEvents, getMyRsvps } from '../../lib/api';
import { COLORS } from '../../lib/constants';
import { logger } from '../../lib/logger';
import type { Event, RSVP } from '../../lib/types';

const C = COLORS.dark;

type ProfileTab = 'events' | 'tickets';

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Date TBD';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, profile, signOut, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ProfileTab>('events');
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [myRsvps, setMyRsvps] = useState<RSVP[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const isAuthenticated = !!session;

  const loadData = useCallback(async () => {
    if (!session?.access_token) return;
    setLoadingData(true);
    try {
      const [eventsRes, rsvpsRes] = await Promise.all([
        getMyEvents(session.access_token),
        getMyRsvps(session.access_token),
      ]);
      setMyEvents(eventsRes.events);
      setMyRsvps(rsvpsRes.rsvps);
    } catch (err) {
      logger.error('Failed to load profile data', { error: String(err) });
    } finally {
      setLoadingData(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), loadData()]);
    setRefreshing(false);
  };

  const openEditModal = () => {
    setEditName(profile?.full_name ?? '');
    setEditBio(profile?.bio ?? '');
    setEditCity(profile?.city ?? '');
    setEditInstagram(profile?.instagram_url ?? '');
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!session?.access_token) return;
    setSavingProfile(true);
    try {
      await updateProfile(
        {
          full_name: editName.trim() || undefined,
          bio: editBio.trim() || undefined,
          city: editCity.trim() || undefined,
          instagram_url: editInstagram.trim() || undefined,
        },
        session.access_token,
      );
      await refreshProfile();
      setEditModalVisible(false);
      showToast('Profile updated!', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      showToast(message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePickAvatar = async () => {
    if (!session?.access_token) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setAvatarUploading(true);
      try {
        const asset = result.assets[0];
        const ext = asset.uri.split('.').pop() ?? 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${asset.base64}`;
        const { url } = await uploadAvatar(dataUrl, session.access_token);
        await updateProfile({ avatar_url: url }, session.access_token);
        await refreshProfile();
        showToast('Avatar updated!', 'success');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to upload avatar';
        showToast(message, 'error');
      } finally {
        setAvatarUploading(false);
      }
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="person-circle-outline" size={80} color={C.muted} />
        <Text style={styles.guestTitle}>Your Profile</Text>
        <Text style={styles.guestSubtext}>Sign in to see your events, tickets, and profile</Text>
        <GoldButton
          title="Sign In"
          onPress={() => router.push('/auth')}
          style={{ marginTop: 24, paddingHorizontal: 48 }}
        />
      </View>
    );
  }

  const hostedCount = myEvents.filter(e => e.status === 'published').length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.gold} />
        }
      >
        {/* Banner */}
        <View style={styles.bannerContainer}>
          {profile?.banner_url ? (
            <Image source={{ uri: profile.banner_url }} style={styles.banner} resizeMode="cover" />
          ) : (
            <View style={[styles.banner, styles.bannerPlaceholder]} />
          )}
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          {/* Avatar */}
          <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickAvatar} disabled={avatarUploading}>
            <Avatar
              uri={profile?.avatar_url}
              name={profile?.full_name}
              color={profile?.avatar_color}
              size={80}
              ringColor={C.gold}
            />
            {avatarUploading ? (
              <View style={styles.avatarOverlay}>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFF" />
              </View>
            ) : (
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={12} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>

          {/* Name Row */}
          <View style={styles.nameSection}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{profile?.full_name ?? 'Your Name'}</Text>
              {(profile?.role === 'verified' || profile?.role === 'admin') && (
                <Ionicons name="checkmark-circle" size={20} color={C.gold} />
              )}
            </View>
            {profile?.city ? (
              <View style={styles.cityRow}>
                <Ionicons name="location-outline" size={14} color={C.muted} />
                <Text style={styles.cityText}>{profile.city}</Text>
              </View>
            ) : null}
            {profile?.bio ? (
              <Text style={styles.bio}>{profile.bio}</Text>
            ) : null}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{profile?.followers_count ?? 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{profile?.following_count ?? 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{hostedCount}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionRow}>
            <GoldButton
              title="Edit Profile"
              variant="outline"
              onPress={openEditModal}
              style={{ flex: 1 }}
              size="sm"
            />
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={20} color={C.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'events' && styles.tabActive]}
            onPress={() => setActiveTab('events')}
          >
            <Text style={[styles.tabText, activeTab === 'events' && styles.tabTextActive]}>
              My Events
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'tickets' && styles.tabActive]}
            onPress={() => setActiveTab('tickets')}
          >
            <Text style={[styles.tabText, activeTab === 'tickets' && styles.tabTextActive]}>
              My Tickets
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {loadingData ? (
          <LoadingSpinner message="Loading..." />
        ) : activeTab === 'events' ? (
          <View style={styles.eventsContent}>
            {myEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={C.muted} />
                <Text style={styles.emptyText}>No events yet</Text>
                <Text style={styles.emptySubtext}>Host your first event to see it here</Text>
                <GoldButton
                  title="Create Event"
                  onPress={() => router.push('/(tabs)/host')}
                  size="sm"
                  style={{ marginTop: 12 }}
                />
              </View>
            ) : (
              myEvents.map(event => (
                <EventCard key={event.id} event={event} variant="grid" />
              ))
            )}
          </View>
        ) : (
          <View style={styles.eventsContent}>
            {myRsvps.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="ticket-outline" size={48} color={C.muted} />
                <Text style={styles.emptyText}>No tickets yet</Text>
                <Text style={styles.emptySubtext}>RSVP or buy tickets to see them here</Text>
                <GoldButton
                  title="Explore Events"
                  onPress={() => router.push('/(tabs)/explore')}
                  size="sm"
                  style={{ marginTop: 12 }}
                />
              </View>
            ) : (
              myRsvps.map(rsvp => (
                <TouchableOpacity
                  key={rsvp.id}
                  style={styles.rsvpCard}
                  onPress={() => router.push(`/event/${rsvp.event_id}`)}
                >
                  {rsvp.event_cover_url ? (
                    <Image source={{ uri: rsvp.event_cover_url }} style={styles.rsvpImage} />
                  ) : (
                    <View style={[styles.rsvpImage, styles.rsvpImagePlaceholder]}>
                      <Text style={{ fontSize: 24 }}>✝️</Text>
                    </View>
                  )}
                  <View style={styles.rsvpInfo}>
                    <Text style={styles.rsvpName} numberOfLines={2}>
                      {rsvp.event_name ?? 'Event'}
                    </Text>
                    <Text style={styles.rsvpDate}>{formatDate(rsvp.event_start_date)}</Text>
                    {rsvp.event_city ? (
                      <Text style={styles.rsvpCity}>{rsvp.event_city}</Text>
                    ) : null}
                  </View>
                  <View style={styles.rsvpBadge}>
                    <Text style={styles.rsvpBadgeText}>Going</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <GoldButton
                title="Save"
                size="sm"
                onPress={handleSaveProfile}
                loading={savingProfile}
              />
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Full Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your name"
                  placeholderTextColor={C.muted}
                  maxLength={100}
                />
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Bio</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea]}
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="Tell the community about yourself..."
                  placeholderTextColor={C.muted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                />
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>City</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editCity}
                  onChangeText={setEditCity}
                  placeholder="Your city"
                  placeholderTextColor={C.muted}
                  maxLength={100}
                />
              </View>
              <View style={styles.modalField}>
                <Text style={styles.modalLabel}>Instagram URL</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editInstagram}
                  onChangeText={setEditInstagram}
                  placeholder="https://instagram.com/..."
                  placeholderTextColor={C.muted}
                  keyboardType="url"
                  autoCapitalize="none"
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
    paddingHorizontal: 24,
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
  },
  bannerContainer: {
    height: 140,
    backgroundColor: C.surface2,
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    backgroundColor: `${C.gold}22`,
  },
  profileSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  avatarWrapper: {
    marginTop: -40,
    marginBottom: 12,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 44,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: C.gold,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.surface,
  },
  nameSection: {
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  displayName: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  cityText: {
    color: C.muted,
    fontSize: 14,
  },
  bio: {
    color: C.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface2,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    color: C.text,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: C.muted,
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: C.border,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  signOutBtn: {
    width: 40,
    height: 40,
    backgroundColor: C.surface2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: C.gold,
  },
  tabText: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: C.gold,
  },
  eventsContent: {
    padding: 16,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtext: {
    color: C.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  rsvpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  rsvpImage: {
    width: 80,
    height: 80,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rsvpImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rsvpInfo: {
    flex: 1,
    padding: 12,
  },
  rsvpName: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  rsvpDate: {
    color: C.muted,
    fontSize: 12,
  },
  rsvpCity: {
    color: C.muted,
    fontSize: 12,
  },
  rsvpBadge: {
    backgroundColor: 'rgba(78,201,140,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 12,
  },
  rsvpBadgeText: {
    color: C.green,
    fontSize: 12,
    fontWeight: '700',
  },
  // Modal
  modal: {
    flex: 1,
    backgroundColor: C.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalCancel: {
    color: C.muted,
    fontSize: 15,
  },
  modalTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '700',
  },
  modalContent: {
    padding: 16,
    gap: 16,
  },
  modalField: {
    gap: 6,
  },
  modalLabel: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modalInput: {
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalTextArea: {
    minHeight: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
});
