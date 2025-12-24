import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { database } from '@/firebase';
import { ref, onValue } from 'firebase/database';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface FeederData {
  next_feed_time?: string;
}

export default function FeederDetailScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [nextFeedTime, setNextFeedTime] = useState<string>('4:00 PM');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const feedRef = ref(database, '/feeder/next_feed_time');
    const unsubscribeFeed = onValue(feedRef, (snapshot) => {
      if (snapshot.exists()) {
        setNextFeedTime(snapshot.val());
      }
      setLoading(false);
    });

    return () => {
      unsubscribeFeed();
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
        <ThemedText type="title" style={styles.sectionTitle}>Automated Fish Feeder</ThemedText>

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
              imageSource={require('@/assets/images/fish-feeder.png')}
              style={styles.mainIcon}
            />
          </View>

          {/* Status */}
          <ThemedText style={styles.statusText}>Feeder Active</ThemedText>

          {/* Value */}
          <ThemedText style={styles.valueText}>
            {loading ? '--' : nextFeedTime}
          </ThemedText>

          {/* Optimal Range */}
          <ThemedText style={styles.optimalText}>Next Scheduled Feed</ThemedText>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <ThemedText type="defaultSemiBold" style={styles.infoTitle}>
            About the Fish Feeder
          </ThemedText>
          <ThemedText style={styles.infoText}>
            The automated fish feeder dispenses food at scheduled times to ensure consistent feeding. Proper feeding maintains fish health and nutrient cycling in your aquaponic system.
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
