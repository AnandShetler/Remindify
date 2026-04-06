import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Reminder } from '@/utils/database';

export function ReminderCard({
  reminder,
  onToggleComplete,
  onEdit,
  onDelete,
}: {
  reminder: Reminder;
  onToggleComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.card, reminder.completedAt && styles.completedCard]}>
      <View style={styles.header}>
        <Text style={[styles.title, reminder.completedAt && styles.completedTitle]}>{reminder.title}</Text>
        <Pressable style={styles.actionButton} onPress={onToggleComplete}>
          <Text style={styles.actionText}>{reminder.completedAt ? 'Undo' : 'Done'}</Text>
        </Pressable>
      </View>
      {reminder.description ? <Text style={styles.description}>{reminder.description}</Text> : null}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{reminder.category.replace('_', ' ')}</Text>
        <Text style={styles.metaText}>• {reminder.recurrenceType}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Due {reminder.dueDate}</Text>
        <Text style={styles.metaText}>{reminder.dueTime ?? 'Any time'}</Text>
      </View>
      <View style={styles.actionRow}>
        <Pressable style={styles.secondaryButton} onPress={onEdit}>
          <Text style={styles.secondaryText}>Edit</Text>
        </Pressable>
        <Pressable style={[styles.secondaryButton, styles.secondaryButtonSpacer]} onPress={onDelete}>
          <Text style={[styles.secondaryText, styles.deleteText]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  completedCard: {
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
  },
  actionButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
  },
  description: {
    color: '#4B5563',
    marginBottom: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaText: {
    color: '#6B7280',
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  secondaryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  secondaryButtonSpacer: {
    marginLeft: 8,
  },
  secondaryText: {
    color: '#111827',
    fontWeight: '600',
  },
  deleteText: {
    color: '#DC2626',
  },
});
