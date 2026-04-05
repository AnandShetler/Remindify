export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'monthly';

export interface ReminderRecurrence {
  dueDate: string;
  dueTime?: string;
  recurrenceType: RecurrenceType;
}

export const isDueToday = (reminder: ReminderRecurrence): boolean => {
  const today = new Date();
  const due = new Date(reminder.dueDate);
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
};

export const getNextOccurrence = (reminder: ReminderRecurrence): string => {
  const due = new Date(reminder.dueDate);
  switch (reminder.recurrenceType) {
    case 'daily':
      due.setDate(due.getDate() + 1);
      break;
    case 'weekly':
      due.setDate(due.getDate() + 7);
      break;
    case 'monthly':
      due.setMonth(due.getMonth() + 1);
      break;
    case 'once':
      break;
  }
  return due.toISOString();
};
