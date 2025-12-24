import { StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { database } from '@/firebase';
import { ref, onValue } from 'firebase/database';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';


interface SensorData {
  value: number;
  unit: string;
}

export default function SensorsScreen() {
  const [phLevel, setPhLevel] = useState<SensorData | null>(null);
  const [waterTemp, setWaterTemp] = useState<SensorData | null>(null);
  const [dissolvedOxygen, setDissolvedOxygen] = useState<SensorData | null>(null);
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

    // Cleanup listeners on unmount
    return () => {
      unsubscribePh();
      unsubscribeTemp();
      unsubscribeOxygen();
    };
  }, []);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="water.circle.fill"
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText
          type="title"
          style={{
            fontFamily: Fonts.rounded,
          }}>
          Sensors
        </ThemedText>
      </ThemedView>
      <ThemedText>Monitor your aquaponic system sensors in real-time.</ThemedText>
      
      <ThemedView style={styles.sensorCard}>
        <ThemedText type="defaultSemiBold">Dissolved Oxygen</ThemedText>
        <ThemedText>
          {loading ? 'Loading...' : dissolvedOxygen ? `${dissolvedOxygen.value} ${dissolvedOxygen.unit}` : 'No data'}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.sensorCard}>
        <ThemedText type="defaultSemiBold">Water Temperature</ThemedText>
        <ThemedText>
          {loading ? 'Loading...' : waterTemp ? `${waterTemp.value} ${waterTemp.unit}` : 'No data'}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.sensorCard}>
        <ThemedText type="defaultSemiBold">pH Level</ThemedText>
        <ThemedText>
          {loading ? 'Loading...' : phLevel ? `${phLevel.value} ${phLevel.unit}` : 'No data'}
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    height: 200,
    width: 200,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  sensorCard: {
    marginVertical: 8,
    padding: 16,
    borderRadius: 8,
  },
});
