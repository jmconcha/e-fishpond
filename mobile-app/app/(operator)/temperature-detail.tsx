import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { database } from '@/firebase';
import { ref, onValue } from 'firebase/database';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SensorData {
  value: number;
  unit: string;
}

interface DeviceStatus {
  status: boolean;
}

export default function TemperatureDetailScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [waterTemp, setWaterTemp] = useState<SensorData | null>(null);
  const [heaterStatus, setHeaterStatus] = useState<boolean | null>(null);
  const [coolerStatus, setCoolerStatus] = useState<boolean | null>(null);
  const [heaterTimestamp, setHeaterTimestamp] = useState<string>('--');
  const [coolerTimestamp, setCoolerTimestamp] = useState<string>('--');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tempRef = ref(database, '/sensors/water_temperature');
    const heaterRef = ref(database, '/devices/heater');
    const coolerRef = ref(database, '/devices/cooler');

    const unsubscribeTemp = onValue(tempRef, (snapshot) => {
      if (snapshot.exists()) {
        setWaterTemp(snapshot.val());
      }
      setLoading(false);
    });

    const unsubscribeHeater = onValue(heaterRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val() as DeviceStatus;
        setHeaterStatus(data.status);
        const now = new Date();
        setHeaterTimestamp(now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }));
      }
    });

    const unsubscribeCooler = onValue(coolerRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val() as DeviceStatus;
        setCoolerStatus(data.status);
        const now = new Date();
        setCoolerTimestamp(now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }));
      }
    });

    return () => {
      unsubscribeTemp();
      unsubscribeHeater();
      unsubscribeCooler();
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#151718' : '#F8F9FA' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          e-FishPond
        </ThemedText>
        <View style={styles.backButton} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Title */}
        <ThemedText type="title" style={styles.sectionTitle}>Water Temperature</ThemedText>

        {/* Main Card */}
        <View style={[
          styles.mainCard,
          { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }
        ]}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <IconSymbol
              size={100}
              color="#1F5BA8"
              imageSource={require('@/assets/images/temp-up.png')}
              style={styles.mainIcon}
            />
          </View>

          {/* Status */}
          <ThemedText style={styles.statusText}>Temperature Active</ThemedText>

          {/* Value */}
          <ThemedText style={styles.valueText}>
            {loading ? '--' : waterTemp ? waterTemp.value : 'No data'}
          </ThemedText>

          {/* Optimal Range */}
          <ThemedText style={styles.optimalText}>Optimal: 25°C - 28°C</ThemedText>
        </View>

        {/* Device Status Section */}
        <View style={[
          styles.statusCard,
          { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }
        ]}>
          <ThemedText type="defaultSemiBold" style={styles.statusCardTitle}>
            Temperature Control Devices
          </ThemedText>

          {/* Heater Status */}
          <View style={styles.deviceRow}>
            <View style={styles.deviceInfo}>
              <View style={styles.deviceNameRow}>
                <IconSymbol size={18} imageSource={require('@/assets/images/flame.png')} color="#FF6B6B" style={styles.deviceIcon} />
                <ThemedText style={styles.deviceName}>Heater</ThemedText>
              </View>
              <View style={styles.statusRow}>
                <ThemedText style={[
                  styles.deviceStatus,
                  { color: heaterStatus ? '#4CAF50' : '#FF6B6B' }
                ]}>
                  {heaterStatus === null ? '--' : heaterStatus ? 'ON' : 'OFF'}
                </ThemedText>
                <ThemedText style={styles.timestampText}>{heaterTimestamp}</ThemedText>
              </View>
            </View>
          </View>

          {/* Cooler Status */}
          <View style={[styles.deviceRow, { borderTopWidth: 1, borderTopColor: colorScheme === 'dark' ? '#3A3B3C' : '#E0E0E0', paddingTopVertical: 12, marginTopVertical: 12 }]}>
            <View style={styles.deviceInfo}>
              <View style={styles.deviceNameRow}>
                <IconSymbol size={18} imageSource={require('@/assets/images/snowflake.png')} color="#00BCD4" style={styles.deviceIcon} />
                <ThemedText style={styles.deviceName}>Cooler</ThemedText>
              </View>
              <View style={styles.statusRow}>
                <ThemedText style={[
                  styles.deviceStatus,
                  { color: coolerStatus ? '#4CAF50' : '#FF6B6B' }
                ]}>
                  {coolerStatus === null ? '--' : coolerStatus ? 'ON' : 'OFF'}
                </ThemedText>
                <ThemedText style={styles.timestampText}>{coolerTimestamp}</ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <ThemedText type="defaultSemiBold" style={styles.infoTitle}>
            About Water Temperature
          </ThemedText>
          <ThemedText style={styles.infoText}>
            Water temperature affects fish metabolism and plant growth. Most aquaponic systems thrive in warm water conditions between 25-28°C.
          </ThemedText>
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
    flexDirection: 'row',
    paddingVertical: 40,
    paddingHorizontal: 16,
    backgroundColor: '#1F5BA8',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
  },
  mainCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 24,
  },
  iconContainer: {
    marginBottom: 20,
  },
  mainIcon: {
    width: 100,
    height: 100,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  valueText: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 8,
    paddingVertical: 8,
  },
  optimalText: {
    fontSize: 16,
    opacity: 0.7,
  },
  statusCard: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deviceIcon: {
    marginRight: 8,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  deviceStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  timestampText: {
    fontSize: 12,
    opacity: 0.6,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.8,
  },
});
