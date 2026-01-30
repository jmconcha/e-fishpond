import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { database } from '@/firebase';
import { ref, onValue } from 'firebase/database';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface Stats {
  pendingUsers: number;
  onlineDevices: number;
  totalDevices: number;
}

export default function AdminDashboardScreen() {
  const colorScheme = useColorScheme();
  const [stats, setStats] = useState<Stats>({ pendingUsers: 0, onlineDevices: 0, totalDevices: 2 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user stats
    const usersRef = ref(database, '/users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        let pendingCount = 0;
        
        Object.values(data).forEach((userData: any) => {
          if (userData.user_status === 'pending') {
            pendingCount++;
          }
        });
        
        setStats(prev => ({ ...prev, pendingUsers: pendingCount }));
      }
    });

    // Fetch device stats
    const cleanerRef = ref(database, '/devices/cleaner');
    const feederRef = ref(database, '/devices/feeder');
    
    let onlineCount = 0;
    
    const unsubscribeCleaner = onValue(cleanerRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.status === 'online') onlineCount++;
        setStats(prev => ({ ...prev, onlineDevices: onlineCount }));
      }
    });

    const unsubscribeFeeder = onValue(feederRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.status === 'online') onlineCount++;
        setStats(prev => ({ ...prev, onlineDevices: onlineCount }));
      }
      setLoading(false);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeCleaner();
      unsubscribeFeeder();
    };
  }, []);

  const quickActions = [
    {
      title: 'User Approvals',
      description: 'Review and approve new user registrations',
      icon: 'people',
      color: '#1F5BA8',
      link: '/(admin)/user-approval',
      count: stats.pendingUsers
    },
    {
      title: 'Device Management',
      description: 'Monitor and control connected devices',
      icon: 'hardware-chip',
      color: '#4CAF50',
      link: '/(admin)/device-management',
      count: null
    },
    {
      title: 'System Logs',
      description: 'View system activity and logs',
      icon: 'document-text',
      color: '#FF9800',
      link: '/admin/logs',
      count: null
    },
    {
      title: 'Settings',
      description: 'Configure system settings',
      icon: 'settings',
      color: '#9C27B0',
      link: '/admin/settings',
      count: null
    }
  ];

  return (
    <View style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#151718' : '#F8F9FA' }]}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
          Admin Dashboard
        </ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          System overview and quick actions
        </ThemedText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Stats Overview */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            System Overview
          </ThemedText>
          
          {loading ? (
            <ThemedText style={styles.loadingText}>Loading system stats...</ThemedText>
          ) : (
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }]}>
                <View style={[styles.statIcon, { backgroundColor: '#1F5BA820' }]}>
                  <Ionicons name="person-add" size={20} color="#1F5BA8" />
                </View>
                <ThemedText type="title" style={styles.statValue}>
                  {stats.pendingUsers}
                </ThemedText>
                <ThemedText style={styles.statLabel}>
                  Pending Users
                </ThemedText>
              </View>

              <View style={[styles.statCard, { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }]}>
                <View style={[styles.statIcon, { backgroundColor: '#4CAF5020' }]}>
                  <Ionicons name="hardware-chip" size={20} color="#4CAF50" />
                </View>
                <ThemedText type="title" style={styles.statValue}>
                  {stats.onlineDevices}/{stats.totalDevices}
                </ThemedText>
                <ThemedText style={styles.statLabel}>
                  Devices Online
                </ThemedText>
              </View>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Quick Actions
          </ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            Jump to frequently used sections
          </ThemedText>

          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <Link href={action.link as any} key={action.title} asChild>
                <TouchableOpacity 
                  style={[styles.actionCard, { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }]}
                >
                  <View style={[styles.actionIcon, { backgroundColor: `${action.color}20` }]}>
                    <Ionicons name={action.icon as any} size={24} color={action.color} />
                    {action.count !== null && action.count > 0 && (
                      <View style={styles.badge}>
                        <ThemedText style={styles.badgeText}>{action.count}</ThemedText>
                      </View>
                    )}
                  </View>
                  
                  <ThemedText type="defaultSemiBold" style={styles.actionTitle}>
                    {action.title}
                  </ThemedText>
                  
                  <ThemedText style={styles.actionDescription}>
                    {action.description}
                  </ThemedText>
                  
                  <View style={styles.actionArrow}>
                    <Ionicons name="arrow-forward" size={16} color={action.color} />
                  </View>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: '#1F5BA8',
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerTitle: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    textAlign: 'center',
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 16,
  },
  loadingText: {
    textAlign: 'center',
    padding: 20,
    opacity: 0.7,
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  actionsGrid: {
    gap: 12,
  },
  actionCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#f44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  actionTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 12,
  },
  actionArrow: {
    alignSelf: 'flex-end',
  },
});