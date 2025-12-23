import { StyleSheet } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

export default function SensorsScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="sensor.fill"
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
        <ThemedText type="defaultSemiBold">Temperature</ThemedText>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
      <ThemedView style={styles.sensorCard}>
        <ThemedText type="defaultSemiBold">pH Level</ThemedText>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
      <ThemedView style={styles.sensorCard}>
        <ThemedText type="defaultSemiBold">Water Level</ThemedText>
        <ThemedText>Loading...</ThemedText>
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
