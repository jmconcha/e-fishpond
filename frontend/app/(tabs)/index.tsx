import {
  StyleSheet,
  ScrollView,
  View,
  Pressable,
} from 'react-native';
import { useEffect, useState } from 'react';
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

interface SensorMetric {
  id: string;
  label: string;
  icon?: string;
  imageSource?: any;
  value: SensorData | null;
  loading: boolean;
}

export default function SensorsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [phLevel, setPhLevel] = useState<SensorData | null>(null);
  const [waterTemp, setWaterTemp] = useState<SensorData | null>(null);
  const [dissolvedOxygen, setDissolvedOxygen] = useState<SensorData | null>(
    null
  );
  const [nextFeedTime, setNextFeedTime] = useState<string>('4:00 PM');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch pH Level
    const phRef = ref(database, '/sensors/ph_level');
    const unsubscribePh = onValue(phRef, (snapshot) => {
      if (snapshot.exists()) {
        setPhLevel(snapshot.val());
      }
      setLoading(false);
    });

    // Fetch Water Temperature
    const tempRef = ref(database, '/sensors/water_temperature');
    const unsubscribeTemp = onValue(tempRef, (snapshot) => {
      if (snapshot.exists()) {
        setWaterTemp(snapshot.val());
      }
    });

    // Fetch Dissolved Oxygen
    const oxygenRef = ref(database, '/sensors/dissolved_oxygen');
    const unsubscribeOxygen = onValue(oxygenRef, (snapshot) => {
      if (snapshot.exists()) {
        setDissolvedOxygen(snapshot.val());
      }
    });

    // Fetch Next Feed Time
    const feedRef = ref(database, '/feeder/next_feed_time');
    const unsubscribeFeed = onValue(feedRef, (snapshot) => {
      if (snapshot.exists()) {
        setNextFeedTime(snapshot.val());
      }
    });

    // Cleanup listeners on unmount
    return () => {
      unsubscribePh();
      unsubscribeTemp();
      unsubscribeOxygen();
      unsubscribeFeed();
    };
  }, []);

  const metrics: SensorMetric[] = [
    {
      id: 'ph',
      label: 'pH Level',
      imageSource: require('@/assets/images/ph-optimal.png'),
      value: phLevel,
      loading,
    },
    {
      id: 'temp',
      label: 'Water Temperature',
      imageSource: require('@/assets/images/temp-optimal.png'),
      value: waterTemp,
      loading,
    },
    {
      id: 'oxygen',
      label: 'Dissolved Oxygen',
      imageSource: require('@/assets/images/o2-optimal.png'),
      value: dissolvedOxygen,
      loading,
    },
    {
      id: 'feeder',
      label: 'Automated Fish Feeder',
      imageSource: require('@/assets/images/fish-feeder.png'),
      value: null,
      loading: false,
    },
  ];

  const iconColor = colorScheme === 'dark' ? '#4A90E2' : '#1F5BA8';

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
          e-FishPond
        </ThemedText>
      </View>

      {/* Metrics Container */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Water Quality Title */}
        <ThemedText type="title" style={styles.sectionTitle}>
          Water Quality
        </ThemedText>
        {metrics.map((metric) => {
          const isTappable = ['ph', 'temp', 'oxygen', 'feeder'].includes(
            metric.id
          );
          const navigationMap: { [key: string]: string } = {
            ph: 'ph-detail',
            temp: 'temperature-detail',
            oxygen: 'oxygen-detail',
            feeder: 'feeder-detail',
          };

          return (
            <Pressable
              key={metric.id}
              onPress={() => {
                if (isTappable) {
                  router.push(`/${navigationMap[metric.id]}`);
                }
              }}
              style={styles.metricCardTouchable}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.metricCard,
                    {
                      backgroundColor: pressed
                        ? colorScheme === 'dark'
                          ? '#3A3A3A'
                          : '#F0F0F0'
                        : colorScheme === 'dark'
                        ? '#252627'
                        : '#FFFFFF',
                    },
                  ]}
                >
                  <View style={styles.metricLeft}>
                    <IconSymbol
                      size={40}
                      color={metric.imageSource ? undefined : iconColor}
                      name={metric.icon}
                      imageSource={metric.imageSource}
                      style={styles.metricIcon}
                    />
                    <View style={styles.metricLabels}>
                      <ThemedText style={styles.metricLabel}>
                        {metric.label}
                      </ThemedText>
                      {metric.id === 'feeder' && (
                        <ThemedText style={styles.metricSubLabel}>
                          Next Feed: {nextFeedTime}
                        </ThemedText>
                      )}
                    </View>
                  </View>
                  <View style={styles.metricRight}>
                    {metric.loading ? (
                      <ThemedText style={styles.metricValue}>--</ThemedText>
                    ) : metric.value ? (
                      <ThemedText style={styles.metricValue}>
                        {metric.value.value}
                        {metric.value.unit}
                      </ThemedText>
                    ) : metric.id === 'feeder' ? (
                      <View />
                    ) : (
                      <ThemedText style={styles.metricValue}>
                        No data
                      </ThemedText>
                    )}
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 50,
    backgroundColor: '#1F5BA8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 56,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingBottom: 100,
  },
  metricCardTouchable: {
    marginBottom: 12,
  },
  metricCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metricIcon: {
    marginRight: 16,
  },
  metricLabels: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  metricSubLabel: {
    fontSize: 13,
    opacity: 0.7,
  },
  metricRight: {
    alignItems: 'flex-end',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
  },
});
