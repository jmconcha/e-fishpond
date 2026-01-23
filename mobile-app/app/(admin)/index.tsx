// app/(tabs)/admin/index.tsx (or wherever your AdminHomeScreen is)
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { database } from '@/firebase';
import { ref, onValue, update } from 'firebase/database';

interface DeviceSettings {
  is_sched_editable: boolean;
}

export default function AdminHomeScreen() {
  const colorScheme = useColorScheme();
  const [cleanerSettings, setCleanerSettings] = useState<DeviceSettings>({ is_sched_editable: false });
  const [feederSettings, setFeederSettings] = useState<DeviceSettings>({ is_sched_editable: false });
  const [loadingDevices, setLoadingDevices] = useState(true);

  useEffect(() => {
    // Fetch cleaner device settings
    const cleanerRef = ref(database, '/devices/cleaner');
    const unsubscribeCleaner = onValue(cleanerRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCleanerSettings({
          is_sched_editable: data.is_sched_editable || false
        });
      }
      setLoadingDevices(prev => ({ ...prev, cleaner: false }));
    }, (error) => {
      console.error('Error fetching cleaner settings:', error);
      setLoadingDevices(prev => ({ ...prev, cleaner: false }));
    });

    // Fetch feeder device settings
    const feederRef = ref(database, '/devices/feeder');
    const unsubscribeFeeder = onValue(feederRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setFeederSettings({
          is_sched_editable: data.is_sched_editable || false
        });
      }
      setLoadingDevices(prev => ({ ...prev, feeder: false }));
    }, (error) => {
      console.error('Error fetching feeder settings:', error);
      setLoadingDevices(prev => ({ ...prev, feeder: false }));
    });

    return () => {
      unsubscribeCleaner();
      unsubscribeFeeder();
    };
  }, []);

  const handleToggleCleanerSchedule = async () => {
    try {
      const cleanerRef = ref(database, '/devices/cleaner');
      const newValue = !cleanerSettings.is_sched_editable;
      
      await update(cleanerRef, { is_sched_editable: newValue });
      setCleanerSettings(prev => ({ ...prev, is_sched_editable: newValue }));
      
      Alert.alert('Success', `Water cleaner schedule editing ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update water cleaner setting');
    }
  };

  const handleToggleFeederSchedule = async () => {
    try {
      const feederRef = ref(database, '/devices/feeder');
      const newValue = !feederSettings.is_sched_editable;
      
      await update(feederRef, { is_sched_editable: newValue });
      setFeederSettings(prev => ({ ...prev, is_sched_editable: newValue }));
      
      Alert.alert('Success', `Fish feeder schedule editing ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update fish feeder setting');
    }
  };

  const areDevicesLoading = () => {
    return loadingDevices === true || (typeof loadingDevices === 'object' && 
           (loadingDevices.cleaner === true || loadingDevices.feeder === true));
  };

  return (
    <View style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#151718' : '#F8F9FA' }]}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
          Admin Dashboard
        </ThemedText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Device Management Section */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Device Management
          </ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            Control device schedule permissions for operators
          </ThemedText>
        </View>

        {/* Fish Feeder Schedule Management Section */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.deviceSectionTitle}>
            Fish Feeder
          </ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            Control whether operators can edit fish feeder schedules
          </ThemedText>

          {areDevicesLoading() ? (
            <ThemedText style={styles.loadingText}>Loading...</ThemedText>
          ) : (
            <View style={[styles.settingCard, { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }]}>
              <View style={styles.settingInfo}>
                <ThemedText type="defaultSemiBold" style={styles.settingLabel}>
                  Schedule Editing Permission
                </ThemedText>
                <ThemedText style={styles.settingStatus}>
                  {feederSettings.is_sched_editable ? '✅ Enabled' : '❌ Disabled'}
                </ThemedText>
                <ThemedText style={styles.devicePath}>
                  Path: /devices/feeder
                </ThemedText>
              </View>

              <TouchableOpacity 
                style={[
                  styles.toggleButton,
                  { backgroundColor: feederSettings.is_sched_editable ? '#f44336' : '#4CAF50' }
                ]}
                onPress={handleToggleFeederSchedule}
              >
                <ThemedText style={styles.toggleButtonText}>
                  {feederSettings.is_sched_editable ? 'Disable' : 'Enable'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Water Cleaner Schedule Section */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.deviceSectionTitle}>
            Water Cleaner
          </ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            Control whether operators can edit water cleaner schedules
          </ThemedText>

          {areDevicesLoading() ? (
            <ThemedText style={styles.loadingText}>Loading...</ThemedText>
          ) : (
            <View style={[styles.settingCard, { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }]}>
              <View style={styles.settingInfo}>
                <ThemedText type="defaultSemiBold" style={styles.settingLabel}>
                  Schedule Editing Permission
                </ThemedText>
                <ThemedText style={styles.settingStatus}>
                  {cleanerSettings.is_sched_editable ? '✅ Enabled' : '❌ Disabled'}
                </ThemedText>
                <ThemedText style={styles.devicePath}>
                  Path: /devices/cleaner
                </ThemedText>
              </View>

              <TouchableOpacity 
                style={[
                  styles.toggleButton,
                  { backgroundColor: cleanerSettings.is_sched_editable ? '#f44336' : '#4CAF50' }
                ]}
                onPress={handleToggleCleanerSchedule}
              >
                <ThemedText style={styles.toggleButtonText}>
                  {cleanerSettings.is_sched_editable ? 'Disable' : 'Enable'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}
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
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  deviceSectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1F5BA8',
  },
  sectionTitle: {
    fontSize: 22,
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
  },
  settingCard: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  settingStatus: {
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 4,
  },
  devicePath: {
    fontSize: 12,
    opacity: 0.6,
    fontFamily: 'monospace',
  },
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    minWidth: 80,
  },
  toggleButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});