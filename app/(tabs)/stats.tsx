import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useReminders } from '@/hooks/useReminders';

export default function StatsScreen() {
  const { reminders, loadReminders } = useReminders();
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  useEffect(() => {
    setCompletedCount(reminders.filter((item) => item.completedAt).length);
  }, [reminders]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Stats</Text>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total reminders</Text>
          <Text style={styles.statValue}>{reminders.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Completed reminders</Text>
          <Text style={styles.statValue}>{completedCount}</Text>
        </View>
        <Text style={styles.description}>
          This screen will become a progress dashboard with streaks, goal tracking, and
          reward categories.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  statCard: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#ECFDF5',
    marginBottom: 16,
  },
  statLabel: {
    color: '#047857',
    fontSize: 14,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#065F46',
  },
  description: {
    marginTop: 16,
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
  },
});
