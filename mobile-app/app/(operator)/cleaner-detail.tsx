import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
} from 'react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { database } from '@/firebase';
import { ref, onValue, update, push, set, remove } from 'firebase/database';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface CleaningData {
  next_cleaning_time?: string;
  last_cleaned?: string;
  cleaning_duration?: number;
  status?: 'idle' | 'cleaning' | 'maintenance' | 'error';
  water_quality?: number;
  filter_life?: number;
  is_schedule_editable?: boolean;
}

interface CleaningSchedule {
  id: string;
  run_at: string; // ISO datetime
  repeat_daily: boolean; // if true, repeats every day at the chosen time
  enabled: boolean;
  created_at: string;
  updated_at?: string;
  device?: 'cleaner';
}

export default function WaterCleaningScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  const [cleaningData, setCleaningData] = useState<CleaningData>({
    next_cleaning_time: 'Not scheduled',
    last_cleaned: 'Never',
    cleaning_duration: 30,
    status: 'idle',
    water_quality: 85,
    filter_life: 75,
    is_schedule_editable: false,
  });

  const [loading, setLoading] = useState(true);

  // Modal / Form state
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null,
  );
  const [addingSchedule, setAddingSchedule] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<Date>(new Date());
  const [repeatDaily, setRepeatDaily] = useState<boolean>(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [schedules, setSchedules] = useState<CleaningSchedule[]>([]);

  useEffect(() => {
    const unsubCleaner = fetchCleaningData();
    const unsubSchedules = fetchSchedules();
    return () => {
      unsubCleaner?.();
      unsubSchedules?.();
    };
  }, []);

  const fetchCleaningData = () => {
    const cleanerRef = ref(database, '/devices/cleaner');
    const unsubscribe = onValue(cleanerRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCleaningData({
          next_cleaning_time: data.next_cleaning_time || 'Not scheduled',
          last_cleaned: data.last_cleaned || 'Never',
          cleaning_duration: data.cleaning_duration || 30,
          status: data.status || 'idle',
          water_quality: data.water_quality || 85,
          filter_life: data.filter_life || 75,
          is_schedule_editable: data.is_sched_editable || false,
        });
      }
      setLoading(false);
    });

    return unsubscribe;
  };

  const fetchSchedules = () => {
    const schedulesRef = ref(database, '/cleaning_schedules');
    const unsubscribe = onValue(schedulesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const scheduleArray: CleaningSchedule[] = [];

        Object.keys(data).forEach((key) => {
          const s = data[key] || {};
          scheduleArray.push({
            id: key,
            run_at: s.run_at || new Date().toISOString(),
            repeat_daily: !!s.repeat_daily,
            enabled: s.enabled !== false,
            created_at: s.created_at || new Date().toISOString(),
            updated_at: s.updated_at,
            device: s.device || 'cleaner',
          });
        });

        setSchedules(scheduleArray);
      } else {
        setSchedules([]);
      }
    });

    return unsubscribe;
  };

  const logCleaningAction = async (action: string, message: string) => {
    try {
      const logsRef = ref(database, '/cleaning_logs');
      await push(logsRef, {
        action,
        message,
        timestamp: new Date().toISOString(),
        performedBy: 'user',
      });
    } catch (error) {
      console.error('Failed to log cleaning action:', error);
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeOnly = (d: Date) => {
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const combineDateAndTime = (datePart: Date, timePart: Date) => {
    const d = new Date(datePart);
    d.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
    return d;
  };

  // For daily repeat: next run is today at chosen time if still upcoming, else tomorrow.
  const computeNextRunAt = (base: Date, repeatDailyFlag: boolean) => {
    if (!repeatDailyFlag) return base;

    const now = new Date();
    const next = new Date(now);
    next.setHours(base.getHours(), base.getMinutes(), 0, 0);

    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  };

  const resetScheduleForm = () => {
    setSelectedDate(new Date());
    setSelectedTime(new Date());
    setRepeatDaily(false);
    setEditingScheduleId(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  const handleAddSchedule = async () => {
    if (!cleaningData.is_schedule_editable) {
      Alert.alert(
        'Schedule Editing Disabled',
        'Schedule editing is currently disabled by the administrator.',
        [{ text: 'OK' }],
      );
      return;
    }

    setAddingSchedule(true);

    try {
      const combined = combineDateAndTime(selectedDate, selectedTime);
      const runAt = computeNextRunAt(combined, repeatDaily);

      if (!repeatDaily && runAt.getTime() < Date.now()) {
        Alert.alert(
          'Invalid Date/Time',
          'Please choose a future date and time.',
        );
        setAddingSchedule(false);
        return;
      }

      const schedulesRef = ref(database, '/cleaning_schedules');
      const newScheduleRef = push(schedulesRef);

      const newSchedule = {
        run_at: runAt.toISOString(),
        repeat_daily: repeatDaily,
        enabled: true,
        created_at: new Date().toISOString(),
        device: 'cleaner',
      };

      await set(newScheduleRef, newSchedule);

      await logCleaningAction(
        'add_schedule',
        `Added cleaning schedule for ${formatDateTime(runAt.toISOString())}${
          repeatDaily ? ' (repeats daily)' : ''
        }`,
      );

      Alert.alert(
        'Success',
        `Cleaning scheduled for ${formatDateTime(runAt.toISOString())}${
          repeatDaily ? ' (repeats daily)' : ''
        }`,
      );

      setShowAddSchedule(false);
      resetScheduleForm();
    } catch (error: any) {
      console.error('Error adding schedule:', error);
      Alert.alert('Error', `Failed to add schedule: ${error.message}`);
    } finally {
      setAddingSchedule(false);
    }
  };

  const handleUpdateSchedule = async (scheduleId: string) => {
    if (!cleaningData.is_schedule_editable) {
      Alert.alert(
        'Schedule Editing Disabled',
        'Schedule editing is currently disabled by the administrator.',
        [{ text: 'OK' }],
      );
      return;
    }

    setAddingSchedule(true);

    try {
      const combined = combineDateAndTime(selectedDate, selectedTime);
      const runAt = computeNextRunAt(combined, repeatDaily);

      if (!repeatDaily && runAt.getTime() < Date.now()) {
        Alert.alert(
          'Invalid Date/Time',
          'Please choose a future date and time.',
        );
        setAddingSchedule(false);
        return;
      }

      const scheduleRef = ref(database, `/cleaning_schedules/${scheduleId}`);
      await update(scheduleRef, {
        run_at: runAt.toISOString(),
        repeat_daily: repeatDaily,
        updated_at: new Date().toISOString(),
      });

      await logCleaningAction(
        'update_schedule',
        `Updated cleaning schedule to ${formatDateTime(runAt.toISOString())}${
          repeatDaily ? ' (repeats daily)' : ''
        }`,
      );

      Alert.alert(
        'Success',
        `Schedule updated to ${formatDateTime(runAt.toISOString())}${
          repeatDaily ? ' (repeats daily)' : ''
        }`,
      );

      setShowAddSchedule(false);
      resetScheduleForm();
    } catch (error: any) {
      console.error('Error updating schedule:', error);
      Alert.alert('Error', `Failed to update schedule: ${error.message}`);
    } finally {
      setAddingSchedule(false);
    }
  };

  const handleToggleSchedule = async (scheduleId: string, enabled: boolean) => {
    try {
      const scheduleRef = ref(database, `/cleaning_schedules/${scheduleId}`);
      await update(scheduleRef, {
        enabled: !enabled,
        updated_at: new Date().toISOString(),
      });

      const schedule = schedules.find((s) => s.id === scheduleId);
      await logCleaningAction(
        'toggle_schedule',
        `${!enabled ? 'Enabled' : 'Disabled'} schedule ${
          schedule?.repeat_daily ? '(daily)' : ''
        } for ${schedule ? formatDateTime(schedule.run_at) : scheduleId}`,
      );

      Alert.alert('Success', `Schedule ${!enabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      console.error('Error toggling schedule:', error);
      Alert.alert('Error', `Failed to update schedule: ${error.message}`);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    Alert.alert(
      'Delete Schedule',
      'Are you sure you want to delete this cleaning schedule?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const scheduleRef = ref(
                database,
                `/cleaning_schedules/${scheduleId}`,
              );
              await remove(scheduleRef);

              await logCleaningAction(
                'delete_schedule',
                `Deleted cleaning schedule (${scheduleId})`,
              );

              Alert.alert('Success', 'Schedule deleted');
            } catch (error: any) {
              console.error('Error deleting schedule:', error);
              Alert.alert(
                'Error',
                `Failed to delete schedule: ${error.message}`,
              );
            }
          },
        },
      ],
    );
  };

  const getNextScheduledCleaning = () => {
    if (!schedules.length) return 'No schedule set';

    const enabled = schedules.filter((s) => s.enabled);
    if (!enabled.length) return 'No enabled schedules';

    const now = new Date();

    const nextDateForSchedule = (s: CleaningSchedule) => {
      const base = new Date(s.run_at);
      if (isNaN(base.getTime())) return null;

      if (!s.repeat_daily) {
        // one-time: only if still in the future
        return base.getTime() > now.getTime() ? base : null;
      }

      // daily: compute next occurrence based on the time in run_at
      const next = new Date(now);
      next.setHours(base.getHours(), base.getMinutes(), 0, 0);
      if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
      return next;
    };

    const candidates = enabled
      .map((s) => ({ s, next: nextDateForSchedule(s) }))
      .filter((x): x is { s: CleaningSchedule; next: Date } => !!x.next)
      .sort((a, b) => a.next.getTime() - b.next.getTime());

    if (!candidates.length) return 'No upcoming schedules';

    const best = candidates[0];
    return `${best.next.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })}${best.s.repeat_daily ? ' (daily)' : ''}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'cleaning':
        return '#4CAF50';
      case 'idle':
        return '#2196F3';
      case 'maintenance':
        return '#FF9800';
      case 'error':
        return '#f44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'cleaning':
        return 'Cleaning In Progress';
      case 'idle':
        return 'Ready';
      case 'maintenance':
        return 'Maintenance Required';
      case 'error':
        return 'Error - Check System';
      default:
        return 'Unknown';
    }
  };

  const handleStartCleaning = async () => {
    if (cleaningData.status === 'cleaning') {
      Alert.alert(
        'Already Cleaning',
        'The water cleaner is currently running.',
      );
      return;
    }

    Alert.alert(
      'Start Cleaning Cycle',
      'Start a water cleaning cycle now? This will run for 30 minutes.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            try {
              const cleanerRef = ref(database, '/devices/cleaner');
              await update(cleanerRef, {
                status: 'cleaning',
                last_updated: new Date().toISOString(),
                cleaning_started: new Date().toISOString(),
              });

              await logCleaningAction(
                'start_cleaning',
                'Manual cleaning cycle started',
              );
              Alert.alert('Success', 'Water cleaning cycle started.');
            } catch (error: any) {
              Alert.alert(
                'Error',
                'Failed to start cleaning cycle: ' + error.message,
              );
            }
          },
        },
      ],
    );
  };

  const handleStopCleaning = async () => {
    Alert.alert('Stop Cleaning Cycle', 'Stop the current cleaning cycle?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: async () => {
          try {
            const cleanerRef = ref(database, '/devices/cleaner');
            await update(cleanerRef, {
              status: 'idle',
              last_updated: new Date().toISOString(),
              last_cleaned: new Date().toISOString(),
            });

            await logCleaningAction(
              'stop_cleaning',
              'Cleaning cycle stopped manually',
            );
            Alert.alert('Success', 'Cleaning cycle stopped.');
          } catch (error: any) {
            Alert.alert(
              'Error',
              'Failed to stop cleaning cycle: ' + error.message,
            );
          }
        },
      },
    ]);
  };

  // Convenience: show in list as "Next run"
  const scheduleList = useMemo(() => {
    const now = new Date();
    const nextFor = (s: CleaningSchedule) => {
      const base = new Date(s.run_at);
      if (isNaN(base.getTime())) return null;

      if (!s.repeat_daily) {
        return base;
      }

      const next = new Date(now);
      next.setHours(base.getHours(), base.getMinutes(), 0, 0);
      if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
      return next;
    };

    return [...schedules].sort((a, b) => {
      const na = nextFor(a);
      const nb = nextFor(b);
      const ta = na ? na.getTime() : Number.MAX_SAFE_INTEGER;
      const tb = nb ? nb.getTime() : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
  }, [schedules]);

  const statusText = () => {
    switch (cleaningData.status) {
      case 'cleaning':
        return 'Feeding In Progress';
      case 'maintenance':
        return 'Maintenance Required';
      case 'error':
        return 'Error - Check System';
      default:
        return 'Feeder Active';
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colorScheme === 'dark' ? '#151718' : '#F8F9FA' },
        ]}
      >
        <ActivityIndicator size="large" color="#1F5BA8" />
        <ThemedText style={styles.loadingText}>
          Loading water cleaning data...
        </ThemedText>
      </View>
    );
  }

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
          Water Cleaning System
        </ThemedText>
        <View style={styles.backButton} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Main Status Card */}
        <View
          style={[
            styles.mainCard,
            {
              backgroundColor: colorScheme === 'dark' ? '#252627' : '#FFFFFF',
            },
          ]}
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <IconSymbol
              size={100}
              color="#1F5BA8"
              imageSource={require('@/assets/images/water-cleaning.png')}
              style={styles.mainIcon}
            />
          </View>

          {/* Status */}
          <ThemedText style={styles.statusText}>{statusText()}</ThemedText>

          {/* Value */}
          <ThemedText style={styles.valueText}>
            {getNextScheduledCleaning()}
          </ThemedText>

          {/* Subtitle */}
          <ThemedText style={styles.optimalText}>
            Next Scheduled Cleaning
          </ThemedText>
        </View>

        {/* Schedule Section */}
        <View style={styles.scheduleSection}>
          <View style={styles.sectionHeader}>
            <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
              Cleaning Schedule
            </ThemedText>
            {cleaningData.is_schedule_editable && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  resetScheduleForm();
                  setShowAddSchedule(true);
                }}
              >
                <Ionicons name="add-circle" size={20} color="#4CAF50" />
                <ThemedText style={styles.addButtonText}>
                  Add Schedule
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>

          <ThemedText style={styles.sectionSubtitle}>
            Next scheduled cleaning: {getNextScheduledCleaning()}
          </ThemedText>

          {scheduleList.length === 0 ? (
            <View
              style={[
                styles.emptySchedule,
                {
                  backgroundColor:
                    colorScheme === 'dark' ? '#252627' : '#FFFFFF',
                },
              ]}
            >
              <Ionicons name="calendar-outline" size={40} color="#999" />
              <ThemedText style={styles.emptyScheduleText}>
                {cleaningData.is_schedule_editable
                  ? 'No cleaning schedules set. Add one to get started.'
                  : 'No cleaning schedules available. Schedule editing is disabled.'}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.schedulesList}>
              {scheduleList.map((schedule) => (
                <View
                  key={schedule.id}
                  style={[
                    styles.scheduleCard,
                    {
                      backgroundColor:
                        colorScheme === 'dark' ? '#252627' : '#FFFFFF',
                    },
                  ]}
                >
                  <View style={styles.scheduleHeader}>
                    <View style={styles.scheduleInfo}>
                      <ThemedText
                        type="defaultSemiBold"
                        style={styles.scheduleDay}
                      >
                        {schedule.repeat_daily
                          ? 'Daily Schedule'
                          : 'One-time Schedule'}
                      </ThemedText>
                      <ThemedText style={styles.scheduleTime}>
                        {formatDateTime(schedule.run_at)}
                        {schedule.repeat_daily ? ' (repeats daily)' : ''}
                      </ThemedText>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.scheduleToggle,
                        {
                          backgroundColor: schedule.enabled
                            ? '#4CAF5020'
                            : '#f4433620',
                        },
                      ]}
                      onPress={() =>
                        handleToggleSchedule(schedule.id, schedule.enabled)
                      }
                    >
                      <Ionicons
                        name={schedule.enabled ? 'toggle' : 'toggle-outline'}
                        size={20}
                        color={schedule.enabled ? '#4CAF50' : '#f44336'}
                      />
                      <ThemedText
                        style={[
                          styles.scheduleToggleText,
                          { color: schedule.enabled ? '#4CAF50' : '#f44336' },
                        ]}
                      >
                        {schedule.enabled ? 'ON' : 'OFF'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>

                  {cleaningData.is_schedule_editable && (
                    <View style={styles.scheduleActions}>
                      <TouchableOpacity
                        style={styles.scheduleActionButton}
                        onPress={() => {
                          setEditingScheduleId(schedule.id);

                          const dt = new Date(schedule.run_at);
                          const safe = isNaN(dt.getTime()) ? new Date() : dt;

                          setSelectedDate(safe);
                          setSelectedTime(safe);
                          setRepeatDaily(!!schedule.repeat_daily);

                          setShowAddSchedule(true);
                        }}
                      >
                        <Ionicons
                          name="create-outline"
                          size={16}
                          color="#2196F3"
                        />
                        <ThemedText style={styles.scheduleActionText}>
                          Edit
                        </ThemedText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.scheduleActionButton}
                        onPress={() => handleDeleteSchedule(schedule.id)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color="#f44336"
                        />
                        <ThemedText
                          style={[
                            styles.scheduleActionText,
                            { color: '#f44336' },
                          ]}
                        >
                          Delete
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Add/Edit Schedule Modal */}
        <Modal
          visible={showAddSchedule}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowAddSchedule(false);
            resetScheduleForm();
          }}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor:
                    colorScheme === 'dark' ? '#252627' : '#FFFFFF',
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <ThemedText type="title" style={styles.modalTitle}>
                  {editingScheduleId
                    ? 'Edit Cleaning Schedule'
                    : 'Add Cleaning Schedule'}
                </ThemedText>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => {
                    setShowAddSchedule(false);
                    resetScheduleForm();
                  }}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.formContainer}>
                {/* Date Selection */}
                <View style={styles.formGroup}>
                  <ThemedText style={styles.formLabel}>Select Date</ThemedText>
                  <TouchableOpacity
                    style={[
                      styles.timeInput,
                      {
                        backgroundColor:
                          colorScheme === 'dark' ? '#1a1a1a' : '#F5F5F5',
                      },
                    ]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#666" />
                    <ThemedText style={styles.timeInputText}>
                      {selectedDate.toLocaleDateString()}
                    </ThemedText>
                  </TouchableOpacity>
                </View>

                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="spinner"
                    onChange={(event, date) => {
                      setShowDatePicker(false);
                      if (date) setSelectedDate(date);
                    }}
                  />
                )}

                {/* Time Selection */}
                <View style={styles.formGroup}>
                  <ThemedText style={styles.formLabel}>Select Time</ThemedText>
                  <TouchableOpacity
                    style={[
                      styles.timeInput,
                      {
                        backgroundColor:
                          colorScheme === 'dark' ? '#1a1a1a' : '#F5F5F5',
                      },
                    ]}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={20} color="#666" />
                    <ThemedText style={styles.timeInputText}>
                      {formatTimeOnly(selectedTime)}
                    </ThemedText>
                  </TouchableOpacity>
                </View>

                {showTimePicker && (
                  <DateTimePicker
                    value={selectedTime}
                    mode="time"
                    display="spinner"
                    onChange={(event, date) => {
                      setShowTimePicker(false);
                      if (date) setSelectedTime(date);
                    }}
                  />
                )}

                {/* Repeat Daily */}
                <View style={styles.repeatRow}>
                  <View style={styles.repeatLabelWrap}>
                    <ThemedText style={styles.formLabel}>
                      Repeat every day
                    </ThemedText>
                    <ThemedText style={styles.repeatHint}>
                      If enabled, cleaning will run daily at the selected time.
                    </ThemedText>
                  </View>
                  <Switch
                    value={repeatDaily}
                    onValueChange={setRepeatDaily}
                    disabled={
                      !cleaningData.is_schedule_editable || addingSchedule
                    }
                  />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (!cleaningData.is_schedule_editable || addingSchedule) &&
                      styles.submitButtonDisabled,
                  ]}
                  onPress={() =>
                    editingScheduleId
                      ? handleUpdateSchedule(editingScheduleId)
                      : handleAddSchedule()
                  }
                  disabled={
                    !cleaningData.is_schedule_editable || addingSchedule
                  }
                >
                  {addingSchedule ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons
                        name={editingScheduleId ? 'save-outline' : 'add-circle'}
                        size={20}
                        color="#FFFFFF"
                      />
                      <ThemedText style={styles.submitButtonText}>
                        {editingScheduleId ? 'Update Schedule' : 'Add Schedule'}
                      </ThemedText>
                    </>
                  )}
                </TouchableOpacity>

                {!cleaningData.is_schedule_editable && (
                  <View style={styles.disabledWarning}>
                    <Ionicons name="warning" size={16} color="#FF9800" />
                    <ThemedText style={styles.disabledWarningText}>
                      Schedule editing is disabled by administrator
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <ThemedText type="defaultSemiBold" style={styles.infoTitle}>
            About the Water Cleaner
          </ThemedText>
          <ThemedText style={styles.infoText}>
            The automated water cleaning system helps maintain healthy pond
            conditions by circulating water through a filter to remove debris,
            reduce buildup, and support stable water quality. Regular cleaning
            schedules prevent waste accumulation that can cause foul odor, algae
            growth, and stress to the fish. For best results, run cleaning
            cycles consistently, monitor water clarity and filter condition, and
            clean or replace filter media when performance drops.
          </ThemedText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, opacity: 0.7 },

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
    textAlign: 'center',
    marginTop: 20,
    width: '100%',
  },

  scrollView: { flex: 1 },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingBottom: 100,
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
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: { marginBottom: 20 },
  statusContainer: { flex: 1 },
  systemName: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 18, fontWeight: '600', marginBottom: 16 },

  controlButtons: { flexDirection: 'row', justifyContent: 'center' },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    flex: 1,
  },
  controlButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  scheduleSection: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#333' },
  sectionSubtitle: { fontSize: 14, opacity: 0.7, marginBottom: 16 },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  addButtonText: { fontSize: 12, fontWeight: '600', color: '#4CAF50' },

  emptySchedule: {
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  emptyScheduleText: {
    marginTop: 12,
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },

  schedulesList: { gap: 12 },
  scheduleCard: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scheduleInfo: { flex: 1 },
  scheduleDay: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  scheduleTime: { fontSize: 14, opacity: 0.7 },

  scheduleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  scheduleToggleText: { fontSize: 12, fontWeight: '600' },

  scheduleActions: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  scheduleActionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scheduleActionText: { fontSize: 12, color: '#2196F3', fontWeight: '500' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '600' },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  formContainer: { gap: 20 },
  formGroup: { gap: 8 },
  formLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },

  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
  },
  timeInputText: { fontSize: 16, fontWeight: '500' },

  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  repeatLabelWrap: { flex: 1 },
  repeatHint: { fontSize: 12, opacity: 0.7, marginTop: 2 },

  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    marginTop: 8,
  },
  submitButtonDisabled: { backgroundColor: '#9E9E9E', opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  disabledWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
  },
  disabledWarningText: { fontSize: 12, color: '#FF9800', fontWeight: '500' },

  infoSection: { paddingHorizontal: 16, paddingVertical: 16 },
  infoTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  infoText: { fontSize: 14, lineHeight: 22, opacity: 0.8 },
  mainIcon: { width: 100, height: 100 },
  valueText: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    paddingVertical: 8,
    textAlign: 'center',
  },
  optimalText: { fontSize: 16, opacity: 0.7 },
});
