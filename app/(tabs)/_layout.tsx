import React from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '../../components/TabBar';
import { useTheme } from '../../contexts/ThemeContext';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      tabBar={props => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.c.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Discover' }} />
      <Tabs.Screen name="explore" options={{ title: 'Events' }} />
      <Tabs.Screen name="tickets" options={{ title: 'Tickets' }} />
      <Tabs.Screen name="community" options={{ title: 'Community' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      {/* Not shown in TabBar (it only draws its five tabs): reached from Profile, Discover and event screens */}
      <Tabs.Screen name="host" options={{ title: 'Host' }} />
    </Tabs>
  );
}
