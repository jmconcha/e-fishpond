// app/(tabs)/admin/device-management.tsx
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { database } from '@/firebase';
import { ref, onValue, update, push } from 'firebase/database';
import { Ionicons } from '@expo/vector-icons';

interface DeviceSettings {
  is_sched_editable: boolean;
  last_updated?: string;
  status?: 'online' | 'offline' | 'error' | 'restarting' | 'power_off';
  power_state?: 'on' | 'off';
  battery_level?: number;
  firmware_version?: string;
  temperature?: number;
  current_setting?: string;
  last_power_change?: string;
  online: boolean;
}

interface DeviceLog {
  id: string;
  device: 'cleaner' | 'feeder' | 'heater' | 'cooler' | 'aerator';
  action:
    | 'toggle'
    | 'status_change'
    | 'error'
    | 'setting_change'
    | 'power_on'
    | 'power_off';
  message: string;
  timestamp: string;
  performedBy?: string;
}

type DeviceType = 'cleaner' | 'feeder' | 'heater' | 'cooler' | 'aerator';

interface DeviceConfig {
  id: DeviceType;
  name: string;
  icon: string;
  iconColor: string;
  description: string;
  defaultPowerState?: 'on' | 'off';
}

const DEVICE_CONFIGS: DeviceConfig[] = [
  {
    id: 'cleaner',
    name: 'Water Cleaner',
    icon: 'water',
    iconColor: '#2196F3',
    description: 'Automated water filtration system',
    defaultPowerState: 'off',
  },
  {
    id: 'feeder',
    name: 'Fish Feeder',
    icon: 'fish',
    iconColor: '#4CAF50',
    description: 'Automated feeding system',
    defaultPowerState: 'off',
  },
  {
    id: 'heater',
    name: 'Water Heater',
    icon: 'thermometer',
    iconColor: '#FF5722',
    description: 'Temperature heating system',
    defaultPowerState: 'off',
  },
  {
    id: 'cooler',
    name: 'Water Cooler',
    icon: 'snow',
    iconColor: '#03A9F4',
    description: 'Temperature cooling system',
    defaultPowerState: 'off',
  },
  {
    id: 'aerator',
    name: 'Water Aerator',
    icon: 'airplane',
    iconColor: '#9C27B0',
    description: 'Oxygenation system',
    defaultPowerState: 'off',
  },
];

export default function DeviceManagementScreen() {
  const colorScheme = useColorScheme();
  const [devices, setDevices] = useState<Record<DeviceType, DeviceSettings>>(
    DEVICE_CONFIGS.reduce(
      (acc, device) => ({
        ...acc,
        [device.id]: {
          is_sched_editable: false,
          online: false,
          status: 'offline',
          power_state: device.defaultPowerState || 'off',
        },
      }),
      {} as Record<DeviceType, DeviceSettings>,
    ),
  );
  const [loadingDevices, setLoadingDevices] = useState<
    Record<DeviceType, boolean>
  >(
    DEVICE_CONFIGS.reduce(
      (acc, device) => ({
        ...acc,
        [device.id]: true,
      }),
      {} as Record<DeviceType, boolean>,
    ),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [activeDevice, setActiveDevice] = useState<DeviceType | 'all'>('all');

  useEffect(() => {
    fetchDeviceData();
    fetchDeviceLogs();

    return () => {};
  }, []);

  const fetchDeviceData = () => {
    DEVICE_CONFIGS.forEach((deviceConfig) => {
      const deviceRef = ref(database, `/devices/${deviceConfig.id}`);
      const unsubscribe = onValue(
        deviceRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            setDevices((prev) => ({
              ...prev,
              [deviceConfig.id]: {
                is_sched_editable: data.is_sched_editable || false,
                status: data.status || 'offline',
                power_state: data.power_state || 'off',
                battery_level: data.battery_level,
                firmware_version: data.firmware_version,
                last_updated: data.last_updated,
                last_power_change: data.last_power_change,
                temperature: data.temperature,
                current_setting: data.current_setting,
                online: data.online || false,
              },
            }));
          }
          setLoadingDevices((prev) => ({
            ...prev,
            [deviceConfig.id]: false,
          }));
        },
        (error) => {
          console.error(`Error fetching ${deviceConfig.name} settings:`, error);
          setLoadingDevices((prev) => ({
            ...prev,
            [deviceConfig.id]: false,
          }));
        },
      );
    });
  };

  const fetchDeviceLogs = () => {
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
            performedBy: logData.performedBy,
          });
        });

        logArray.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        setLogs(logArray.slice(0, 10));
      }
    });

    return unsubscribeLogs;
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeviceData();
    fetchDeviceLogs();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const logDeviceAction = async (
    device: DeviceType,
    action: string,
    message: string,
  ) => {
    try {
      const logsRef = ref(database, '/device_logs');
      await push(logsRef, {
        device,
        action,
        message,
        timestamp: new Date().toISOString(),
        performedBy: 'admin',
      });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  };

  const handleToggleAllDevices = async (powerState: 'on' | 'off') => {
    Alert.alert(
      `${powerState === 'on' ? 'Turn On' : 'Turn Off'} All Devices`,
      `Are you sure you want to turn ${powerState} all ${getTotalDevicesCount()} devices?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: powerState === 'on' ? 'Turn ON All' : 'Turn OFF All',
          onPress: async () => {
            try {
              // Create an array of device update promises
              const updatePromises = DEVICE_CONFIGS.map(
                async (deviceConfig) => {
                  const device = devices[deviceConfig.id];

                  // Only update devices that aren't already in the target state
                  if (device.power_state !== powerState) {
                    const deviceRef = ref(
                      database,
                      `/devices/${deviceConfig.id}`,
                    );
                    const newStatus =
                      powerState === 'on' ? 'online' : 'power_off';

                    // Update device in Firebase
                    await update(deviceRef, {
                      power_state: powerState,
                      status: newStatus,
                      last_power_change: new Date().toISOString(),
                      last_updated: new Date().toISOString(),
                    });

                    // Update local state immediately
                    setDevices((prev) => ({
                      ...prev,
                      [deviceConfig.id]: {
                        ...prev[deviceConfig.id],
                        power_state: powerState,
                        status: newStatus,
                        last_power_change: new Date().toISOString(),
                      },
                    }));

                    // Log the action
                    await logDeviceAction(
                      deviceConfig.id,
                      powerState === 'on' ? 'power_on' : 'power_off',
                      `${deviceConfig.name} turned ${powerState} (bulk operation)`,
                    );
                  }

                  // Add a small delay between updates to prevent Firebase overload
                  await new Promise((resolve) => setTimeout(resolve, 100));
                },
              );

              // Wait for all updates to complete
              await Promise.all(updatePromises);

              Alert.alert(
                'Success',
                `All devices have been turned ${powerState}`,
                [{ text: 'OK' }],
              );
            } catch (error: any) {
              Alert.alert(
                'Error',
                `Failed to turn ${powerState} all devices: ${error.message}`,
              );
            }
          },
          style: powerState === 'off' ? 'destructive' : 'default',
        },
      ],
    );
  };

  const handleTogglePower = async (
    deviceId: DeviceType,
    skipConfirmation = false,
  ) => {
    const device = devices[deviceId];
    const deviceConfig = DEVICE_CONFIGS.find((d) => d.id === deviceId);
    const newPowerState = device.power_state === 'on' ? 'off' : 'on';

    // If skipping confirmation (for bulk operations), don't show alert
    if (skipConfirmation) {
      try {
        const deviceRef = ref(database, `/devices/${deviceId}`);
        const newStatus = newPowerState === 'on' ? 'online' : 'power_off';

        await update(deviceRef, {
          power_state: newPowerState,
          status: newStatus,
          last_power_change: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        });

        setDevices((prev) => ({
          ...prev,
          [deviceId]: {
            ...prev[deviceId],
            power_state: newPowerState,
            status: newStatus,
            last_power_change: new Date().toISOString(),
          },
        }));

        await logDeviceAction(
          deviceId,
          newPowerState === 'on' ? 'power_on' : 'power_off',
          `${deviceConfig?.name} turned ${newPowerState}`,
        );

        return true; // Success
      } catch (error: any) {
        console.error(`Failed to toggle ${deviceConfig?.name}:`, error);
        return false; // Failure
      }
    }

    // Normal flow with confirmation dialog
    Alert.alert(
      `${newPowerState === 'on' ? 'Turn On' : 'Turn Off'} Device`,
      `Are you sure you want to turn ${newPowerState} the ${deviceConfig?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newPowerState === 'on' ? 'Turn On' : 'Turn Off',
          onPress: async () => {
            try {
              const deviceRef = ref(database, `/devices/${deviceId}`);
              const newStatus = newPowerState === 'on' ? 'online' : 'power_off';

              await update(deviceRef, {
                power_state: newPowerState,
                status: newStatus,
                last_power_change: new Date().toISOString(),
                last_updated: new Date().toISOString(),
              });

              setDevices((prev) => ({
                ...prev,
                [deviceId]: {
                  ...prev[deviceId],
                  power_state: newPowerState,
                  status: newStatus,
                  last_power_change: new Date().toISOString(),
                },
              }));

              await logDeviceAction(
                deviceId,
                newPowerState === 'on' ? 'power_on' : 'power_off',
                `${deviceConfig?.name} turned ${newPowerState}`,
              );

              Alert.alert(
                'Success',
                `${deviceConfig?.name} has been turned ${newPowerState}`,
                [{ text: 'OK' }],
              );
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.message ||
                  `Failed to turn ${newPowerState} ${deviceConfig?.name}`,
              );
            }
          },
          style: newPowerState === 'on' ? 'default' : 'destructive',
        },
      ],
    );
  };

  const handleToggleSchedule = async (deviceId: DeviceType) => {
    const device = devices[deviceId];
    const deviceConfig = DEVICE_CONFIGS.find((d) => d.id === deviceId);

    // Check if device is powered on before allowing schedule editing
    if (device.power_state !== 'on') {
      Alert.alert(
        'Device Powered Off',
        `Please turn on the ${deviceConfig?.name} before enabling schedule editing.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Turn On',
            onPress: () => handleTogglePower(deviceId),
          },
        ],
      );
      return;
    }

    try {
      const deviceRef = ref(database, `/devices/${deviceId}`);
      const newValue = !device.is_sched_editable;

      await update(deviceRef, {
        is_sched_editable: newValue,
        last_updated: new Date().toISOString(),
      });

      setDevices((prev) => ({
        ...prev,
        [deviceId]: { ...prev[deviceId], is_sched_editable: newValue },
      }));

      await logDeviceAction(
        deviceId,
        'toggle',
        `${deviceConfig?.name} schedule editing ${newValue ? 'enabled' : 'disabled'}`,
      );

      Alert.alert(
        'Success',
        `${deviceConfig?.name} schedule editing ${newValue ? 'enabled' : 'disabled'}`,
        [{ text: 'OK' }],
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || `Failed to update ${deviceConfig?.name} setting`,
      );
    }
  };

  const handleRestartDevice = async (deviceId: DeviceType) => {
    const device = devices[deviceId];
    const deviceConfig = DEVICE_CONFIGS.find((d) => d.id === deviceId);

    // Check if device is powered on before restarting
    if (device.power_state !== 'on') {
      Alert.alert(
        'Device Powered Off',
        `Please turn on the ${deviceConfig?.name} before restarting.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Turn On',
            onPress: () => handleTogglePower(deviceId),
          },
        ],
      );
      return;
    }

    Alert.alert(
      'Restart Device',
      `Are you sure you want to restart the ${deviceConfig?.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          onPress: async () => {
            try {
              const deviceRef = ref(database, `/devices/${deviceId}`);
              await update(deviceRef, {
                status: 'restarting',
                last_updated: new Date().toISOString(),
              });

              await logDeviceAction(
                deviceId,
                'status_change',
                'Device restart initiated',
              );

              Alert.alert(
                'Restart Initiated',
                `${deviceConfig?.name} restart has been initiated.`,
                [{ text: 'OK' }],
              );
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.message || `Failed to restart ${deviceConfig?.name}`,
              );
            }
          },
        },
      ],
    );
  };

  const areDevicesLoading = () => {
    return Object.values(loadingDevices).some((loading) => loading === true);
  };

  const getStatusColor = (status?: string, powerState?: string) => {
    if (powerState === 'off') return '#757575'; // Gray for powered off

    switch (status) {
      case 'online':
        return '#4CAF50';
      case 'offline':
        return '#f44336';
      case 'error':
        return '#FF9800';
      case 'restarting':
        return '#2196F3';
      case 'power_off':
        return '#757575';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusIcon = (status?: string, powerState?: string) => {
    if (powerState === 'off') return 'power';

    switch (status) {
      case 'online':
        return 'checkmark-circle';
      case 'offline':
        return 'close-circle';
      case 'error':
        return 'warning';
      case 'restarting':
        return 'refresh-circle';
      default:
        return 'help-circle';
    }
  };

  const getPowerButtonColor = (powerState?: string) => {
    return powerState === 'on' ? '#4CAF50' : '#757575';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

      return `${Math.floor(diffMins / 1440)}d ago`;
    } catch {
      return '';
    }
  };

  const getOnlineDevicesCount = () => {
    return Object.values(devices).filter((device) => device.online).length;
  };

  const getPoweredOnDevicesCount = () => {
    return Object.values(devices).filter(
      (device) => device.power_state === 'on',
    ).length;
  };

  const getTotalDevicesCount = () => {
    return DEVICE_CONFIGS.length;
  };

  const filteredLogs = logs.filter(
    (log) => activeDevice === 'all' || log.device === activeDevice,
  );

  const renderDeviceStatusCard = (deviceConfig: DeviceConfig) => {
    const device = devices[deviceConfig.id];
    const isPoweredOn = device.power_state === 'on';
    const statusColor = getStatusColor(device.status, device.power_state);
    const powerButtonColor = getPowerButtonColor(device.power_state);

    return (
      <View
        key={deviceConfig.id}
        style={[
          styles.deviceStatusCard,
          {
            backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF',
            opacity: isPoweredOn ? 1 : 0.8,
            borderLeftWidth: 4,
            borderLeftColor: deviceConfig.iconColor,
          },
        ]}
      >
        <View style={styles.deviceStatusHeader}>
          <View
            style={[
              styles.deviceIconContainer,
              { backgroundColor: `${deviceConfig.iconColor}20` },
            ]}
          >
            <Ionicons
              name={deviceConfig.icon as any}
              size={24}
              color={isPoweredOn ? deviceConfig.iconColor : '#999'}
            />
          </View>
          <View style={styles.deviceInfo}>
            <View style={styles.deviceTitleRow}>
              <ThemedText type="defaultSemiBold" style={styles.deviceName}>
                {deviceConfig.name}
              </ThemedText>
              <TouchableOpacity
                style={[
                  styles.powerButton,
                  { backgroundColor: powerButtonColor },
                ]}
                onPress={() => handleTogglePower(deviceConfig.id)}
              >
                <Ionicons
                  name={isPoweredOn ? 'power' : 'power-outline'}
                  size={16}
                  color="#FFFFFF"
                />
                <ThemedText style={styles.powerButtonText}>
                  {isPoweredOn ? 'ON' : 'OFF'}
                </ThemedText>
              </TouchableOpacity>
            </View>

            <ThemedText
              style={[
                styles.deviceDescription,
                { color: isPoweredOn ? 'inherit' : '#999' },
              ]}
            >
              {deviceConfig.description}
            </ThemedText>

            <View style={styles.statusRow}>
              <Ionicons
                name={getStatusIcon(device.status, device.power_state)}
                size={14}
                color={statusColor}
              />
              <ThemedText style={[styles.deviceStatus, { color: statusColor }]}>
                {device.power_state === 'off'
                  ? 'POWERED OFF'
                  : device.status?.toUpperCase() || 'UNKNOWN'}
              </ThemedText>

              {device.last_power_change && (
                <ThemedText style={styles.powerChangeTime}>
                  • {formatRelativeTime(device.last_power_change)}
                </ThemedText>
              )}
            </View>
          </View>
        </View>

        {/* Device Details - Only show when powered on */}
        {isPoweredOn && (
          <View style={styles.deviceDetails}>
            {device.battery_level !== undefined && (
              <View style={styles.detailItem}>
                <Ionicons name="battery-charging" size={14} color="#666" />
                <ThemedText style={styles.detailText}>
                  {device.battery_level}%
                </ThemedText>
              </View>
            )}

            {device.temperature !== undefined && (
              <View style={styles.detailItem}>
                <Ionicons name="thermometer" size={14} color="#666" />
                <ThemedText style={styles.detailText}>
                  {device.temperature}°C
                </ThemedText>
              </View>
            )}

            {device.firmware_version && (
              <View style={styles.detailItem}>
                <Ionicons name="hardware-chip" size={14} color="#666" />
                <ThemedText style={styles.detailText}>
                  v{device.firmware_version}
                </ThemedText>
              </View>
            )}
          </View>
        )}

        {/* Quick Action Buttons */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[
              styles.quickActionButton,
              { backgroundColor: isPoweredOn ? '#4CAF50' : '#E0E0E0' },
            ]}
            onPress={() => handleTogglePower(deviceConfig.id)}
            disabled={!isPoweredOn && false}
          >
            <Ionicons
              name={isPoweredOn ? 'power' : 'power-outline'}
              size={14}
              color={isPoweredOn ? '#FFFFFF' : '#757575'}
            />
            <ThemedText
              style={[
                styles.quickActionText,
                { color: isPoweredOn ? '#FFFFFF' : '#757575' },
              ]}
            >
              {isPoweredOn ? 'Turn Off' : 'Turn On'}
            </ThemedText>
          </TouchableOpacity>

          {isPoweredOn && device.status === 'online' && (
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => handleRestartDevice(deviceConfig.id)}
            >
              <Ionicons name="refresh" size={14} color="#2196F3" />
              <ThemedText
                style={[styles.quickActionText, { color: '#2196F3' }]}
              >
                Restart
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderPermissionCard = (deviceConfig: DeviceConfig) => {
    const device = devices[deviceConfig.id];
    const isPoweredOn = device.power_state === 'on';

    return (
      <View
        key={deviceConfig.id}
        style={[
          styles.permissionCard,
          {
            backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF',
            opacity: isPoweredOn ? 1 : 0.7,
          },
        ]}
      >
        <View style={styles.permissionHeader}>
          <View
            style={[
              styles.deviceIconContainer,
              {
                backgroundColor: `${deviceConfig.iconColor}20`,
                opacity: isPoweredOn ? 1 : 0.5,
              },
            ]}
          >
            <Ionicons
              name={deviceConfig.icon as any}
              size={20}
              color={isPoweredOn ? deviceConfig.iconColor : '#999'}
            />
          </View>
          <View style={styles.permissionInfo}>
            <View style={styles.permissionTitleRow}>
              <ThemedText
                type="defaultSemiBold"
                style={[
                  styles.permissionLabel,
                  { color: isPoweredOn ? 'inherit' : '#999' },
                ]}
              >
                {deviceConfig.name}
              </ThemedText>
              {!isPoweredOn && (
                <View style={styles.powerWarning}>
                  <Ionicons name="warning" size={12} color="#FF9800" />
                  <ThemedText style={styles.powerWarningText}>
                    Device Off
                  </ThemedText>
                </View>
              )}
            </View>
            <ThemedText
              style={[
                styles.permissionStatus,
                { color: isPoweredOn ? 'inherit' : '#999' },
              ]}
            >
              {device.is_sched_editable
                ? '✅ Editing Enabled'
                : '❌ Editing Disabled'}
              {!isPoweredOn && ' (Requires Power)'}
            </ThemedText>
          </View>
        </View>

        <View style={styles.permissionActions}>
          <TouchableOpacity
            style={[
              styles.permissionButton,
              {
                backgroundColor: device.is_sched_editable
                  ? '#f44336'
                  : '#4CAF50',
                opacity: isPoweredOn ? 1 : 0.5,
              },
            ]}
            onPress={() => handleToggleSchedule(deviceConfig.id)}
            disabled={!isPoweredOn}
          >
            <Ionicons
              name={device.is_sched_editable ? 'lock-closed' : 'lock-open'}
              size={16}
              color="#fff"
            />
            <ThemedText style={styles.permissionButtonText}>
              {device.is_sched_editable ? 'Disable Editing' : 'Enable Editing'}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              {
                borderColor: deviceConfig.iconColor,
                opacity: isPoweredOn ? 1 : 0.5,
              },
            ]}
            onPress={() => handleRestartDevice(deviceConfig.id)}
            disabled={!isPoweredOn}
          >
            <Ionicons name="refresh" size={16} color={deviceConfig.iconColor} />
            <ThemedText
              style={[
                styles.secondaryButtonText,
                { color: deviceConfig.iconColor },
              ]}
            >
              Restart
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.cardFooter}>
          <ThemedText style={styles.lastUpdated}>
            Last updated: {formatDate(device.last_updated)}
          </ThemedText>
          {device.last_power_change && (
            <ThemedText style={styles.powerStatus}>
              • Powered {device.power_state}{' '}
              {formatRelativeTime(device.last_power_change)}
            </ThemedText>
          )}
        </View>
      </View>
    );
  };

  const getSystemHealthScore = () => {
    const onlineCount = getOnlineDevicesCount();
    const poweredOnCount = getPoweredOnDevicesCount();
    const totalCount = getTotalDevicesCount();

    // Calculate weighted score (50% for online status, 50% for power status)
    const onlineScore = (onlineCount / totalCount) * 50;
    const powerScore = (poweredOnCount / totalCount) * 50;

    return Math.round(onlineScore + powerScore);
  };

  const getSystemHealthColor = () => {
    const score = getSystemHealthScore();
    if (score >= 90) return '#4CAF50'; // Green - Excellent
    if (score >= 70) return '#FF9800'; // Orange - Good
    if (score >= 50) return '#FF5722'; // Deep Orange - Fair
    return '#f44336'; // Red - Poor
  };

  const getSystemHealthStatus = () => {
    const score = getSystemHealthScore();
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Needs Attention';
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colorScheme === 'dark' ? '#151718' : '#F8F9FA' },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
          Device Management
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
        {/* Device Statistics Section - NEW */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Device Statistics
          </ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            Current status of all connected devices
          </ThemedText>

          <View style={styles.statsContainer}>
            {/* Total Devices Card */}
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor:
                    colorScheme === 'dark' ? '#252627' : '#FFFFFF',
                },
              ]}
            >
              <View style={styles.statHeader}>
                <View
                  style={[styles.statIcon, { backgroundColor: '#1F5BA820' }]}
                >
                  <Ionicons
                    name="hardware-chip-outline"
                    size={20}
                    color="#1F5BA8"
                  />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.statTitle}>
                  Total Devices
                </ThemedText>
              </View>
              <ThemedText type="title" style={styles.statValue}>
                {getTotalDevicesCount()}
              </ThemedText>
              <ThemedText style={styles.statSubtitle}>
                All connected systems
              </ThemedText>
            </View>

            {/* Online Devices Card */}
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor:
                    colorScheme === 'dark' ? '#252627' : '#FFFFFF',
                },
              ]}
            >
              <View style={styles.statHeader}>
                <View
                  style={[styles.statIcon, { backgroundColor: '#4CAF5020' }]}
                >
                  <Ionicons name="wifi" size={20} color="#4CAF50" />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.statTitle}>
                  Online Now
                </ThemedText>
              </View>
              <ThemedText
                type="title"
                style={[styles.statValue, { color: '#4CAF50' }]}
              >
                {getOnlineDevicesCount()}
              </ThemedText>
              <View style={styles.statProgress}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${(getOnlineDevicesCount() / getTotalDevicesCount()) * 100}%`,
                        backgroundColor: '#4CAF50',
                      },
                    ]}
                  />
                </View>
                <ThemedText style={styles.statSubtitle}>
                  {Math.round(
                    (getOnlineDevicesCount() / getTotalDevicesCount()) * 100,
                  )}
                  % connected
                </ThemedText>
              </View>
            </View>

            {/* Powered On Devices Card */}
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor:
                    colorScheme === 'dark' ? '#252627' : '#FFFFFF',
                },
              ]}
            >
              <View style={styles.statHeader}>
                <View
                  style={[styles.statIcon, { backgroundColor: '#FF980020' }]}
                >
                  <Ionicons name="power" size={20} color="#FF9800" />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.statTitle}>
                  Powered On
                </ThemedText>
              </View>
              <ThemedText
                type="title"
                style={[styles.statValue, { color: '#FF9800' }]}
              >
                {getPoweredOnDevicesCount()}
              </ThemedText>
              <View style={styles.statProgress}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${(getPoweredOnDevicesCount() / getTotalDevicesCount()) * 100}%`,
                        backgroundColor: '#FF9800',
                      },
                    ]}
                  />
                </View>
                <ThemedText style={styles.statSubtitle}>
                  {Math.round(
                    (getPoweredOnDevicesCount() / getTotalDevicesCount()) * 100,
                  )}
                  % active
                </ThemedText>
              </View>
            </View>

            {/* System Health Card */}
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor:
                    colorScheme === 'dark' ? '#252627' : '#FFFFFF',
                },
              ]}
            >
              <View style={styles.statHeader}>
                <View
                  style={[styles.statIcon, { backgroundColor: '#2196F320' }]}
                >
                  <Ionicons name="pulse" size={20} color="#2196F3" />
                </View>
                <ThemedText type="defaultSemiBold" style={styles.statTitle}>
                  System Health
                </ThemedText>
              </View>
              <ThemedText
                type="title"
                style={[styles.statValue, { color: getSystemHealthColor() }]}
              >
                {getSystemHealthScore()}%
              </ThemedText>
              <ThemedText
                style={[styles.statHealth, { color: getSystemHealthColor() }]}
              >
                {getSystemHealthStatus()}
              </ThemedText>
            </View>
          </View>

          {/* Power Control Buttons */}
          <View style={styles.powerAllContainer}>
            <TouchableOpacity
              style={[styles.powerAllButton, styles.powerOnButton]}
              onPress={() => handleToggleAllDevices('on')}
            >
              <Ionicons name="power" size={16} color="#FFFFFF" />
              <ThemedText style={styles.powerAllButtonText}>
                Turn ON All
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.powerAllButton, styles.powerOffButton]}
              onPress={() => handleToggleAllDevices('off')}
            >
              <Ionicons name="power-outline" size={16} color="#FFFFFF" />
              <ThemedText style={styles.powerAllButtonText}>
                Turn OFF All
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Device Status Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Device Status Overview
            </ThemedText>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
              <Ionicons name="refresh" size={16} color="#1F5BA8" />
              <ThemedText style={styles.refreshButtonText}>Refresh</ThemedText>
            </TouchableOpacity>
          </View>
          <ThemedText style={styles.sectionSubtitle}>
            Real-time status of connected devices
          </ThemedText>

          <View style={styles.deviceOverview}>
            {areDevicesLoading() ? (
              <ThemedText style={styles.loadingText}>
                Loading device status...
              </ThemedText>
            ) : (
              <>
                {DEVICE_CONFIGS.map((deviceConfig) =>
                  renderDeviceStatusCard(deviceConfig),
                )}
              </>
            )}
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
            <ThemedText style={styles.loadingText}>
              Loading device settings...
            </ThemedText>
          ) : (
            <>
              {DEVICE_CONFIGS.map((deviceConfig) =>
                renderPermissionCard(deviceConfig),
              )}
            </>
          )}
        </View>

        {/* Device Activity Logs */}
        <View style={styles.section}>
          <View style={styles.logsHeader}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Recent Activity
            </ThemedText>
          </View>
          <View style={styles.logFilter}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                activeDevice === 'all' && styles.activeFilterButton,
              ]}
              onPress={() => setActiveDevice('all')}
            >
              <ThemedText
                style={[
                  styles.filterButtonText,
                  activeDevice === 'all' && styles.activeFilterButtonText,
                ]}
              >
                All
              </ThemedText>
            </TouchableOpacity>

            {DEVICE_CONFIGS.map((device) => (
              <TouchableOpacity
                key={device.id}
                style={[
                  styles.filterButton,
                  activeDevice === device.id && styles.activeFilterButton,
                ]}
                onPress={() => setActiveDevice(device.id)}
              >
                <ThemedText
                  style={[
                    styles.filterButtonText,
                    activeDevice === device.id && styles.activeFilterButtonText,
                  ]}
                >
                  {device.name.split(' ')[1] || device.name}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {filteredLogs.length === 0 ? (
            <View
              style={[
                styles.emptyLogs,
                {
                  backgroundColor:
                    colorScheme === 'dark' ? '#252627' : '#FFFFFF',
                },
              ]}
            >
              <Ionicons name="document-text-outline" size={32} color="#999" />
              <ThemedText style={styles.emptyLogsText}>
                No activity logs found
              </ThemedText>
            </View>
          ) : (
            <View style={styles.logsList}>
              {filteredLogs.map((log) => {
                const deviceConfig = DEVICE_CONFIGS.find(
                  (d) => d.id === log.device,
                );
                return (
                  <View
                    key={log.id}
                    style={[
                      styles.logCard,
                      {
                        backgroundColor:
                          colorScheme === 'dark' ? '#252627' : '#FFFFFF',
                      },
                    ]}
                  >
                    <View style={styles.logHeader}>
                      <View
                        style={[
                          styles.logDeviceBadge,
                          { backgroundColor: `${deviceConfig?.iconColor}20` },
                        ]}
                      >
                        <Ionicons
                          name={deviceConfig?.icon as any}
                          size={12}
                          color={deviceConfig?.iconColor}
                        />
                        <ThemedText
                          style={[
                            styles.logDeviceText,
                            { color: deviceConfig?.iconColor },
                          ]}
                        >
                          {deviceConfig?.name.split(' ')[1] ||
                            deviceConfig?.name}
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
                );
              })}
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
  headerStats: {
    alignItems: 'center',
  },
  headerSubtitle: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 16,
    marginBottom: 2,
    flex: 1,
  },
  powerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  powerButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  deviceDescription: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  deviceStatus: {
    fontSize: 11,
    fontWeight: '600',
  },
  powerChangeTime: {
    fontSize: 10,
    opacity: 0.5,
    fontStyle: 'italic',
  },
  deviceDetails: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
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
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
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
  permissionInfo: {
    flex: 1,
  },
  permissionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  permissionLabel: {
    fontSize: 16,
    marginBottom: 4,
    flex: 1,
  },
  powerWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  powerWarningText: {
    fontSize: 10,
    color: '#FF9800',
    fontWeight: '600',
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
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  lastUpdated: {
    fontSize: 11,
    opacity: 0.6,
    fontFamily: 'monospace',
  },
  powerStatus: {
    fontSize: 10,
    opacity: 0.5,
    fontStyle: 'italic',
  },

  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logFilter: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 4,
  },
  activeFilterButton: {
    backgroundColor: '#1F5BA8',
    borderColor: '#1F5BA8',
  },
  filterButtonText: {
    fontSize: 11,
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
  powerAllContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  powerAllButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  powerOnButton: {
    backgroundColor: '#4CAF50',
  },
  powerOffButton: {
    backgroundColor: '#f44336',
  },
  powerAllButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '48%',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTitle: {
    fontSize: 12,
    opacity: 0.8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  statSubtitle: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 4,
  },
  statProgress: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  statHealth: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  refreshButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F5BA8',
  },
});
