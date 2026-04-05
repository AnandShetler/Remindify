import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useReminders } from '@/hooks/useReminders';
import { isDueToday } from '@/utils/recurrence';

export default function CalendarScreen() {
  const { reminders, loadReminders } = useReminders();
  const [todayCount, setTodayCount] = useState(0);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  useEffect(() => {
    setTodayCount(reminders.filter((reminder) => isDueToday(reminder)).length);
  }, [reminders]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Calendar</Text>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Reminders due today</Text>
          <Text style={styles.summaryValue}>{todayCount}</Text>
        </View>
        <Text style={styles.description}>
          This placeholder screen will become a monthly calendar view with completed days,
          streaks, and reminder summaries.
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
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#EFF6FF',
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#2563EB',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  description: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
  },
});
