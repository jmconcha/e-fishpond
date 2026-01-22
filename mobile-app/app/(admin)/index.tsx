import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { database } from '@/firebase';
import { ref, onValue, update } from 'firebase/database';

interface PendingUser {
  uid: string;
  email: string;
  status: string;
}

export default function AdminHomeScreen() {
  const colorScheme = useColorScheme();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch pending users from Firebase
    const usersRef = ref(database, '/users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const pending: PendingUser[] = [];
        
        Object.entries(data).forEach(([uid, userData]: [string, any]) => {
          // Filter users with user_status === 'pending'
          if (userData.user_status === 'pending') {
            pending.push({
              uid,
              email: userData.email || 'No email',
              status: userData.user_status,
            });
          }
        });
        
        setPendingUsers(pending);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApproveUser = async (uid: string) => {
    try {
      const userRef = ref(database, `/users/${uid}`);
      await update(userRef, { user_status: 'approved' });
      Alert.alert('Success', 'User approved successfully');
      setPendingUsers(pending => pending.filter(user => user.uid !== uid));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to approve user');
    }
  };

  const handleRejectUser = async (uid: string) => {
    Alert.alert('Reject User', 'Are you sure you want to reject this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        onPress: async () => {
          try {
            const userRef = ref(database, `/users/${uid}`);
            await update(userRef, { user_status: 'rejected' });
            Alert.alert('Success', 'User rejected');
            setPendingUsers(pending => pending.filter(user => user.uid !== uid));
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to reject user');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#151718' : '#F8F9FA' }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>Admin Dashboard</ThemedText>
        </View>

        {/* User Approval Section */}
        <View style={styles.section}>
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Pending User Approvals
          </ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            {pendingUsers.length} user(s) awaiting approval
          </ThemedText>

          {loading ? (
            <ThemedText style={styles.loadingText}>Loading...</ThemedText>
          ) : pendingUsers.length === 0 ? (
            <View style={[styles.emptyState, { borderColor: colorScheme === 'dark' ? '#333' : '#ddd' }]}>
              <ThemedText style={styles.emptyStateText}>No pending users</ThemedText>
            </View>
          ) : (
            <View style={styles.usersList}>
              {pendingUsers.map((user) => (
                <View 
                  key={user.uid} 
                  style={[
                    styles.userCard,
                    { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }
                  ]}
                >
                  <View style={styles.userInfo}>
                    <ThemedText type="defaultSemiBold" style={styles.userEmail}>
                      {user.email}
                    </ThemedText>
                    <ThemedText style={styles.userId}>
                      ID: {user.uid.substring(0, 12)}...
                    </ThemedText>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={[styles.button, styles.approveButton]}
                      onPress={() => handleApproveUser(user.uid)}
                    >
                      <ThemedText style={styles.buttonText}>Approve</ThemedText>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.button, styles.rejectButton]}
                      onPress={() => handleRejectUser(user.uid)}
                    >
                      <ThemedText style={styles.buttonText}>Reject</ThemedText>
                    </TouchableOpacity>
                  </View>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
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
  emptyState: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    opacity: 0.6,
  },
  usersList: {
    gap: 12,
  },
  userCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: {
    marginBottom: 12,
  },
  userEmail: {
    fontSize: 16,
    marginBottom: 4,
  },
  userId: {
    fontSize: 12,
    opacity: 0.6,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
