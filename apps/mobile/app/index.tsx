import { Link } from 'expo-router';
import { Text, View } from 'react-native';

// Scaffold only: the role menus arrive with TASK-704.
export default function HomeScreen() {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <Text>BMI Stooring System</Text>
      {/* TASK-127 part A (DEC-141): the temporary spike, in a development build only. */}
      {__DEV__ && (
        <Link href="/spike" style={{ minHeight: 48, fontSize: 16, paddingVertical: 12 }}>
          Mobile spike
        </Link>
      )}
    </View>
  );
}
