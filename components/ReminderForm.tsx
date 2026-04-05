import { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export type ReminderFormValues = {
  title: string;
  description: string;
  importance: 'low' | 'medium' | 'high';
  recurrenceType: 'once' | 'daily' | 'weekly' | 'monthly';
  dueDate: string;
  dueTime: string;
  category: string;
};

const categories = [
  'daily_maintenance',
  'career_goals',
  'social_commitments',
  'health_fitness',
  'learning',
  'other',
];

const importanceOptions: ReminderFormValues['importance'][] = ['low', 'medium', 'high'];
const recurrenceOptions: ReminderFormValues['recurrenceType'][] = ['once', 'daily', 'weekly', 'monthly'];

export function ReminderForm({
  visible,
  onClose,
  onSubmit,
  initialValues,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: ReminderFormValues) => void;
  initialValues?: Partial<ReminderFormValues>;
}) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [importance, setImportance] = useState<ReminderFormValues['importance']>(initialValues?.importance ?? 'medium');
  const [recurrenceType, setRecurrenceType] = useState<ReminderFormValues['recurrenceType']>(initialValues?.recurrenceType ?? 'daily');
  const [dueDate, setDueDate] = useState(initialValues?.dueDate ?? new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState(initialValues?.dueTime ?? '09:00');
  const [category, setCategory] = useState(initialValues?.category ?? 'daily_maintenance');

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setImportance('medium');
    setRecurrenceType('daily');
    setDueDate(new Date().toISOString().split('T')[0]);
    setDueTime('09:00');
    setCategory('daily_maintenance');
  };

  const handleSave = () => {
    if (!title.trim()) {
      return;
    }

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      importance,
      recurrenceType,
      dueDate,
      dueTime,
      category,
    });
    handleReset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>New Reminder</Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter reminder title"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Optional description"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.optionRow}>
            {categories.map((option) => (
              <Pressable
                key={option}
                style={[styles.optionButton, category === option && styles.optionButtonActive]}
                onPress={() => setCategory(option)}
              >
                <Text style={[styles.optionLabel, category === option && styles.optionLabelActive]}>
                  {option.replace('_', ' ')}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Importance</Text>
          <View style={styles.optionRow}>
            {importanceOptions.map((option) => (
              <Pressable
                key={option}
                style={[styles.optionButton, importance === option && styles.optionButtonActive]}
                onPress={() => setImportance(option)}
              >
                <Text style={[styles.optionLabel, importance === option && styles.optionLabelActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Recurrence</Text>
          <View style={styles.optionRow}>
            {recurrenceOptions.map((option) => (
              <Pressable
                key={option}
                style={[styles.optionButton, recurrenceType === option && styles.optionButtonActive]}
                onPress={() => setRecurrenceType(option)}
              >
                <Text style={[styles.optionLabel, recurrenceType === option && styles.optionLabelActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Due Date</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            value={dueDate}
            onChangeText={setDueDate}
          />

          <Text style={styles.label}>Due Time</Text>
          <TextInput
            style={styles.input}
            placeholder="HH:MM"
            value={dueTime}
            onChangeText={setDueTime}
          />

          <Pressable style={styles.submitButton} onPress={handleSave}>
            <Text style={styles.submitButtonText}>Save Reminder</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  closeButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  optionButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  optionLabel: {
    color: '#111827',
    fontSize: 13,
  },
  optionLabelActive: {
    color: '#fff',
  },
  submitButton: {
    marginTop: 16,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 16,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
