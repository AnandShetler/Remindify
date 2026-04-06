import { useEffect, useState } from 'react';
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useReminders } from '@/hooks/useReminders';
import { ReminderForm, ReminderFormValues } from '@/components/ReminderForm';
import { ReminderCard } from '@/components/ReminderCard';
import { Reminder } from '@/utils/database';

export default function RemindersScreen() {
  const { reminders, initialized, loadReminders, addReminder, updateReminder, deleteReminder, toggleComplete } = useReminders();
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeReminder, setActiveReminder] = useState<Reminder | null>(null);

  useEffect(() => {
    setLoading(true);
    loadReminders().finally(() => setLoading(false));
  }, [loadReminders]);

  const closeModal = () => {
    setActiveReminder(null);
    setIsModalVisible(false);
  };

  const handleSaveReminder = async (values: ReminderFormValues) => {
    if (activeReminder) {
      await updateReminder({
        ...activeReminder,
        title: values.title,
        description: values.description,
        importance: values.importance,
        recurrenceType: values.recurrenceType,
        dueDate: values.dueDate,
        dueTime: values.dueTime,
        category: values.category,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await addReminder({
        id: `reminder-${Date.now()}`,
        title: values.title,
        description: values.description,
        importance: values.importance,
        recurrenceType: values.recurrenceType,
        dueDate: values.dueDate,
        dueTime: values.dueTime,
        category: values.category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    closeModal();
  };

  const handleEditReminder = (reminder: Reminder) => {
    setActiveReminder(reminder);
    setIsModalVisible(true);
  };

  const handleDeleteReminder = async (id: string) => {
    await deleteReminder(id);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ReminderForm
        visible={isModalVisible}
        onClose={closeModal}
        onSubmit={handleSaveReminder}
        initialValues={activeReminder ?? undefined}
      />

      <View style={styles.header}>
        <Text style={styles.title}>Reminders</Text>
        <Pressable style={styles.button} onPress={() => setIsModalVisible(true)}>
          <Text style={styles.buttonText}>New</Text>
        </Pressable>
      </View>

      {loading ? (
        <Text style={styles.message}>Loading reminders…</Text>
      ) : reminders.length === 0 ? (
        <Text style={styles.message}>No reminders yet. Tap New to create one.</Text>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ReminderCard
              reminder={item}
              onToggleComplete={() => toggleComplete(item.id)}
              onEdit={() => handleEditReminder(item)}
              onDelete={() => handleDeleteReminder(item.id)}
            />
          )}
        />
      )}
      {!initialized && <Text style={styles.message}>Initializing database…</Text>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  message: {
    marginTop: 24,
    fontSize: 16,
    color: '#4B5563',
  },
});
