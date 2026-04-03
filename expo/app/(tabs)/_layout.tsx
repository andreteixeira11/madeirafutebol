import { Tabs } from 'expo-router';
import { Home, CalendarCheck, Trophy } from 'lucide-react-native';
import React from 'react';
import Colors from '@/constants/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.72)',
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.tabBarBorder,
          borderTopWidth: 1,
          elevation: 8,
          shadowColor: Colors.primaryDark,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          paddingTop: 6,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 4,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600' as const,
          marginTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Resultados',
          tabBarIcon: ({ color, size }) => <CalendarCheck size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="competitions"
        options={{
          title: 'Competições',
          tabBarIcon: ({ color, size }) => <Trophy size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
