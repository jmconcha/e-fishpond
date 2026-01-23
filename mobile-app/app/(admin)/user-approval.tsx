// app/(tabs)/admin/user-approval.tsx
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
import { ref, onValue, update } from 'firebase/database';
import { Ionicons } from '@expo/vector-icons';

interface PendingUser {
  uid: string;
  email: string;
  status: string;
  displayName?: string;
  createdAt?: string;
  phone?: string;
}

export default function UserApprovalScreen() {
  const colorScheme = useColorScheme();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<PendingUser[]>([]);
  const [rejectedUsers, setRejectedUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    setLoading(true);
    const usersRef = ref(database, '/users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const pending: PendingUser[] = [];
        const approved: PendingUser[] = [];
        const rejected: PendingUser[] = [];
        
        Object.entries(data).forEach(([uid, userData]: [string, any]) => {
          const user = {
            uid,
            email: userData.email || 'No email',
            displayName: userData.displayName || 'No name',
            status: userData.user_status || 'unknown',
            createdAt: userData.createdAt || '',
            phone: userData.phone || 'No phone'
          };
          
          if (userData.user_status === 'pending') {
            pending.push(user);
          } else if (userData.user_status === 'approved') {
            approved.push(user);
          } else if (userData.user_status === 'rejected') {
            rejected.push(user);
          }
        });
        
        // Sort by creation date (newest first)
        pending.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        approved.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        rejected.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        
        setPendingUsers(pending);
        setApprovedUsers(approved);
        setRejectedUsers(rejected);
      }
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const handleApproveUser = async (uid: string, email: string) => {
    Alert.alert(
      'Approve User',
      `Are you sure you want to approve ${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              const userRef = ref(database, `/users/${uid}`);
              await update(userRef, { 
                user_status: 'approved',
                approvedAt: new Date().toISOString(),
                approvedBy: 'admin' // You can replace with actual admin ID
              });
              Alert.alert('Success', 'User approved successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to approve user');
            }
          },
        },
      ]
    );
  };

  const handleRejectUser = async (uid: string, email: string) => {
    Alert.alert(
      'Reject User',
      `Are you sure you want to reject ${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          onPress: async () => {
            try {
              const userRef = ref(database, `/users/${uid}`);
              await update(userRef, { 
                user_status: 'rejected',
                rejectedAt: new Date().toISOString(),
                rejectedBy: 'admin' // You can replace with actual admin ID
              });
              Alert.alert('Success', 'User rejected');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to reject user');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleReinstateUser = async (uid: string, email: string) => {
    Alert.alert(
      'Reinstate User',
      `Are you sure you want to reinstate ${email} to pending?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reinstate',
          onPress: async () => {
            try {
              const userRef = ref(database, `/users/${uid}`);
              await update(userRef, { 
                user_status: 'pending',
                reinstatedAt: new Date().toISOString()
              });
              Alert.alert('Success', 'User reinstated to pending');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to reinstate user');
            }
          },
        },
      ]
    );
  };

  const getCurrentUsers = () => {
    switch (activeTab) {
      case 'pending': return pendingUsers;
      case 'approved': return approvedUsers;
      case 'rejected': return rejectedUsers;
      default: return pendingUsers;
    }
  };

  const getTabCount = (tab: 'pending' | 'approved' | 'rejected') => {
    switch (tab) {
      case 'pending': return pendingUsers.length;
      case 'approved': return approvedUsers.length;
      case 'rejected': return rejectedUsers.length;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#151718' : '#F8F9FA' }]}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
          User Management
        </ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Approve or reject user registrations
        </ThemedText>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'pending' && styles.activeTab,
            { borderBottomColor: activeTab === 'pending' ? '#4CAF50' : 'transparent' }
          ]}
          onPress={() => setActiveTab('pending')}
        >
          <ThemedText style={[
            styles.tabText, 
            activeTab === 'pending' && styles.activeTabText
          ]}>
            Pending ({getTabCount('pending')})
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'approved' && styles.activeTab,
            { borderBottomColor: activeTab === 'approved' ? '#2196F3' : 'transparent' }
          ]}
          onPress={() => setActiveTab('approved')}
        >
          <ThemedText style={[
            styles.tabText, 
            activeTab === 'approved' && styles.activeTabText
          ]}>
            Approved ({getTabCount('approved')})
          </ThemedText>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'rejected' && styles.activeTab,
            { borderBottomColor: activeTab === 'rejected' ? '#f44336' : 'transparent' }
          ]}
          onPress={() => setActiveTab('rejected')}
        >
          <ThemedText style={[
            styles.tabText, 
            activeTab === 'rejected' && styles.activeTabText
          ]}>
            Rejected ({getTabCount('rejected')})
          </ThemedText>
        </TouchableOpacity>
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
        {loading ? (
          <View style={styles.loadingContainer}>
            <ThemedText style={styles.loadingText}>Loading users...</ThemedText>
          </View>
        ) : getCurrentUsers().length === 0 ? (
          <View style={[styles.emptyState, { borderColor: colorScheme === 'dark' ? '#333' : '#ddd' }]}>
            <Ionicons 
              name="people-outline" 
              size={48} 
              color={colorScheme === 'dark' ? '#666' : '#999'} 
            />
            <ThemedText style={styles.emptyStateTitle}>
              No {activeTab} users
            </ThemedText>
            <ThemedText style={styles.emptyStateText}>
              {activeTab === 'pending' 
                ? 'All users have been processed' 
                : `No ${activeTab} users found`}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.usersList}>
            {getCurrentUsers().map((user) => (
              <View 
                key={user.uid} 
                style={[
                  styles.userCard,
                  { backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF' }
                ]}
              >
                <View style={styles.userHeader}>
                  <View style={styles.userAvatar}>
                    <ThemedText style={styles.avatarText}>
                      {user.displayName?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                    </ThemedText>
                  </View>
                  <View style={styles.userInfo}>
                    <ThemedText type="defaultSemiBold" style={styles.userName}>
                      {user.displayName || 'No name'}
                    </ThemedText>
                    <ThemedText style={styles.userEmail}>
                      {user.email}
                    </ThemedText>
                    {user.phone && (
                      <ThemedText style={styles.userPhone}>
                        📱 {user.phone}
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.userStatus}>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: 
                        user.status === 'approved' ? '#4CAF5020' : 
                        user.status === 'rejected' ? '#f4433620' : 
                        '#FF980020'
                      }
                    ]}>
                      <ThemedText style={[
                        styles.statusText,
                        { color: 
                          user.status === 'approved' ? '#4CAF50' : 
                          user.status === 'rejected' ? '#f44336' : 
                          '#FF9800'
                        }
                      ]}>
                        {user.status.toUpperCase()}
                      </ThemedText>
                    </View>
                  </View>
                </View>

                <View style={styles.userDetails}>
                  <ThemedText style={styles.userId}>
                    ID: {user.uid.substring(0, 8)}...{user.uid.substring(user.uid.length - 4)}
                  </ThemedText>
                  {user.createdAt && (
                    <ThemedText style={styles.userDate}>
                      Registered: {formatDate(user.createdAt)}
                    </ThemedText>
                  )}
                </View>

                <View style={styles.actionButtons}>
                  {activeTab === 'pending' ? (
                    <>
                      <TouchableOpacity 
                        style={[styles.button, styles.approveButton]}
                        onPress={() => handleApproveUser(user.uid, user.email)}
                      >
                        <Ionicons name="checkmark-circle" size={16} color="#fff" />
                        <ThemedText style={styles.buttonText}>Approve</ThemedText>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[styles.button, styles.rejectButton]}
                        onPress={() => handleRejectUser(user.uid, user.email)}
                      >
                        <Ionicons name="close-circle" size={16} color="#fff" />
                        <ThemedText style={styles.buttonText}>Reject</ThemedText>
                      </TouchableOpacity>
                    </>
                  ) : activeTab === 'rejected' ? (
                    <TouchableOpacity 
                      style={[styles.button, styles.reinstateButton]}
                      onPress={() => handleReinstateUser(user.uid, user.email)}
                    >
                      <Ionicons name="refresh-circle" size={16} color="#fff" />
                      <ThemedText style={styles.buttonText}>Reinstate</ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.button, styles.viewButton]}
                      onPress={() => Alert.alert('User Details', `Viewing details for ${user.email}`)}
                    >
                      <Ionicons name="eye" size={16} color="#fff" />
                      <ThemedText style={styles.buttonText}>View Details</ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 3,
  },
  activeTab: {
    backgroundColor: '#F5F5F5',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#1F5BA8',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    textAlign: 'center',
    padding: 20,
    opacity: 0.7,
    fontSize: 16,
  },
  emptyState: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
  usersList: {
    gap: 16,
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
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1F5BA8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 12,
    opacity: 0.7,
  },
  userStatus: {
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  userDetails: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  userId: {
    fontSize: 11,
    fontFamily: 'monospace',
    opacity: 0.6,
    marginBottom: 4,
  },
  userDate: {
    fontSize: 12,
    opacity: 0.7,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  reinstateButton: {
    backgroundColor: '#FF9800',
  },
  viewButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});