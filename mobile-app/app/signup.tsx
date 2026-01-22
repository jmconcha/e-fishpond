import React from 'react';
import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, database } from '@/firebase';
import { ref, set } from 'firebase/database';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const colorScheme = useColorScheme();

  const handleSignUp = async () => {
    // Validate inputs
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Create user object in Realtime Database
      const userRef = ref(database, `/users/${uid}`);
      await set(userRef, {
        email: email,
        firstname: '',
        lastname: '',
        profile_pic: '',
        role: 'operator',
        user_status: 'pending',
      });

      Alert.alert('Success', 'Account created successfully! Awaiting admin approval.');
      router.replace('/login');
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.back();
  };

  const colors = Colors[colorScheme ?? 'light'];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackToLogin} disabled={loading}>
            <ThemedText style={[styles.backButton, { color: colors.tint }]}>← Back</ThemedText>
          </TouchableOpacity>
          <ThemedText type="title" style={styles.title}>
            Create Account
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Join e-FishPond today
          </ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <TextInput
              style={[styles.input, { borderColor: colors.tint, color: colors.text, backgroundColor: colorScheme === 'dark' ? '#262829' : '#fff' }]}
              placeholder="Enter your email"
              placeholderTextColor={colors.tabIconDefault}
              value={email}
              onChangeText={setEmail}
              editable={!loading}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Password</ThemedText>
            <TextInput
              style={[styles.input, { borderColor: colors.tint, color: colors.text, backgroundColor: colorScheme === 'dark' ? '#262829' : '#fff' }]}
              placeholder="Enter your password"
              placeholderTextColor={colors.tabIconDefault}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
              secureTextEntry
            />
            <ThemedText style={styles.hint}>
              At least 6 characters
            </ThemedText>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Confirm Password</ThemedText>
            <TextInput
              style={[styles.input, { borderColor: colors.tint, color: colors.text, backgroundColor: colorScheme === 'dark' ? '#262829' : '#fff' }]}
              placeholder="Confirm your password"
              placeholderTextColor={colors.tabIconDefault}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!loading}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.signupButton, { backgroundColor: colors.tint }]}
            onPress={handleSignUp}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={[styles.signupButtonText, { color: colorScheme === 'dark' ? '#262829' : '#fff' }]}>Create Account</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    marginBottom: 40,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  form: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  signupButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
