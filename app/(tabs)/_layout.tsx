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
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="host" options={{ title: 'Host' }} />
      <Tabs.Screen name="community" options={{ title: 'Community' }} />
      <Tabs.Screen name="tickets" options={{ title: 'Tickets' }} />
    </Tabs>
  );
}
