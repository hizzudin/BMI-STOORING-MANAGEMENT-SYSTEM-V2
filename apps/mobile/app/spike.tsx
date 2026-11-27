import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { signIn, uploadPhoto, type SpikeSession } from '../src/spike/spike-api';

/**
 * TASK-127 part A (NFR-18, DEC-141, DEC-142): a temporary screen that proves sign-in, one camera
 * photo uploaded through /files and the position, in Expo Go and in the phone browser. Shown only
 * in a development build; TASK-704 removes it.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const POSITION_TIMEOUT_MS = 20_000;

const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Try again.';

function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export default function SpikeScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<SpikeSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<string[]>([]);

  if (!__DEV__) return null;

  const note = (line: string) => setLines((all) => [...all, line]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      note(`Error: ${messageOf(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const doSignIn = () =>
    run(async () => {
      const signedIn = await signIn(fetch, API_URL, email.trim(), password);
      setSession(signedIn);
      setPassword('');
      note(`Signed in as ${signedIn.user.name} (${signedIn.user.role ?? 'no role'})`);
    });

  const takePhoto = () =>
    run(async () => {
      if (!session) throw new Error('Sign in first.');
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error('Camera permission was not given.');
      const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      const asset = shot.canceled ? null : shot.assets[0];
      if (!asset) {
        note('No photo taken.');
        return;
      }
      const uploaded = await uploadPhoto(
        fetch,
        API_URL,
        session.accessToken,
        { uri: asset.uri, contentType: asset.mimeType ?? 'image/jpeg' },
        async (uri) => (await fetch(uri)).blob(),
        newKey,
      );
      note(`Photo uploaded: file ${uploaded.id}, status ${uploaded.status}`);
    });

  const readPosition = () =>
    run(async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Location permission was not given.');
      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        POSITION_TIMEOUT_MS,
        'No position within 20 seconds. Try outside.',
      );
      const { latitude, longitude, accuracy } = position.coords;
      note(
        `Position: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${Math.round(accuracy ?? 0)} m)`,
      );
    });

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title} accessibilityRole="header">
        Mobile spike
      </Text>
      <Text style={styles.muted}>API: {API_URL}</Text>
      {!session && (
        <View style={styles.block}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            accessibilityLabel="Password"
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Action label="Sign in" disabled={busy || !email || !password} onPress={doSignIn} />
        </View>
      )}
      <View style={styles.block}>
        <Action label="Take photo" disabled={busy || !session} onPress={takePhoto} />
        <Action label="Read position" disabled={busy} onPress={readPosition} />
      </View>
      <View style={styles.block} accessibilityLiveRegion="polite">
        {lines.map((line, index) => (
          <Text key={`${index}-${line}`} style={styles.line}>
            {line}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

function Action({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#14262E' },
  muted: { color: '#4B5563' },
  block: { gap: 8 },
  label: { fontSize: 16, color: '#14262E' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  button: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: '#AD2713',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  line: { fontSize: 16, color: '#14262E' },
});
