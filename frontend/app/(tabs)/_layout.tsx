import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="ph-detail"
        options={{
          title: 'pH Level',
          tabBarIcon: ({ color }) => <IconSymbol size={28} imageSource={require('@/assets/images/ph-optimal.png')} />,
        }}
      />
      <Tabs.Screen
        name="temperature-detail"
        options={{
          title: 'Temperature',
          tabBarIcon: ({ color }) => <IconSymbol size={28} imageSource={require('@/assets/images/temp-up.png')} />,
        }}
      />
      <Tabs.Screen
        name="oxygen-detail"
        options={{
          title: 'Oxygen',
          tabBarIcon: ({ color }) => <IconSymbol size={28} imageSource={require('@/assets/images/o2-optimal.png')} />,
        }}
      />
      <Tabs.Screen
        name="feeder-detail"
        options={{
          title: 'Feeder',
          tabBarIcon: ({ color }) => <IconSymbol size={28} imageSource={require('@/assets/images/fish-feeder.png')} />,
        }}
      />
    </Tabs>
  );
}
