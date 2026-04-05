# Remindifi: Full-Stack Reminder App Architecture Plan

## Overview

Build a multi-phase reminder app starting with MVP (local reminders + calendar + sorting), then add cloud sync, gamification, AI planning, and social features. Use Expo/React Native frontend with AWS serverless backend (Lambda + DynamoDB), local SQLite storage in Phase 1, LangChain for AI.

### Key Decisions
- **Scope**: Phased (MVP → Gamification → AI Planning → Social/Leaderboard)
- **Backend**: AWS Serverless (Lambda + API Gateway + DynamoDB)
- **Auth**: Social auth (Google/Apple, evolve to Cognito)
- **AI Features**: Simple LangChain task decomposition
- **Data Sync**: Local-first (SQLite), cloud sync Phase 2
- **Social**: Optional (friends-only or global, user choice)
- **Notifications**: Simple time-based (timezone handling Phase 2)
- **Subscription**: Planned post-MVP

---

## Phase 1: MVP – Local Reminders & Calendar
**Timeline**: ~4-6 weeks

### 1. Frontend Setup

**Dependencies to add**:
```
expo-sqlite           # Local database
expo-notifications    # Reminder notifications
zustand              # State management
react-hook-form      # Form validation
date-fns             # Date utilities
expo-auth-session    # OAuth (Phase 2)
```

**Routing restructure**: 
- Add tabs: `Reminders`, `Calendar`, `Stats`, `Settings`
- Keep existing tab structure, expand `(tabs)/_layout.tsx`
- New routes:
  - `app/(tabs)/reminders.tsx` – main reminders list + sorting UI
  - `app/(tabs)/calendar.tsx` – calendar grid component
  - `app/(tabs)/stats.tsx` – RPG stats display + points breakdown (Phase 3)
  - `app/(tabs)/settings.tsx` – user preferences + auth (Phase 2)

**State management** (Zustand):
```typescript
// hooks/useReminders.ts
interface Reminder {
  id: string;
  title: string;
  description: string;
  importance: 'low' | 'medium' | 'high';
  recurrenceType: 'once' | 'daily' | 'weekly' | 'monthly';
  recurrenceInterval?: number;
  dueDate: Date;
  dueTime?: string; // HH:MM format
  category: string; // 'daily_maintenance', 'career_goals', 'social_commitments', etc.
  completedAt?: Date;
  createdAt: Date;
}

interface ReminderStore {
  reminders: Reminder[];
  addReminder: (reminder: Reminder) => void;
  updateReminder: (id: string, updates: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
  completeReminder: (id: string) => void;
  getRemindersForDate: (date: Date) => Reminder[];
  getSortedReminders: (sortBy: 'importance' | 'recurrence' | 'category') => Reminder[];
  syncWithBackend: () => Promise<void>; // Phase 2
}
```

### 2. Local Database (SQLite)

**Schema**:
```sql
-- Reminders table
CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  importance TEXT CHECK(importance IN ('low', 'medium', 'high')),
  recurrence_type TEXT CHECK(recurrence_type IN ('once', 'daily', 'weekly', 'monthly')),
  recurrence_interval INTEGER,
  due_date TEXT NOT NULL, -- ISO 8601
  due_time TEXT, -- HH:MM
  category TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  sync_pending BOOLEAN DEFAULT 0
);

-- Completed dates (for streak tracking)
CREATE TABLE completed_dates (
  reminder_id TEXT NOT NULL,
  date TEXT NOT NULL, -- ISO 8601 date only
  points INTEGER DEFAULT 0,
  PRIMARY KEY (reminder_id, date),
  FOREIGN KEY (reminder_id) REFERENCES reminders(id)
);

-- Sync queue (for Phase 2)
CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  action TEXT CHECK(action IN ('create', 'update', 'delete')),
  reminder_id TEXT,
  reminder_data JSON,
  created_at TEXT NOT NULL,
  synced_at TEXT
);
```

**Database initialization**:
```typescript
// utils/database.ts
import SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('remindifi.db');

export const initializeDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          importance TEXT,
          recurrence_type TEXT,
          recurrence_interval INTEGER,
          due_date TEXT NOT NULL,
          due_time TEXT,
          category TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT,
          sync_pending BOOLEAN DEFAULT 0
        );`
      );
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS completed_dates (
          reminder_id TEXT NOT NULL,
          date TEXT NOT NULL,
          points INTEGER DEFAULT 0,
          PRIMARY KEY (reminder_id, date),
          FOREIGN KEY (reminder_id) REFERENCES reminders(id)
        );`
      );
    }, reject, resolve);
  });
};

export const addReminder = async (reminder: Reminder) => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO reminders 
        (id, title, description, importance, recurrence_type, recurrence_interval, 
         due_date, due_time, category, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [reminder.id, reminder.title, reminder.description, reminder.importance, 
         reminder.recurrenceType, reminder.recurrenceInterval || null, 
         reminder.dueDate.toISOString(), reminder.dueTime || null, 
         reminder.category, new Date().toISOString(), new Date().toISOString()],
        (_, result) => resolve(result),
        (_, error) => reject(error)
      );
    });
  });
};

export const getReminders = async (): Promise<Reminder[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM reminders ORDER BY due_date ASC`,
        [],
        (_, { rows: { _array } }) => resolve(_array.map(row => ({
          id: row.id,
          title: row.title,
          description: row.description,
          importance: row.importance,
          recurrenceType: row.recurrence_type,
          recurrenceInterval: row.recurrence_interval,
          dueDate: new Date(row.due_date),
          dueTime: row.due_time,
          category: row.category,
          completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
          createdAt: new Date(row.created_at)
        } as Reminder))),
        (_, error) => reject(error)
      );
    });
  });
};

export const completeReminder = async (reminderId: string, date: Date) => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Record in completed_dates
      tx.executeSql(
        `INSERT OR REPLACE INTO completed_dates (reminder_id, date) 
         VALUES (?, ?)`,
        [reminderId, date.toISOString().split('T')[0]],
        () => {}, 
        (_, error) => reject(error)
      );
    }, reject, resolve);
  });
};
```

### 3. Reminder Features

**Recurrence Logic**:
```typescript
// utils/recurrence.ts
import { addDays, addWeeks, addMonths, format } from 'date-fns';

export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'monthly';

export interface RecurrenceRule {
  type: RecurrenceType;
  interval?: number; // For custom intervals (e.g., every 2 weeks)
}

export const generateNextOccurrences = (
  startDate: Date,
  rule: RecurrenceRule,
  count: number = 30
): Date[] => {
  const occurrences: Date[] = [];
  let current = new Date(startDate);

  for (let i = 0; i < count; i++) {
    occurrences.push(new Date(current));
    
    switch (rule.type) {
      case 'daily':
        current = addDays(current, rule.interval || 1);
        break;
      case 'weekly':
        current = addWeeks(current, rule.interval || 1);
        break;
      case 'monthly':
        current = addMonths(current, rule.interval || 1);
        break;
      case 'once':
        break; // Only one occurrence
    }
  }

  return occurrences;
};

export const isReminderDueToday = (reminder: Reminder): boolean => {
  const today = new Date();
  const reminderDate = new Date(reminder.dueDate);
  return (
    reminderDate.getFullYear() === today.getFullYear() &&
    reminderDate.getMonth() === today.getMonth() &&
    reminderDate.getDate() === today.getDate()
  );
};

export const getUpcominReminders = (reminders: Reminder[], days: number = 7): Reminder[] => {
  const today = new Date();
  const futureDate = addDays(today, days);
  
  return reminders.filter(r => {
    const dueDate = new Date(r.dueDate);
    return dueDate >= today && dueDate <= futureDate;
  });
};
```

**Sorting Logic** (in Zustand store):
```typescript
export const getSortedReminders = (reminders: Reminder[], sortBy: 'importance' | 'recurrence' | 'category'): Reminder[] => {
  const sorted = [...reminders];
  
  switch (sortBy) {
    case 'importance':
      const importanceOrder = { high: 0, medium: 1, low: 2 };
      return sorted.sort((a, b) => 
        importanceOrder[a.importance] - importanceOrder[b.importance]
      );
    
    case 'recurrence':
      const recurrenceOrder = { monthly: 0, weekly: 1, daily: 2, once: 3 };
      return sorted.sort((a, b) => 
        recurrenceOrder[a.recurrenceType] - recurrenceOrder[b.recurrenceType]
      );
    
    case 'category':
      return sorted.sort((a, b) => a.category.localeCompare(b.category));
    
    default:
      return sorted.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }
};
```

**Calendar View Component**:
```typescript
// components/CalendarGrid.tsx
import React, { useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';

interface CalendarGridProps {
  date: Date;
  reminders: Reminder[];
  completedDates: Map<string, number>; // date string -> completion count
  onDatePress: (date: Date) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({ 
  date, 
  reminders, 
  completedDates,
  onDatePress 
}) => {
  const daysInMonth = useMemo(() => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    return eachDayOfInterval({ start, end });
  }, [date]);

  const getDayReminders = (dayDate: Date) => {
    const dateString = format(dayDate, 'yyyy-MM-dd');
    return reminders.filter(r => format(new Date(r.dueDate), 'yyyy-MM-dd') === dateString);
  };

  const getCompletionStatus = (dayDate: Date) => {
    const dateString = format(dayDate, 'yyyy-MM-dd');
    const allReminders = getDayReminders(dayDate);
    const completedCount = completedDates.get(dateString) || 0;
    return { completed: completedCount, total: allReminders.length };
  };

  return (
    <View style={styles.container}>
      <View style={styles.weekHeader}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <Text key={day} style={styles.dayHeader}>{day}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {daysInMonth.map(day => {
          const { completed, total } = getCompletionStatus(day);
          const isCurrentMonth = day.getMonth() === date.getMonth();
          
          return (
            <DayCell
              key={format(day, 'yyyy-MM-dd')}
              day={day}
              completed={completed}
              total={total}
              isCurrentMonth={isCurrentMonth}
              onPress={() => onDatePress(day)}
            />
          );
        })}
      </View>
    </View>
  );
};

interface DayCellProps {
  day: Date;
  completed: number;
  total: number;
  isCurrentMonth: boolean;
  onPress: () => void;
}

const DayCell: React.FC<DayCellProps> = ({ day, completed, total, isCurrentMonth, onPress }) => {
  const completionRate = total > 0 ? completed / total : 0;
  const backgroundColor = 
    completionRate === 1 ? '#4CAF50' : 
    completionRate > 0 ? '#FFC107' : 
    total > 0 ? '#F44336' : 
    '#E0E0E0';

  return (
    <Pressable 
      style={[
        styles.dayCell, 
        { backgroundColor: isCurrentMonth ? backgroundColor : '#F5F5F5' }
      ]}
      onPress={onPress}
    >
      <Text style={styles.dayText}>{format(day, 'd')}</Text>
      {total > 0 && (
        <Text style={styles.countText}>{completed}/{total}</Text>
      )}
    </Pressable>
  );
};
```

**Streak Calculation**:
```typescript
// utils/streaks.ts
export const calculateCurrentStreak = (completedDates: Date[]): number => {
  if (completedDates.length === 0) return 0;

  const sorted = completedDates.sort((a, b) => b.getTime() - a.getTime());
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (const date of sorted) {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    if (checkDate.getTime() === currentDate.getTime()) {
      streak++;
      currentDate = addDays(currentDate, -1);
    } else {
      break;
    }
  }

  return streak;
};

export const calculateLongestStreak = (completedDates: Date[]): number => {
  if (completedDates.length === 0) return 0;

  const sorted = completedDates.sort((a, b) => a.getTime() - b.getTime());
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = new Date(sorted[i - 1]);
    const currentDate = new Date(sorted[i]);
    
    prevDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);

    if (currentDate.getTime() - prevDate.getTime() === 86400000) { // 1 day in ms
      currentStreak++;
    } else {
      maxStreak = Math.max(maxStreak, currentStreak);
      currentStreak = 1;
    }
  }

  return Math.max(maxStreak, currentStreak);
};
```

**Notifications Setup** (Phase 1):
```typescript
// utils/notifications.ts
import * as Notifications from 'expo-notifications';
import { addDays } from 'date-fns';

export const setupNotificationHandler = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
};

export const scheduleReminderNotification = async (
  reminder: Reminder,
  nextDueDate: Date
) => {
  const [hours, minutes] = (reminder.dueTime || '09:00').split(':').map(Number);
  const notificationDate = new Date(nextDueDate);
  notificationDate.setHours(hours, minutes, 0, 0);

  if (notificationDate <= new Date()) {
    // Schedule for next occurrence
    notificationDate.setDate(notificationDate.getDate() + 1);
  }

  const secondsUntilNotification = Math.floor(
    (notificationDate.getTime() - Date.now()) / 1000
  );

  if (secondsUntilNotification > 0) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Reminder: ' + reminder.title,
        body: reminder.description || 'Time to complete this reminder',
        data: { reminderId: reminder.id },
        badge: 1,
      },
      trigger: { seconds: secondsUntilNotification },
    });
  }
};

export const scheduleAllReminders = async (reminders: Reminder[]) => {
  for (const reminder of reminders) {
    await scheduleReminderNotification(reminder, reminder.dueDate);
  }
};

export const handleNotificationResponse = (
  response: Notifications.NotificationResponse,
  onReminderTap: (reminderId: string) => void
) => {
  const reminderId = response.notification.request.content.data.reminderId;
  onReminderTap(reminderId);
};
```

### 4. UI Components

**ReminderForm Component** (create/edit):
```typescript
// components/ReminderForm.tsx
import React, { useState } from 'react';
import { View, Modal, Pressable, Text, TextInput } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

interface ReminderFormProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reminder: Reminder) => void;
  initialValues?: Partial<Reminder>;
}

export const ReminderForm: React.FC<ReminderFormProps> = ({
  visible,
  onClose,
  onSubmit,
  initialValues,
}) => {
  const { control, handleSubmit, reset } = useForm<Reminder>({
    defaultValues: {
      title: '',
      description: '',
      importance: 'medium',
      recurrenceType: 'daily',
      category: 'daily_maintenance',
      dueDate: new Date(),
      dueTime: '09:00',
      ...initialValues,
    },
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const onSubmitForm = (data: Reminder) => {
    onSubmit({ ...data, id: initialValues?.id || generateId() });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text>Close</Text>
        </Pressable>

        <Controller
          control={control}
          name="title"
          render={({ field: { value, onChange } }) => (
            <TextInput
              placeholder="Reminder title"
              value={value}
              onChangeText={onChange}
              style={styles.input}
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field: { value, onChange } }) => (
            <TextInput
              placeholder="Description (optional)"
              value={value}
              onChangeText={onChange}
              style={styles.input}
              multiline
            />
          )}
        />

        <Controller
          control={control}
          name="importance"
          render={({ field: { value, onChange } }) => (
            <Picker selectedValue={value} onValueChange={onChange}>
              <Picker.Item label="Low" value="low" />
              <Picker.Item label="Medium" value="medium" />
              <Picker.Item label="High" value="high" />
            </Picker>
          )}
        />

        <Controller
          control={control}
          name="category"
          render={({ field: { value, onChange } }) => (
            <Picker selectedValue={value} onValueChange={onChange}>
              <Picker.Item label="Daily Maintenance" value="daily_maintenance" />
              <Picker.Item label="Career Goals" value="career_goals" />
              <Picker.Item label="Social Commitments" value="social_commitments" />
              <Picker.Item label="Health & Fitness" value="health_fitness" />
              <Picker.Item label="Learning" value="learning" />
              <Picker.Item label="Other" value="other" />
            </Picker>
          )}
        />

        <Controller
          control={control}
          name="recurrenceType"
          render={({ field: { value, onChange } }) => (
            <Picker selectedValue={value} onValueChange={onChange}>
              <Picker.Item label="Once" value="once" />
              <Picker.Item label="Daily" value="daily" />
              <Picker.Item label="Weekly" value="weekly" />
              <Picker.Item label="Monthly" value="monthly" />
            </Picker>
          )}
        />

        {/* Date & Time Pickers */}
        <Pressable 
          onPress={() => setShowDatePicker(true)}
          style={styles.dateButton}
        >
          <Text>Select Date</Text>
        </Pressable>

        <Pressable 
          onPress={() => setShowTimePicker(true)}
          style={styles.dateButton}
        >
          <Text>Select Time</Text>
        </Pressable>

        <Pressable 
          onPress={handleSubmit(onSubmitForm)}
          style={styles.submitButton}
        >
          <Text style={styles.submitText}>Save Reminder</Text>
        </Pressable>
      </View>
    </Modal>
  );
};
```

**ReminderCard Component**:
```typescript
// components/ReminderCard.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ReminderCardProps {
  reminder: Reminder;
  isCompleted: boolean;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder,
  isCompleted,
  onComplete,
  onEdit,
  onDelete,
}) => {
  const importanceColors = {
    high: '#F44336',
    medium: '#FFC107',
    low: '#4CAF50',
  };

  return (
    <View style={[styles.card, isCompleted && styles.completed]}>
      <View style={styles.header}>
        <Pressable 
          onPress={onComplete}
          style={[styles.checkbox, isCompleted && styles.checkboxChecked]}
        >
          {isCompleted && (
            <MaterialIcons name="check" size={20} color="white" />
          )}
        </Pressable>

        <View style={styles.titleSection}>
          <Text 
            style={[
              styles.title, 
              isCompleted && styles.titleStrikethrough
            ]}
          >
            {reminder.title}
          </Text>
          {reminder.description && (
            <Text style={styles.description}>{reminder.description}</Text>
          )}
        </View>

        <View
          style={[
            styles.importanceBadge,
            { backgroundColor: importanceColors[reminder.importance] },
          ]}
        >
          <Text style={styles.importanceText}>
            {reminder.importance.charAt(0).toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.category}>{reminder.category}</Text>
        <Text style={styles.recurrence}>{reminder.recurrenceType}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onEdit} style={styles.actionButton}>
          <MaterialIcons name="edit" size={18} color="#2196F3" />
        </Pressable>
        <Pressable onPress={onDelete} style={styles.actionButton}>
          <MaterialIcons name="delete" size={18} color="#F44336" />
        </Pressable>
      </View>
    </View>
  );
};
```

### 5. Testing (Phase 1)

**Unit Tests**:
- Recurrence logic: verify daily/weekly/monthly generation
- Streak calculation: test consecutive and non-consecutive dates
- Sorting logic: verify all sort orders work correctly

Example test:
```typescript
// __tests__/recurrence.test.ts
import { generateNextOccurrences } from '../utils/recurrence';

describe('Recurrence Logic', () => {
  it('should generate daily occurrences', () => {
    const start = new Date('2026-04-05');
    const occurrences = generateNextOccurrences(start, { type: 'daily' }, 3);
    
    expect(occurrences).toHaveLength(3);
    expect(occurrences[0]).toEqual(new Date('2026-04-05'));
    expect(occurrences[1]).toEqual(new Date('2026-04-06'));
    expect(occurrences[2]).toEqual(new Date('2026-04-07'));
  });

  it('should generate weekly occurrences', () => {
    const start = new Date('2026-04-05');
    const occurrences = generateNextOccurrences(start, { type: 'weekly' }, 2);
    
    expect(occurrences).toHaveLength(2);
    expect(occurrences[1].getTime() - occurrences[0].getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
```

**Manual Testing Checklist**:
- [ ] Create reminder with daily recurrence → notification fires at set time ✓
- [ ] Complete reminder → streak counter increments ✓
- [ ] View calendar → dates with reminders highlighted ✓
- [ ] Sort reminders by importance/type → order changes ✓
- [ ] App restart → SQLite data persists ✓
- [ ] Repeat reminders → next occurrence auto-scheduled ✓

---

## Phase 2: Cloud Backend & Sync
**Timeline**: 3-4 weeks

### 6. AWS Setup

**Lambda + API Gateway Structure**:
```
backend/
├── src/
│   ├── handlers/
│   │   ├── reminders.ts           # CRUD endpoints
│   │   ├── stats.ts               # Stats & streaks
│   │   ├── auth.ts                # Token validation
│   │   └── ai.ts                  # AI goal decomposition (Phase 5)
│   ├── infrastructure/
│   │   ├── dynamodb-schema.ts      # Table definitions
│   │   ├── api-gateway-routes.ts   # Routing config
│   │   └── cognito-setup.ts        # Auth config
│   ├── utils/
│   │   ├── cognito-validator.ts    # JWT validation
│   │   ├── dynamodb-client.ts      # DynamoDB helpers
│   │   └── langchain-integration.ts # LangChain setup (Phase 5)
│   └── scheduled-tasks/
│       └── leaderboard-update.ts  # Daily ranking update (Phase 4)
├── package.json
├── tsconfig.json
└── serverless.yml                 # Serverless framework config
```

**DynamoDB Tables**:

1. **reminders**
   - PK: `userId` (string)
   - SK: `reminderId` (string)
   - Attributes: title, description, importance, recurrence_type, recurrence_interval, due_date, due_time, category, created_at, updated_at, completed_at, sync_pending
   - GSI: `createdAt-index` (PK: `userId`, SK: `createdAt`)

2. **users**
   - PK: `userId` (string)
   - Attributes: email, name, avatar_url, created_at, last_login, preferences (time_zone, notifications_enabled, etc.)

3. **completions**
   - PK: `userId` (string)
   - SK: `reminderId#date` (string)
   - Attributes: points, completed_at

4. **user_stats** (Phase 3)
   - PK: `userId` (string)
   - Attributes: strength, dexterity, charisma, intelligence, constitution, wisdom, total_points

5. **friendships** (Phase 4)
   - PK: `userId` (string)
   - SK: `friendUserId` (string)
   - Attributes: status (pending/accepted), created_at

6. **leaderboard** (Phase 4)
   - PK: `leaderboardType` (string, e.g., "friends" or "global")
   - SK: `userId#totalPoints` (string)
   - Attributes: total_points, updated_at

**API Endpoints** (REST):

```
POST   /reminders                    # Create reminder
GET    /reminders?userId=X           # List reminders (with filters)
PUT    /reminders/{id}               # Update reminder
DELETE /reminders/{id}               # Delete reminder
POST   /reminders/{id}/complete      # Mark complete + award points (Phase 3)

GET    /users/{userId}/stats         # Get yearly stats (Phase 3)
GET    /users/{userId}/streaks       # Get current & longest streak
GET    /leaderboard/{type}           # Get leaderboard (Phase 4)

POST   /friends/request              # Send friend request (Phase 4)
PUT    /friends/{id}/accept          # Accept friend request (Phase 4)
GET    /users/{userId}/friends       # List friends (Phase 4)

POST   /ai/decompose-goal            # AI task decomposition (Phase 5)
```

**Example Lambda Handler** (Create Reminder):
```typescript
// src/handlers/reminders.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { validateToken } from '../utils/cognito-validator';

const dynamodb = new DynamoDBClient({ region: 'us-east-1' });

export const createReminder: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = await validateToken(event.headers['Authorization']);
    const body = JSON.parse(event.body || '{}');

    const reminder = {
      reminderId: `reminder-${Date.now()}`,
      userId,
      title: body.title,
      description: body.description,
      importance: body.importance,
      recurrenceType: body.recurrenceType,
      dueDate: body.dueDate,
      dueTime: body.dueTime,
      category: body.category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dynamodb.send(new PutCommand({
      TableName: 'reminders',
      Item: reminder,
    }));

    return {
      statusCode: 201,
      body: JSON.stringify({ success: true, reminder }),
    };
  } catch (error) {
    console.error('Error creating reminder:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create reminder' }),
    };
  }
};
```

### 7. Social Auth (Google/Apple + Cognito)

**Frontend OAuth Setup**:
```typescript
// hooks/useAuth.ts
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

export const useAuth = () => {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ sub: string; email: string; name: string } | null>(null);

  const discovery = AuthSession.useAutoDiscovery('https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXX');

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      if (!discovery?.authorizationEndpoint) {
        throw new Error('Discovery not ready');
      }

      const result = await AuthSession.startAsync({
        discoveryUrl: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_XXXXXXX/.well-known/openid-configuration',
        clientId: 'YOUR_COGNITO_CLIENT_ID',
        redirectUrl: AuthSession.getRedirectUrl(),
        scopes: ['openid', 'profile', 'email'],
        responseType: 'code',
      });

      if (result.type === 'success') {
        const { code } = result.params;
        
        // Exchange code for tokens via Lambda endpoint
        const tokenResponse = await fetch('https://your-api.execute-api.us-east-1.amazonaws.com/auth/token', {
          method: 'POST',
          body: JSON.stringify({ code, redirectUri: AuthSession.getRedirectUrl() }),
        });

        const authTokens = await tokenResponse.json();
        await SecureStore.setItemAsync('accessToken', authTokens.access_token);
        await SecureStore.setItemAsync('refreshToken', authTokens.refresh_token);

        setTokens(authTokens);
        // Decode JWT to get user info
        const userInfo = parseJwt(authTokens.id_token);
        setUser(userInfo);
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    setTokens(null);
    setUser(null);
  };

  const restoreToken = async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) {
        setTokens({ accessToken: token, refreshToken: '', idToken: '', expiresIn: 0 });
      }
    } catch (e) {
      console.error('Restore token error:', e);
    }
  };

  useEffect(() => {
    restoreToken();
  }, []);

  return { signInWithGoogle, signOut, tokens, user, loading };
};

const parseJwt = (token: string) => {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
};
```

### 8. Cloud Sync Mechanism

**Sync Strategy**:
```typescript
// hooks/useSyncManager.ts
import { useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getSyncQueue, markSynced } from '../utils/database';

export const useSyncManager = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const syncTimeoutRef = useRef<NodeJS.Timeout>();

  const syncReminders = async (userId: string, accessToken: string) => {
    setIsSyncing(true);
    setSyncStatus('syncing');

    try {
      const queue = await getSyncQueue();

      for (const item of queue) {
        const endpoint = item.action === 'create' 
          ? '/reminders'
          : item.action === 'update'
          ? `/reminders/${item.reminder_id}`
          : `/reminders/${item.reminder_id}`;

        const method = item.action === 'create' ? 'POST' : item.action === 'update' ? 'PUT' : 'DELETE';

        const response = await fetch(`https://your-api.execute-api.us-east-1.amazonaws.com${endpoint}`, {
          method,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: method === 'DELETE' ? undefined : JSON.stringify(item.reminder_data),
        });

        if (response.ok) {
          await markSynced(item.id);
        } else {
          throw new Error(`Sync failed for item ${item.id}`);
        }
      }

      setSyncStatus('idle');
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('error');
      // Retry after 5 minutes
      syncTimeoutRef.current = setTimeout(() => {
        syncReminders(userId, accessToken);
      }, 5 * 60 * 1000);
    } finally {
      setIsSyncing(false);
    }
  };

  const setupAutoSync = (userId: string, accessToken: string) => {
    // Sync when app comes to foreground
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && !isSyncing) {
        syncReminders(userId, accessToken);
      }
    });

    return unsubscribe;
  };

  return { syncReminders, setupAutoSync, isSyncing, syncStatus };
};
```

---

## Phase 3: Gamification (Points & RPG Stats)
**Timeline**: 2-3 weeks

### 9. Gamification Schema & Rules

**Point System**:
```typescript
// constants/GameRules.ts
export const POINT_SYSTEM = {
  daily_maintenance: { points: 10, stats: { dexterity: 1 } },
  career_goals: { points: 20, stats: { intelligence: 2 } },
  social_commitments: { points: 15, stats: { charisma: 1 } },
  health_fitness: { points: 15, stats: { constitution: 1, strength: 1 } },
  learning: { points: 20, stats: { wisdom: 2 } },
  other: { points: 5, stats: { dexterity: 0.5 } },
};

export const IMPORTANCE_MULTIPLIER = {
  low: 1,
  medium: 1.5,
  high: 2,
};

export const calculateReward = (category: string, importance: string) => {
  const base = POINT_SYSTEM[category] || POINT_SYSTEM.other;
  const multiplier = IMPORTANCE_MULTIPLIER[importance] || 1;
  
  return {
    points: Math.floor(base.points * multiplier),
    stats: Object.entries(base.stats).reduce((acc, [stat, value]) => {
      acc[stat] = Math.floor(value * multiplier);
      return acc;
    }, {}),
  };
};
```

**Backend Endpoint** (Complete Reminder):
```typescript
// src/handlers/reminders.ts (completeReminder function)
export const completeReminder: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = await validateToken(event.headers['Authorization']);
    const reminderId = event.pathParameters?.id;

    // Get reminder details
    const reminder = await dynamodb.send(new GetCommand({
      TableName: 'reminders',
      Key: { userId, reminderId },
    }));

    if (!reminder.Item) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Reminder not found' }) };
    }

    // Calculate reward
    const { points, stats } = calculateReward(
      reminder.Item.category,
      reminder.Item.importance
    );

    // Record completion
    await dynamodb.send(new PutCommand({
      TableName: 'completions',
      Item: {
        userId,
        dateKey: `${reminderId}#${new Date().toISOString().split('T')[0]}`,
        points,
        completedAt: new Date().toISOString(),
      },
    }));

    // Update user stats
    const currentStats = await dynamodb.send(new GetCommand({
      TableName: 'user_stats',
      Key: { userId },
    }));

    const updatedStats = currentStats.Item || {
      userId,
      strength: 0,
      dexterity: 0,
      charisma: 0,
      intelligence: 0,
      constitution: 0,
      wisdom: 0,
      totalPoints: 0,
    };

    Object.entries(stats).forEach(([stat, value]) => {
      updatedStats[stat] = (updatedStats[stat] || 0) + value;
    });
    updatedStats.totalPoints += points;

    await dynamodb.send(new UpdateCommand({
      TableName: 'user_stats',
      Key: { userId },
      UpdateExpression: 'SET #stats = :stats',
      ExpressionAttributeNames: { '#stats': 'stats' },
      ExpressionAttributeValues: { ':stats': updatedStats },
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        reward: { points, stats },
        updatedStats,
      }),
    };
  } catch (error) {
    console.error('Error completing reminder:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to complete reminder' }) };
  }
};
```

### 10. Frontend Gamification UI

**Stats Tab**:
```typescript
// app/(tabs)/stats.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useAuth } from '../../hooks/useAuth';

interface UserStats {
  strength: number;
  dexterity: number;
  charisma: number;
  intelligence: number;
  constitution: number;
  wisdom: number;
  totalPoints: number;
}

export default function StatsScreen() {
  const { user, tokens } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && tokens) {
      fetchStats();
    }
  }, [user, tokens]);

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `https://your-api.execute-api.us-east-1.amazonaws.com/users/${user?.sub}/stats`,
        {
          headers: {
            'Authorization': `Bearer ${tokens?.accessToken}`,
          },
        }
      );
      const data = await response.json();
      setStats(data);
    } finally {
      setLoading(false);
    }
  };

  if (!stats) return <Text>Loading...</Text>;

  const statKeys = ['strength', 'dexterity', 'charisma', 'intelligence', 'constitution', 'wisdom'] as const;
  const maxStat = Math.max(...statKeys.map(key => stats[key]));

  return (
    <ScrollView style={styles.container}>
      <View style={styles.totalPointsCard}>
        <Text style={styles.totalPointsLabel}>Total Points</Text>
        <Text style={styles.totalPointsValue}>{stats.totalPoints}</Text>
      </View>

      <View style={styles.statsGrid}>
        {statKeys.map(stat => (
          <StatBar
            key={stat}
            label={stat.charAt(0).toUpperCase() + stat.slice(1)}
            value={stats[stat]}
            maxValue={maxStat}
          />
        ))}
      </View>
    </ScrollView>
  );
}

interface StatBarProps {
  label: string;
  value: number;
  maxValue: number;
}

const StatBar: React.FC<StatBarProps> = ({ label, value, maxValue }) => {
  const percentage = (value / maxValue) * 100;

  return (
    <View style={styles.statBarContainer}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.barBackground}>
        <View 
          style={[
            styles.barFill,
            { width: `${percentage}%` }
          ]}
        />
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
};
```

---

## Phase 4: Social & Leaderboard
**Timeline**: 2-3 weeks

### 11. Friends & Leaderboard Schema

**Backend Endpoints** (Phase 4):

```typescript
// src/handlers/friends.ts
export const sendFriendRequest: APIGatewayProxyHandler = async (event) => {
  // Implementation for sending friend requests
  // Store in friendships table with status: 'pending'
};

export const acceptFriendRequest: APIGatewayProxyHandler = async (event) => {
  // Implementation for accepting friend requests
  // Update friendships status to 'accepted'
};

export const getLeaderboard: APIGatewayProxyHandler = async (event) => {
  const { type } = event.pathParameters; // 'friends' or 'global'
  const userId = await validateToken(event.headers['Authorization']);

  const leaderboardTable = type === 'friends' ? 'leaderboard_friends' : 'leaderboard_global';

  const response = await dynamodb.send(new ScanCommand({
    TableName: leaderboardTable,
    Limit: 100,
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ leaderboard: response.Items }),
  };
};
```

**Scheduled Task** (Daily Leaderboard Update):
```typescript
// src/scheduled-tasks/leaderboard-update.ts
export const updateLeaderboard = async () => {
  const allUsers = await dynamodb.send(new ScanCommand({
    TableName: 'user_stats',
  }));

  // Clear and rebuild leaderboard
  const globalLeaderboard = allUsers.Items
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 1000); // Top 1000

  for (const entry of globalLeaderboard) {
    await dynamodb.send(new PutCommand({
      TableName: 'leaderboard_global',
      Item: {
        userId: entry.userId,
        totalPoints: entry.totalPoints,
        rank: globalLeaderboard.indexOf(entry) + 1,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  // Repeat for friends leaderboards...
};

// EventBridge scheduled this Lambda daily at 12 AM UTC
// In serverless.yml:
// functions:
//   updateLeaderboard:
//     handler: src/scheduled-tasks/leaderboard-update.updateLeaderboard
//     events:
//       - schedule:
//           rate: cron(0 0 * * ? *)
//           enabled: true
```

### 12. Frontend Leaderboard UI

**Leaderboard Screen**:
```typescript
// app/(tabs)/friends.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useAuth } from '../../hooks/useAuth';

interface LeaderboardEntry {
  userId: string;
  totalPoints: number;
  rank: number;
  name: string;
}

export default function FriendsScreen() {
  const { user, tokens } = useAuth();
  const [leaderboardType, setLeaderboardType] = useState<'friends' | 'global'>('friends');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [leaderboardType]);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(
        `https://your-api.execute-api.us-east-1.amazonaws.com/leaderboard/${leaderboardType}`,
        {
          headers: {
            'Authorization': `Bearer ${tokens?.accessToken}`,
          },
        }
      );
      const data = await response.json();
      setLeaderboard(data.leaderboard);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.toggleButtons}>
        <Pressable 
          style={[styles.toggleBtn, leaderboardType === 'friends' && styles.toggleActive]}
          onPress={() => setLeaderboardType('friends')}
        >
          <Text>Friends</Text>
        </Pressable>
        <Pressable 
          style={[styles.toggleBtn, leaderboardType === 'global' && styles.toggleActive]}
          onPress={() => setLeaderboardType('global')}
        >
          <Text>Global</Text>
        </Pressable>
      </View>

      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.userId}
        renderItem={({ item, index }) => (
          <LeaderboardRow entry={item} rank={index + 1} />
        )}
      />
    </View>
  );
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  rank: number;
}

const LeaderboardRow: React.FC<LeaderboardRowProps> = ({ entry, rank }) => {
  const medalEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';

  return (
    <View style={styles.leaderboardRow}>
      <Text style={styles.rank}>{medalEmoji || rank}</Text>
      <Text style={styles.name}>{entry.name}</Text>
      <Text style={styles.points}>{entry.totalPoints} pts</Text>
    </View>
  );
};
```

---

## Phase 5: AI-Powered Planning (LangChain)
**Timeline**: 2-3 weeks

### 13. LangChain Backend Integration

**Goal Decomposition Lambda**:
```typescript
// src/handlers/ai.ts
import { LLMChain, PromptTemplate } from 'langchain';
import { OpenAI } from '@langchain/openai';
import { APIGatewayProxyHandler } from 'aws-lambda';

const llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
  modelName: 'gpt-4',
});

const prompt = new PromptTemplate({
  template: `Break down the following goal into achievable reminders/subtasks.
Goal: {goal}
Timeframe: {timeframe}
User preferences: {preferences}

Return a JSON array of objects with structure:
[
  {{
    "title": "subtask title",
    "description": "brief description",
    "dueDate": "YYYY-MM-DD",
    "importance": "low|medium|high",
    "category": "daily_maintenance|career_goals|social_commitments|health_fitness|learning|other"
  }}
]

Only return the JSON array, no markdown formatting.`,
  inputVariables: ['goal', 'timeframe', 'preferences'],
});

const chain = new LLMChain({ llm, prompt });

export const decomposeGoal: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = await validateToken(event.headers['Authorization']);
    const { goal, timeframe, preferences } = JSON.parse(event.body || '{}');

    const result = await chain.call({
      goal,
      timeframe: timeframe || '1 month',
      preferences: preferences || 'balanced',
    });

    const subtasks = JSON.parse(result.text);

    return {
      statusCode: 200,
      body: JSON.stringify({ subtasks }),
    };
  } catch (error) {
    console.error('AI decomposition error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to decompose goal' }),
    };
  }
};
```

### 14. Frontend AI UI

**AI Planning Modal**:
```typescript
// components/AIPlanningModal.tsx
import React, { useState } from 'react';
import { View, Modal, TextInput, Pressable, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../hooks/useAuth';

interface Subtask {
  title: string;
  description: string;
  dueDate: string;
  importance: 'low' | 'medium' | 'high';
  category: string;
}

interface AIPlanningModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (subtasks: Subtask[]) => void;
}

export const AIPlanningModal: React.FC<AIPlanningModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const { tokens } = useAuth();
  const [goal, setGoal] = useState('');
  const [timeframe, setTimeframe] = useState('1 month');
  const [loading, setLoading] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleDecompose = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        'https://your-api.execute-api.us-east-1.amazonaws.com/ai/decompose-goal',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokens?.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ goal, timeframe }),
        }
      );

      const data = await response.json();
      setSubtasks(data.subtasks);
      setShowResults(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    onSave(subtasks);
    setGoal('');
    setSubtasks([]);
    setShowResults(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text>Close</Text>
        </Pressable>

        {!showResults ? (
          <View style={styles.inputSection}>
            <Text style={styles.title}>AI Goal Planner</Text>
            
            <TextInput
              placeholder="What's your goal?"
              value={goal}
              onChangeText={setGoal}
              style={styles.input}
              multiline
            />

            <Text style={styles.label}>Timeframe</Text>
            <Picker selectedValue={timeframe} onValueChange={setTimeframe}>
              <Picker.Item label="1 Week" value="1 week" />
              <Picker.Item label="1 Month" value="1 month" />
              <Picker.Item label="3 Months" value="3 months" />
              <Picker.Item label="6 Months" value="6 months" />
              <Picker.Item label="1 Year" value="1 year" />
            </Picker>

            <Pressable
              style={styles.decomposeButton}
              onPress={handleDecompose}
              disabled={loading || !goal}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.decomposeText}>Break Down Goal</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>Generated Plan</Text>
            <ScrollView>
              {subtasks.map((task, idx) => (
                <View key={idx} style={styles.subtaskCard}>
                  <Text style={styles.subtaskTitle}>{task.title}</Text>
                  <Text style={styles.subtaskDesc}>{task.description}</Text>
                  <Text style={styles.subtaskMeta}>
                    Due: {task.dueDate} | {task.importance} | {task.category}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <Pressable
              style={styles.saveButton}
              onPress={handleSave}
            >
              <Text style={styles.saveText}>Save Plan</Text>
            </Pressable>

            <Pressable
              style={styles.regenerateButton}
              onPress={handleDecompose}
            >
              <Text style={styles.regenerateText}>Regenerate</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
};
```

---

## Key Files Summary

### Frontend (New/Modified)

| File | Purpose |
|------|---------|
| `app/(tabs)/_layout.tsx` | Expand tabs for Reminders, Calendar, Stats, Settings |
| `app/(tabs)/reminders.tsx` | Main reminders list + sorting |
| `app/(tabs)/calendar.tsx` | Monthly calendar grid |
| `app/(tabs)/stats.tsx` | RPG stats display (Phase 3+) |
| `app/(tabs)/friends.tsx` | Leaderboard + friend mgmt (Phase 4+) |
| `components/ReminderForm.tsx` | Create/edit reminder modal |
| `components/ReminderCard.tsx` | Reminder display card |
| `components/CalendarGrid.tsx` | Calendar component |
| `components/AIPlanningModal.tsx` | AI goal decomposition (Phase 5+) |
| `hooks/useReminders.ts` | Zustand store for reminders |
| `hooks/useAuth.ts` | Cognito auth state & tokens (Phase 2+) |
| `hooks/useSyncManager.ts` | Cloud sync orchestration (Phase 2+) |
| `utils/database.ts` | SQLite initialization & queries |
| `utils/recurrence.ts` | Recurrence logic |
| `utils/notifications.ts` | Expo notifications wrapper |
| `utils/streaks.ts` | Streak calculation |
| `constants/GameRules.ts` | Gamification point system (Phase 3+) |

### Backend (New)

| File | Purpose |
|------|---------|
| `backend/src/handlers/reminders.ts` | CRUD + complete endpoints |
| `backend/src/handlers/stats.ts` | Stats queries (Phase 3+) |
| `backend/src/handlers/friends.ts` | Friend + leaderboard endpoints (Phase 4+) |
| `backend/src/handlers/ai.ts` | LangChain goal decomposition (Phase 5+) |
| `backend/src/infrastructure/dynamodb-schema.ts` | Table definitions |
| `backend/src/utils/cognito-validator.ts` | JWT validation |
| `backend/src/scheduled-tasks/leaderboard-update.ts` | Daily ranking (Phase 4+) |
| `backend/serverless.yml` | IaC for Lambda + API Gateway + Cognito |

---

## Verification Checklist

### Phase 1 ✓
- [ ] Create daily reminder → notification fires ✓
- [ ] Complete reminder → streak increments ✓
- [ ] Calendar shows completed days ✓
- [ ] Sorting by importance/type works ✓
- [ ] Data persists after app restart ✓

### Phase 2 ✓
- [ ] Google/Apple login works ✓
- [ ] Reminders sync to DynamoDB ✓
- [ ] Offline queue syncs when online ✓
- [ ] Multi-device sync works ✓

### Phase 3 ✓
- [ ] Completing tasks increments stats ✓
- [ ] Stats display shows correct values ✓
- [ ] Points calculated by category ✓

### Phase 4 ✓
- [ ] Friend requests sent/accepted ✓
- [ ] Leaderboards rank correctly ✓
- [ ] Friend profiles display ✓

### Phase 5 ✓
- [ ] AI breaks down goals into subtasks ✓
- [ ] Subtasks generate reminders ✓
- [ ] Regenerate option works ✓

---

## Additional Recommendations

1. **Testing**: Write unit tests for recurrence logic, stat calculations, and sync edge cases early
2. **Notifications Phase 2**: After MVP, add timezone-aware scheduling on backend
3. **Analytics**: Integrate CloudWatch or Segment in Phase 3 to track user behavior
4. **Offline-First**: Implement a more robust offline queue if sync reliability becomes an issue
5. **Design System**: Create reusable component library during Phase 1 for consistency
6. **Performance**: Implement infinite scroll for reminders list as it grows
7. **Accessibility**: Ensure TextInput fields, buttons, and images have proper accessibility labels
8. **App Store Submission**: Prepare privacy policy, terms of service, and app description before Phase 2 launch

---

## Next Steps

1. **Review & Refine**: Iterate on this architecture with your team
2. **Start Phase 1**: Begin frontend scaffolding + SQLite setup
3. **Design System**: Create consistent UI component library
4. **Backend Planning**: Finalize DynamoDB schema and API contract
5. **Authentication**: Set up Cognito User Pool and OAuth providers
6. **Testing Strategy**: Define unit, integration, and E2E test coverage

