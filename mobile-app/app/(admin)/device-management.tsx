// app/(tabs)/admin/device-management.tsx
import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  RefreshControl 
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { database } from '@/firebase';
import { ref, onValue, update, push } from 'firebase/database';
import { Ionicons } from '@expo/vector-icons';

interface DeviceSettings {
  is_sched_editable: boolean;
  last_updated?: string;
  status?: 'online' | 'offline' | 'error';
  battery_level?: number;
  firmware_version?: string;
}

interface DeviceLog {
  id: string;
  device: 'cleaner' | 'feeder';
  action: 'toggle' | 'status_change' | 'error';
  message: string;
  timestamp: string;
  performedBy?: string;
}

export default function DeviceManagementScreen() {
  const colorScheme = useColorScheme();
  const [devicesSettings, setDevicesSettings] = useState<DeviceSettings>({ 
    is_sched_editable: false,
    status: 'offline'
  });
  const [cleanerSettings, setCleanerSettings] = useState<DeviceSettings>({ 
    is_sched_editable: false,
    status: 'offline'
  });
  const [feederSettings, setFeederSettings] = useState<DeviceSettings>({ 
    is_sched_editable: false,
    status: 'offline'
  });
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [activeDevice, setActiveDevice] = useState<'cleaner' | 'feeder' | 'all'>('all');

  useEffect(() => {
    fetchDeviceData();
    
    // Also fetch device logs
    const logsRef = ref(database, '/device_logs');
    const unsubscribeLogs = onValue(logsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const logArray: DeviceLog[] = [];
        
        Object.entries(data).forEach(([id, logData]: [string, any]) => {
          logArray.push({
            id,
            device: logData.device,
            action: logData.action,
            message: logData.message,
            timestamp: logData.timestamp,
            performedBy: logData.performedBy
          });
        });
        
        // Sort by timestamp (newest first)
        logArray.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setLogs(logArray.slice(0, 10)); // Show only last 10 logs
      }
    });

    return () => unsubscribeLogs();
  }, []);

  const fetchDeviceData = () => {
    setLoadingDevices(true);
    
    // Fetch devices settings
    const devicesRef = ref(database, '/devices');
    const unsubscribeDevices = onValue(devicesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setDevicesSettings({
          is_sched_editable: data.is_sched_editable || false,
          status: data.status || 'offline',
          battery_level: data.battery_level,
          firmware_version: data.firmware_version,
          last_updated: data.last_updated
        });
      }
      setLoadingDevices(prev => ({ ...prev, feeder: false }));
    });

    // Fetch cleaner device settings
    const cleanerRef = ref(database, '/devices/cleaner');
    const unsubscribeCleaner = onValue(cleanerRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCleanerSettings({
          is_sched_editable: data.is_sched_editable || false,
          status: data.status || 'offline',
          battery_level: data.battery_level,
          firmware_version: data.firmware_version,
          last_updated: data.last_updated
        });
      }
      setLoadingDevices(prev => ({ ...prev, cleaner: false }));
    });

    // Fetch feeder device settings
    const feederRef = ref(database, '/devices/feeder');
    const unsubscribeFeeder = onValue(feederRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setFeederSettings({
          is_sched_editable: data.is_sched_editable || false,
          status: data.status || 'offline',
          battery_level: data.battery_level,
          firmware_version: data.firmware_version,
          last_updated: data.last_updated
        });
      }
      setLoadingDevices(prev => ({ ...prev, feeder: false }));
    });

    return () => {
      unsubscribeDevices();
      unsubscribeCleaner();
      unsubscribeFeeder();
    };
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeviceData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const logDeviceAction = async (device: 'cleaner' | 'feeder', action: string, message: string) => {
    try {
      const logsRef = ref(database, '/device_logs');
      await push(logsRef, {
        device,
        action,
        message,
        timestamp: new Date().toISOString(),
        performedBy: 'admin' // You can replace with actual admin ID
      });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  };

  const handleToggleCleanerSchedule = async () => {
    try {
      const cleanerRef = ref(database, '/devices/cleaner');
      const newValue = !cleanerSettings.is_sched_editable;
      
      await update(cleanerRef, { 
        is_sched_editable: newValue,
        last_updated: new Date().toISOString()
      });
      
      setCleanerSettings(prev => ({ ...prev, is_sched_editable: newValue }));
      
      // Log the action
      await logDeviceAction('cleaner', 'toggle', 
        `Water cleaner schedule editing ${newValue ? 'enabled' : 'disabled'}`
      );
      
      Alert.alert(
        'Success', 
        `Water cleaner schedule editing ${newValue ? 'enabled' : 'disabled'}`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update water cleaner setting');
    }
  };

  const handleToggleFeederSchedule = async () => {
    try {
      const feederRef = ref(database, '/devices/feeder');
      const newValue = !feederSettings.is_sched_editable;
      
      await update(feederRef, { 
        is_sched_editable: newValue,
        last_updated: new Date().toISOString()
      });
      
      setFeederSettings(prev => ({ ...prev, is_sched_editable: newValue }));
      
      // Log the action
      await logDeviceAction('feeder', 'toggle', 
        `Fish feeder schedule editing ${newValue ? 'enabled' : 'disabled'}`
      );
      
      Alert.alert(
        'Success', 
        `Fish feeder schedule editing ${newValue ? 'enabled' : 'disabled'}`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update fish feeder setting');
    }
  };

  const handleRestartDevice = async (device: 'cleaner' | 'feeder') => {
    Alert.alert(
      'Restart Device',
      `Are you sure you want to restart the ${device === 'cleaner' ? 'water cleaner' : 'fish feeder'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          onPress: async () => {
            try {
              const deviceRef = ref(database, `/devices/${device}`);
              await update(deviceRef, { 
                status: 'restarting',
                last_updated: new Date().toISOString()
              });
              
              // Log the action
              await logDeviceAction(device, 'status_change', 'Device restart initiated');
              
              Alert.alert(
                'Restart Initiated', 
                `${device === 'cleaner' ? 'Water cleaner' : 'Fish feeder'} restart has been initiated.`,
                [{ text: 'OK' }]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to restart device');
            }
          },
        },
      ]
    );
  };

  const areDevicesLoading = () => {
    return loadingDevices === true || (typeof loadingDevices === 'object' && 
           (loadingDevices.cleaner === true || loadingDevices.feeder === true));
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return '#4CAF50';
      case 'offline': return '#f44336';
      case 'error': return '#FF9800';
      case 'restarting': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'online': return 'checkmark-circle';
      case 'offline': return 'close-circle';
      case 'error': return 'warning';
      case 'restarting': return 'refresh-circle';
      default: return 'help-circle';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredLogs = logs.filter(log => 
    activeDevice === 'all' || log.device === activeDevice
  );

  return (
    <View style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#151718' : '#F8F9FA' }]}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
          Device Management
        </ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Monitor and control connected devices
        </ThemedText>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1F5BA8']}
            tintColor="#1F5BA8"
          />
        }
      >
        {/* Device Status Overview */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Device Status Overview
          </ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            Real-time status of connected devices
          </ThemedText>

          <View style={styles.deviceOverview}>
            <View style={[styles.deviceStatusCard, { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }]}>
              <View style={styles.deviceStatusHeader}>
                <Ionicons 
                  name="water" 
                  size={24} 
                  color="#2196F3" 
                  style={styles.deviceIcon}
                />
                <View style={styles.deviceInfo}>
                  <ThemedText type="defaultSemiBold" style={styles.deviceName}>
                    Water Cleaner
                  </ThemedText>
                  <View style={styles.statusRow}>
                    <Ionicons 
                      name={getStatusIcon(cleanerSettings.status)} 
                      size={16} 
                      color={getStatusColor(cleanerSettings.status)} 
                    />
                    <ThemedText style={[styles.deviceStatus, { color: getStatusColor(cleanerSettings.status) }]}>
                      {cleanerSettings.status?.toUpperCase() || 'UNKNOWN'}
                    </ThemedText>
                  </View>
                </View>
              </View>
              
              <View style={styles.deviceDetails}>
                {cleanerSettings.battery_level && (
                  <View style={styles.detailItem}>
                    <Ionicons name="battery-charging" size={14} color="#666" />
                    <ThemedText style={styles.detailText}>
                      {cleanerSettings.battery_level}%
                    </ThemedText>
                  </View>
                )}
                {cleanerSettings.firmware_version && (
                  <View style={styles.detailItem}>
                    <Ionicons name="hardware-chip" size={14} color="#666" />
                    <ThemedText style={styles.detailText}>
                      v{cleanerSettings.firmware_version}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>

            <View style={[styles.deviceStatusCard, { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }]}>
              <View style={styles.deviceStatusHeader}>
                <Ionicons 
                  name="fish" 
                  size={24} 
                  color="#4CAF50" 
                  style={styles.deviceIcon}
                />
                <View style={styles.deviceInfo}>
                  <ThemedText type="defaultSemiBold" style={styles.deviceName}>
                    Fish Feeder
                  </ThemedText>
                  <View style={styles.statusRow}>
                    <Ionicons 
                      name={getStatusIcon(feederSettings.status)} 
                      size={16} 
                      color={getStatusColor(feederSettings.status)} 
                    />
                    <ThemedText style={[styles.deviceStatus, { color: getStatusColor(feederSettings.status) }]}>
                      {feederSettings.status?.toUpperCase() || 'UNKNOWN'}
                    </ThemedText>
                  </View>
                </View>
              </View>
              
              <View style={styles.deviceDetails}>
                {feederSettings.battery_level && (
                  <View style={styles.detailItem}>
                    <Ionicons name="battery-charging" size={14} color="#666" />
                    <ThemedText style={styles.detailText}>
                      {feederSettings.battery_level}%
                    </ThemedText>
                  </View>
                )}
                {feederSettings.firmware_version && (
                  <View style={styles.detailItem}>
                    <Ionicons name="hardware-chip" size={14} color="#666" />
                    <ThemedText style={styles.detailText}>
                      v{feederSettings.firmware_version}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Schedule Permissions */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Schedule Editing Permissions
          </ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            Control whether operators can edit device schedules
          </ThemedText>

          {areDevicesLoading() ? (
            <ThemedText style={styles.loadingText}>Loading device settings...</ThemedText>
          ) : (
            <>
              {/* Water Cleaner Permission Card */}
              <View style={[styles.permissionCard, { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }]}>
                <View style={styles.permissionHeader}>
                  <View style={styles.deviceIconContainer}>
                    <Ionicons name="water" size={20} color="#2196F3" />
                  </View>
                  <View style={styles.permissionInfo}>
                    <ThemedText type="defaultSemiBold" style={styles.permissionLabel}>
                      Water Cleaner
                    </ThemedText>
                    <ThemedText style={styles.permissionStatus}>
                      {cleanerSettings.is_sched_editable ? '✅ Editing Enabled' : '❌ Editing Disabled'}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.permissionActions}>
                  <TouchableOpacity 
                    style={[
                      styles.permissionButton,
                      { backgroundColor: cleanerSettings.is_sched_editable ? '#f44336' : '#4CAF50' }
                    ]}
                    onPress={handleToggleCleanerSchedule}
                  >
                    <Ionicons 
                      name={cleanerSettings.is_sched_editable ? 'lock-closed' : 'lock-open'} 
                      size={16} 
                      color="#fff" 
                    />
                    <ThemedText style={styles.permissionButtonText}>
                      {cleanerSettings.is_sched_editable ? 'Disable Editing' : 'Enable Editing'}
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.secondaryButton, { borderColor: '#2196F3' }]}
                    onPress={() => handleRestartDevice('cleaner')}
                  >
                    <Ionicons name="refresh" size={16} color="#2196F3" />
                    <ThemedText style={[styles.secondaryButtonText, { color: '#2196F3' }]}>
                      Restart
                    </ThemedText>
                  </TouchableOpacity>
                </View>

                <ThemedText style={styles.lastUpdated}>
                  Last updated: {formatDate(cleanerSettings.last_updated)}
                </ThemedText>
              </View>

              {/* Fish Feeder Permission Card */}
              <View style={[styles.permissionCard, { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }]}>
                <View style={styles.permissionHeader}>
                  <View style={styles.deviceIconContainer}>
                    <Ionicons name="fish" size={20} color="#4CAF50" />
                  </View>
                  <View style={styles.permissionInfo}>
                    <ThemedText type="defaultSemiBold" style={styles.permissionLabel}>
                      Fish Feeder
                    </ThemedText>
                    <ThemedText style={styles.permissionStatus}>
                      {feederSettings.is_sched_editable ? '✅ Editing Enabled' : '❌ Editing Disabled'}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.permissionActions}>
                  <TouchableOpacity 
                    style={[
                      styles.permissionButton,
                      { backgroundColor: feederSettings.is_sched_editable ? '#f44336' : '#4CAF50' }
                    ]}
                    onPress={handleToggleFeederSchedule}
                  >
                    <Ionicons 
                      name={feederSettings.is_sched_editable ? 'lock-closed' : 'lock-open'} 
                      size={16} 
                      color="#fff" 
                    />
                    <ThemedText style={styles.permissionButtonText}>
                      {feederSettings.is_sched_editable ? 'Disable Editing' : 'Enable Editing'}
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.secondaryButton, { borderColor: '#4CAF50' }]}
                    onPress={() => handleRestartDevice('feeder')}
                  >
                    <Ionicons name="refresh" size={16} color="#4CAF50" />
                    <ThemedText style={[styles.secondaryButtonText, { color: '#4CAF50' }]}>
                      Restart
                    </ThemedText>
                  </TouchableOpacity>
                </View>

                <ThemedText style={styles.lastUpdated}>
                  Last updated: {formatDate(feederSettings.last_updated)}
                </ThemedText>
              </View>
            </>
          )}
        </View>

        {/* Device Activity Logs */}
        <View style={styles.section}>
          <View style={styles.logsHeader}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Recent Activity
            </ThemedText>
            <View style={styles.logFilter}>
              <TouchableOpacity 
                style={[
                  styles.filterButton,
                  activeDevice === 'all' && styles.activeFilterButton
                ]}
                onPress={() => setActiveDevice('all')}
              >
                <ThemedText style={[
                  styles.filterButtonText,
                  activeDevice === 'all' && styles.activeFilterButtonText
                ]}>
                  All
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.filterButton,
                  activeDevice === 'cleaner' && styles.activeFilterButton
                ]}
                onPress={() => setActiveDevice('cleaner')}
              >
                <ThemedText style={[
                  styles.filterButtonText,
                  activeDevice === 'cleaner' && styles.activeFilterButtonText
                ]}>
                  Cleaner
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.filterButton,
                  activeDevice === 'feeder' && styles.activeFilterButton
                ]}
                onPress={() => setActiveDevice('feeder')}
              >
                <ThemedText style={[
                  styles.filterButtonText,
                  activeDevice === 'feeder' && styles.activeFilterButtonText
                ]}>
                  Feeder
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {filteredLogs.length === 0 ? (
            <View style={[styles.emptyLogs, { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }]}>
              <Ionicons name="document-text-outline" size={32} color="#999" />
              <ThemedText style={styles.emptyLogsText}>
                No activity logs found
              </ThemedText>
            </View>
          ) : (
            <View style={styles.logsList}>
              {filteredLogs.map((log) => (
                <View 
                  key={log.id} 
                  style={[
                    styles.logCard,
                    { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }
                  ]}
                >
                  <View style={styles.logHeader}>
                    <View style={[
                      styles.logDeviceBadge,
                      { backgroundColor: log.device === 'cleaner' ? '#2196F320' : '#4CAF5020' }
                    ]}>
                      <Ionicons 
                        name={log.device === 'cleaner' ? 'water' : 'fish'} 
                        size={12} 
                        color={log.device === 'cleaner' ? '#2196F3' : '#4CAF50'} 
                      />
                      <ThemedText style={[
                        styles.logDeviceText,
                        { color: log.device === 'cleaner' ? '#2196F3' : '#4CAF50' }
                      ]}>
                        {log.device === 'cleaner' ? 'Cleaner' : 'Feeder'}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.logTime}>
                      {formatDate(log.timestamp)}
                    </ThemedText>
                  </View>
                  
                  <ThemedText style={styles.logMessage}>
                    {log.message}
                  </ThemedText>
                  
                  {log.performedBy && (
                    <ThemedText style={styles.logPerformer}>
                      By: {log.performedBy}
                    </ThemedText>
                  )}
                </View>
              ))}
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
  deviceOverview: {
    gap: 12,
  },
  deviceStatusCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  deviceStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  deviceIcon: {
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 18,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deviceStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  deviceDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    opacity: 0.7,
  },
  permissionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  deviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  permissionStatus: {
    fontSize: 14,
    opacity: 0.9,
  },
  permissionActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  permissionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  lastUpdated: {
    fontSize: 11,
    opacity: 0.6,
    fontFamily: 'monospace',
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logFilter: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  activeFilterButton: {
    backgroundColor: '#1F5BA8',
    borderColor: '#1F5BA8',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  activeFilterButtonText: {
    color: '#FFFFFF',
  },
  emptyLogs: {
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyLogsText: {
    marginTop: 12,
    fontSize: 14,
    opacity: 0.6,
  },
  logsList: {
    gap: 8,
  },
  logCard: {
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logDeviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  logDeviceText: {
    fontSize: 10,
    fontWeight: '600',
  },
  logTime: {
    fontSize: 10,
    opacity: 0.6,
  },
  logMessage: {
    fontSize: 14,
    marginBottom: 4,
  },
  logPerformer: {
    fontSize: 11,
    opacity: 0.5,
  },
});