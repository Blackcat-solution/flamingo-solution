import { describe, expect, it } from 'vitest';
import {
  validateAvailability,
  validateAssignmentSchedule,
  validateTimesheet,
  dayOfWeek,
  weekStart,
  remainingCapacity,
  shiftWindow,
  intervalsOverlap
} from '../src/domain/scheduling.js';

const settings = {
  allowedWorkingDays: ['TUE', 'WED', 'THU', 'FRI', 'SAT'],
  mandatoryOffDays: ['SUN', 'MON'],
  shiftOptions: [8, 10, 12],
  max_working_days_week: 4,
  max_working_hours_day: 12,
  weekly_hours_cap: 48,
  breakPolicy: [15, 15, 30]
};

const breaks = [
  { minutes: 15, start: '11:00', end: '11:15' },
  { minutes: 30, start: '13:00', end: '13:30' },
  { minutes: 15, start: '16:00', end: '16:15' }
];

describe('availability rules', () => {
  it('accepts four Tuesday–Saturday days on a 12-hour shift (48h cap)', () => {
    const result = validateAvailability(
      { days: ['TUE', 'WED', 'THU', 'FRI'], shiftHours: 12, startTime: '08:00', breaks },
      settings
    );
    expect(result.valid).toBe(true);
    expect(result.weeklyHours).toBe(48);
    expect(result.endTime).toBe('21:00');
  });

  it('rejects Sunday and Monday work', () => {
    const sunday = validateAvailability(
      { days: ['SUN', 'TUE'], shiftHours: 8, startTime: '09:00', breaks },
      settings
    );
    expect(sunday.valid).toBe(false);
    expect(sunday.errors.join(' ')).toContain('Sunday is a compulsory off day');

    const monday = validateAvailability(
      { days: ['MON'], shiftHours: 8, startTime: '09:00', breaks },
      settings
    );
    expect(monday.errors.join(' ')).toContain('Monday is a compulsory off day');
  });

  it('rejects more than four working days', () => {
    const result = validateAvailability(
      { days: ['TUE', 'WED', 'THU', 'FRI', 'SAT'], shiftHours: 8, startTime: '09:00', breaks },
      settings
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('maximum of 4 working days');
  });

  it('rejects unsupported shift lengths', () => {
    const result = validateAvailability(
      { days: ['TUE'], shiftHours: 9, startTime: '09:00', breaks },
      settings
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Shift must be one of 8, 10, 12 hours');
  });

  it('rejects shifts that would run past midnight', () => {
    const result = validateAvailability(
      { days: ['TUE'], shiftHours: 12, startTime: '14:00', breaks: [] },
      settings
    );
    expect(result.valid).toBe(false);
  });

  it('requires a full 60 minutes of breaks when provided', () => {
    const result = validateAvailability(
      { days: ['TUE'], shiftHours: 8, startTime: '09:00', breaks: [{ minutes: 15, start: '11:00', end: '11:15' }] },
      settings
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Break entitlement must total at least 60 minutes');
  });

  it('requires all three break periods', () => {
    const result = validateAvailability(
      {
        days: ['TUE'],
        shiftHours: 8,
        startTime: '09:00',
        breaks: [
          { minutes: 30, start: '11:00', end: '11:30' },
          { minutes: 30, start: '13:00', end: '13:30' }
        ]
      },
      settings
    );
    expect(result.errors.join(' ')).toContain('Provide 3 breaks');
  });
});

describe('cross-employer booking conflicts', () => {
  const existing = [
    {
      code: 'FLM-ASG-1001',
      working_days: ['TUE', 'WED'],
      shift_hours: 8,
      daily_start: '09:00'
    }
  ];

  it('blocks overlapping hours on a shared day', () => {
    const result = validateAssignmentSchedule({
      workingDays: ['WED', 'THU'],
      shiftHours: 8,
      dailyStart: '10:00',
      existingAssignments: existing,
      settings
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Scheduling conflict');
  });

  it('allows non-overlapping assignments on the same day', () => {
    const result = validateAssignmentSchedule({
      workingDays: ['WED'],
      shiftHours: 12,
      dailyStart: '09:00',
      existingAssignments: [
        { code: 'EARLY', working_days: ['WED'], shift_hours: 8, daily_start: '00:00' }
      ],
      settings
    });
    expect(result.valid).toBe(true);
  });

  it('blocks a fifth combined working day', () => {
    const result = validateAssignmentSchedule({
      workingDays: ['THU', 'FRI', 'SAT'],
      shiftHours: 8,
      dailyStart: '09:00',
      existingAssignments: existing,
      settings
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('weekly limit');
  });

  it('blocks combined bookings above 48 hours', () => {
    const result = validateAssignmentSchedule({
      workingDays: ['THU', 'FRI'],
      shiftHours: 12,
      dailyStart: '08:00',
      existingAssignments: [
        { code: 'A', working_days: ['TUE', 'WED'], shift_hours: 12, daily_start: '08:00' },
        { code: 'B', working_days: ['SAT'], shift_hours: 12, daily_start: '08:00' }
      ],
      settings
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Combined bookings would total 60 hours');
  });

  it('detects interval overlap correctly at boundaries', () => {
    expect(intervalsOverlap(540, 1020, 1020, 1200)).toBe(false);
    expect(intervalsOverlap(540, 1080, 1020, 1200)).toBe(true);
  });
});

describe('timesheet validation', () => {
  const assignment = {
    working_days: ['TUE', 'WED', 'THU', 'FRI'],
    shift_hours: 8,
    start_date: '2026-01-01',
    end_date: '2026-12-31'
  };

  it('accepts a compliant 8-hour day with a one-hour break', () => {
    const result = validateTimesheet({
      workDate: '2026-11-10', // Tuesday
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
      assignment,
      existingTimesheets: [],
      settings
    });
    expect(result.valid).toBe(true);
    expect(result.hoursWorked).toBe(8);
  });

  it('rejects work on Sunday', () => {
    const result = validateTimesheet({
      workDate: '2026-11-08',
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
      assignment,
      existingTimesheets: [],
      settings
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('compulsory off day');
  });

  it('rejects a day the assignment is not scheduled for', () => {
    const result = validateTimesheet({
      workDate: '2026-11-14', // Saturday
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
      assignment,
      existingTimesheets: [],
      settings
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('not scheduled on Saturday');
  });

  it('rejects shifts longer than the assignment shift', () => {
    const result = validateTimesheet({
      workDate: '2026-11-10',
      startTime: '08:00',
      endTime: '20:00',
      breakMinutes: 60,
      assignment,
      existingTimesheets: [],
      settings
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('8-hour shift plus the 60-minute break');
  });

  it('rejects overlapping entries across employers', () => {
    const result = validateTimesheet({
      workDate: '2026-11-10',
      startTime: '10:00',
      endTime: '19:00',
      breakMinutes: 60,
      assignment,
      existingTimesheets: [{ work_date: '2026-11-10', start_at: '09:00', end_at: '17:00', hours_worked: 7, status: 'approved' }],
      settings
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('overlaps an existing timesheet');
  });

  it('rejects surpassing the weekly 48-hour cap', () => {
    const result = validateTimesheet({
      workDate: '2026-11-10',
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
      assignment,
      existingTimesheets: [
        { work_date: '2026-11-09', start_at: '09:00', end_at: '18:00', hours_worked: 8, status: 'approved' },
        { work_date: '2026-11-10', start_at: '18:00', end_at: '22:00', hours_worked: 4, status: 'approved' },
        { work_date: '2026-11-11', start_at: '09:00', end_at: '21:00', hours_worked: 12, status: 'approved' },
        { work_date: '2026-11-12', start_at: '09:00', end_at: '21:00', hours_worked: 12, status: 'approved' },
        { work_date: '2026-11-13', start_at: '09:00', end_at: '21:00', hours_worked: 12, status: 'approved' }
      ],
      settings
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('48-hour cap');
  });
});

describe('date helpers', () => {
  it('identifies weekdays and week starts', () => {
    expect(dayOfWeek('2026-11-10')).toBe('TUE');
    expect(dayOfWeek('2026-11-08')).toBe('SUN');
    expect(weekStart('2026-11-10')).toBe('2026-11-09');
  });

  it('computes shift windows and remaining capacity', () => {
    expect(shiftWindow('09:00', 12)).toEqual({ start: '09:00', end: '22:00', startMinutes: 540, endMinutes: 1320 });
    expect(shiftWindow('14:00', 12)).toBeNull();
    const capacity = remainingCapacity({ shiftHours: 8, workingDays: ['TUE', 'WED'], loggedHoursThisWeek: 6, settings });
    expect(capacity.contractedHours).toBe(16);
    expect(capacity.remainingHours).toBe(10);
  });
});
