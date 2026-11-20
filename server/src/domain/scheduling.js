/**
 * Working-time engine. All rules are configuration-driven through settings so
 * administrators can change policy without a code deployment.
 *
 * Policy defaults:
 *  - 8 / 10 / 12 hour shift preferences
 *  - maximum 4 working days per week, Tuesday–Saturday only
 *  - Sunday and Monday compulsory off
 *  - two 15-minute breaks and one 30-minute break (60 minutes total)
 *  - maximum 12 hours per day and 48 hours per week
 */

export const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const DAY_LABELS = {
  SUN: 'Sunday',
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday'
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDate(value) {
  return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function isValidTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function dayOfWeek(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return DAY_NAMES[date.getUTCDay()];
}

export function weekStart(dateStr) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const day = date.getUTCDay();
  const diff = (day + 6) % 7; // Monday-based week
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

export function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function minutesFromTime(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
}

export function timeFromMinutes(total) {
  const normalized = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

/**
 * Attendance window for a paid shift. Shift hours are productive/paid hours;
 * the mandatory 60-minute break entitlement sits inside the attendance window.
 */
export function shiftWindow(startTime, shiftHours, breakMinutes = 60) {
  if (!isValidTime(startTime)) return null;
  const startMinutes = minutesFromTime(startTime);
  const endMinutes = startMinutes + Number(shiftHours) * 60 + Number(breakMinutes || 0);
  if (endMinutes > 24 * 60) return null; // platform does not schedule overnight shifts
  return { start: startTime, end: timeFromMinutes(endMinutes), startMinutes, endMinutes };
}

export function validateAvailability({ days, shiftHours, startTime, breaks }, settings) {
  const errors = [];
  const warnings = [];
  const allowed = new Set(settings.allowedWorkingDays || ['TUE', 'WED', 'THU', 'FRI', 'SAT']);
  const off = new Set(settings.mandatoryOffDays || ['SUN', 'MON']);
  const uniqueDays = [...new Set(days || [])];

  if (!uniqueDays.length) errors.push('Select at least one working day.');
  if (uniqueDays.length > settings.max_working_days_week) {
    errors.push(`You may select a maximum of ${settings.max_working_days_week} working days per week.`);
  }
  for (const day of uniqueDays) {
    if (!DAY_NAMES.includes(day)) errors.push(`Unknown working day: ${day}`);
    else if (off.has(day)) errors.push(`${DAY_LABELS[day]} is a compulsory off day.`);
    else if (!allowed.has(day)) errors.push(`${DAY_LABELS[day]} is not an available working day.`);
  }
  if (!settings.shiftOptions.includes(Number(shiftHours))) {
    errors.push(`Shift must be one of ${settings.shiftOptions.join(', ')} hours.`);
  }
  if (shiftHours > settings.max_working_hours_day) {
    errors.push(`Daily shift cannot exceed ${settings.max_working_hours_day} hours.`);
  }
  const window = shiftWindow(startTime, Number(shiftHours), 60);
  if (!window) {
    errors.push('A valid start time is required and the shift must finish before midnight.');
  }
  const breakList = breaks || [];
  const totalBreakMinutes = breakList.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  if (breakList.length) {
    const required = settings.breakPolicy || [15, 15, 30];
    if (breakList.length !== required.length) {
      errors.push(`Provide ${required.length} breaks (${required.join(' + ')} minutes).`);
    }
    if (totalBreakMinutes < 60) errors.push('Break entitlement must total at least 60 minutes.');
    for (const item of breakList) {
      if (!isValidTime(item.start) || !isValidTime(item.end)) {
        errors.push('Each break needs a valid start and end time.');
        continue;
      }
      const start = minutesFromTime(item.start);
      const end = minutesFromTime(item.end);
      if (end <= start) errors.push('Break end time must be after the start time.');
      if (window && (start < window.startMinutes || end > window.endMinutes)) {
        errors.push('Breaks must fall inside the shift window.');
      }
    }
    const sorted = [...breakList].sort((a, b) => minutesFromTime(a.start) - minutesFromTime(b.start));
    for (let index = 1; index < sorted.length; index += 1) {
      if (minutesFromTime(sorted[index].start) < minutesFromTime(sorted[index - 1].end)) {
        errors.push('Break timings cannot overlap each other.');
      }
    }
  } else {
    warnings.push('Add break timings so your calendar can block them automatically.');
  }

  const weeklyHours = Number(shiftHours) * uniqueDays.length;
  if (weeklyHours > settings.weekly_hours_cap) {
    errors.push(
      `This pattern would exceed the ${settings.weekly_hours_cap}-hour weekly cap. Reduce the shift or number of days.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    days: uniqueDays,
    shiftHours: Number(shiftHours),
    startTime,
    endTime: window?.end ?? null,
    weeklyHours,
    paidHoursPerWeek: Math.max(0, weeklyHours - (totalBreakMinutes / 60) * uniqueDays.length),
    totalBreakMinutes
  };
}

export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

export function validateAssignmentSchedule({
  workingDays,
  shiftHours,
  dailyStart,
  existingAssignments = [],
  settings
}) {
  const errors = [];
  const candidateWindow = shiftWindow(dailyStart, shiftHours, 60);
  if (!candidateWindow) errors.push('Assignment start time must produce a shift ending before midnight.');
  for (const existing of existingAssignments) {
    const dayOverlap = (existing.working_days || []).filter((day) => workingDays.includes(day));
    if (!dayOverlap.length) continue;
    const otherWindow = shiftWindow(existing.daily_start || '09:00', existing.shift_hours, 60);
    if (!otherWindow || !candidateWindow) continue;
    if (intervalsOverlap(candidateWindow.startMinutes, candidateWindow.endMinutes, otherWindow.startMinutes, otherWindow.endMinutes)) {
      errors.push(
        `Scheduling conflict with assignment ${existing.code || existing.title} on ${dayOverlap
          .map((day) => DAY_LABELS[day])
          .join(', ')}. Overlapping bookings are not permitted.`
      );
    }
  }
  const totalDays = new Set(existingAssignments.flatMap((item) => item.working_days || [])).size;
  if (totalDays + workingDays.length > settings.max_working_days_week) {
    errors.push(
      `This booking would exceed the ${settings.max_working_days_week}-day weekly limit across all employers.`
    );
  }
  const weeklyHours =
    existingAssignments.reduce((sum, item) => sum + item.shift_hours * (item.working_days || []).length, 0) +
    shiftHours * workingDays.length;
  if (weeklyHours > settings.weekly_hours_cap) {
    errors.push(`Combined bookings would total ${weeklyHours} hours, above the ${settings.weekly_hours_cap}-hour weekly cap.`);
  }
  return { valid: errors.length === 0, errors, weeklyHours };
}

export function validateTimesheet({
  workDate,
  startTime,
  endTime,
  breakMinutes,
  assignment,
  existingTimesheets = [],
  settings
}) {
  const errors = [];
  if (!isValidDate(workDate)) errors.push('A valid work date is required.');
  if (!isValidTime(startTime) || !isValidTime(endTime)) errors.push('Valid start and end times are required.');
  if (errors.length) return { valid: false, errors, hoursWorked: 0 };

  const day = dayOfWeek(workDate);
  if ((settings.mandatoryOffDays || []).includes(day)) {
    errors.push(`${DAY_LABELS[day]} is a compulsory off day; work cannot be logged.`);
  }
  const assignmentDays = assignment?.working_days || [];
  if (assignmentDays.length && !assignmentDays.includes(day)) {
    errors.push(`This assignment is not scheduled on ${DAY_LABELS[day]}.`);
  }
  if (workDate < assignment.start_date) errors.push('Work cannot be logged before the assignment start date.');
  if (assignment.end_date && workDate > assignment.end_date) {
    errors.push('Work cannot be logged after the assignment completion date.');
  }

  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);
  const elapsed = end - start;
  if (elapsed <= 0) errors.push('End time must be after start time.');
  if (elapsed > (assignment?.shift_hours || settings.max_working_hours_day) * 60 + 60) {
    errors.push(
      `Logged time cannot exceed the ${assignment?.shift_hours || settings.max_working_hours_day}-hour shift plus the 60-minute break entitlement.`
    );
  }
  if (elapsed > settings.max_working_hours_day * 60 + 60) {
    errors.push(`Daily attendance cannot exceed ${settings.max_working_hours_day} hours plus breaks.`);
  }
  if (elapsed > 6 * 60 && Number(breakMinutes) < 60) {
    errors.push('At least 60 minutes of breaks must be recorded for shifts longer than six hours.');
  }
  if (Number(breakMinutes) >= elapsed) errors.push('Break minutes cannot consume the entire shift.');
  const hoursWorked = Math.round(((elapsed - Number(breakMinutes || 0)) / 60) * 100) / 100;

  for (const existing of existingTimesheets) {
    if (existing.work_date !== workDate) continue;
    const otherStart = minutesFromTime(existing.start_at);
    const otherEnd = minutesFromTime(existing.end_at);
    if (intervalsOverlap(start, end, otherStart, otherEnd)) {
      errors.push('This entry overlaps an existing timesheet, including time logged for another employer.');
    }
  }

  const week = weekStart(workDate);
  const weeklyLogged = existingTimesheets
    .filter((item) => weekStart(item.work_date) === week && item.status !== 'rejected')
    .reduce((sum, item) => sum + Number(item.hours_worked), 0);
  if (weeklyLogged + hoursWorked > settings.weekly_hours_cap) {
    errors.push(
      `Logging these hours would take the week to ${(weeklyLogged + hoursWorked).toFixed(2)} hours, above the ${settings.weekly_hours_cap}-hour cap.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    hoursWorked,
    weekStart: week,
    weeklyLogged: Math.round((weeklyLogged + hoursWorked) * 100) / 100
  };
}

export function remainingCapacity({ shiftHours, workingDays, loggedHoursThisWeek, settings }) {
  const contracted = shiftHours * workingDays.length;
  const remaining = Math.max(0, Math.min(contracted, settings.weekly_hours_cap) - loggedHoursThisWeek);
  return {
    contractedHours: contracted,
    loggedHours: Math.round(loggedHoursThisWeek * 100) / 100,
    remainingHours: Math.round(remaining * 100) / 100
  };
}
