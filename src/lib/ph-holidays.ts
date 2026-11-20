// Philippine Holiday Calendar & Loan Collection Scheduling Engine
// Official Proclamation No. 1006 (2026) & Proclamation No. 1427 (2027)

export interface HolidayItem {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'regular' | 'special_non_working';
}

/**
 * Official Philippine Non-Working Holidays for 2026 and 2027.
 * Collections are strictly suspended on non-working holidays and Sundays.
 */
export const PH_NON_WORKING_HOLIDAYS: Record<string, HolidayItem> = {
  // 2026 Holidays (Proclamation No. 1006 & Islamic Proclamations)
  '2026-01-01': { date: '2026-01-01', name: "New Year's Day", type: 'regular' },
  '2026-02-17': { date: '2026-02-17', name: 'Chinese New Year', type: 'special_non_working' },
  '2026-03-20': { date: '2026-03-20', name: "Eid'l Fitr", type: 'regular' },
  '2026-04-02': { date: '2026-04-02', name: 'Maundy Thursday', type: 'regular' },
  '2026-04-03': { date: '2026-04-03', name: 'Good Friday', type: 'regular' },
  '2026-04-04': { date: '2026-04-04', name: 'Black Saturday', type: 'special_non_working' },
  '2026-04-09': { date: '2026-04-09', name: 'Araw ng Kagitingan (Day of Valor)', type: 'regular' },
  '2026-05-01': { date: '2026-05-01', name: 'Labor Day', type: 'regular' },
  '2026-05-27': { date: '2026-05-27', name: "Eid'l Adha", type: 'regular' },
  '2026-06-12': { date: '2026-06-12', name: 'Independence Day', type: 'regular' },
  '2026-08-21': { date: '2026-08-21', name: 'Ninoy Aquino Day', type: 'special_non_working' },
  '2026-08-31': { date: '2026-08-31', name: 'National Heroes Day', type: 'regular' },
  '2026-11-01': { date: '2026-11-01', name: "All Saints' Day", type: 'special_non_working' },
  '2026-11-02': { date: '2026-11-02', name: "All Souls' Day", type: 'special_non_working' },
  '2026-11-30': { date: '2026-11-30', name: 'Bonifacio Day', type: 'regular' },
  '2026-12-08': { date: '2026-12-08', name: 'Feast of the Immaculate Conception', type: 'special_non_working' },
  '2026-12-24': { date: '2026-12-24', name: 'Christmas Eve', type: 'special_non_working' },
  '2026-12-25': { date: '2026-12-25', name: 'Christmas Day', type: 'regular' },
  '2026-12-30': { date: '2026-12-30', name: 'Rizal Day', type: 'regular' },
  '2026-12-31': { date: '2026-12-31', name: 'Last Day of the Year', type: 'special_non_working' },

  // 2027 Holidays (Proclamation No. 1427)
  '2027-01-01': { date: '2027-01-01', name: "New Year's Day", type: 'regular' },
  '2027-02-06': { date: '2027-02-06', name: 'Chinese New Year', type: 'special_non_working' },
  '2027-03-25': { date: '2027-03-25', name: 'Maundy Thursday', type: 'regular' },
  '2027-03-26': { date: '2027-03-26', name: 'Good Friday', type: 'regular' },
  '2027-03-27': { date: '2027-03-27', name: 'Black Saturday', type: 'special_non_working' },
  '2027-04-09': { date: '2027-04-09', name: 'Araw ng Kagitingan', type: 'regular' },
  '2027-05-01': { date: '2027-05-01', name: 'Labor Day', type: 'regular' },
  '2027-06-12': { date: '2027-06-12', name: 'Independence Day', type: 'regular' },
  '2027-08-21': { date: '2027-08-21', name: 'Ninoy Aquino Day', type: 'special_non_working' },
  '2027-08-30': { date: '2027-08-30', name: 'National Heroes Day', type: 'regular' },
  '2027-11-01': { date: '2027-11-01', name: "All Saints' Day", type: 'special_non_working' },
  '2027-11-02': { date: '2027-11-02', name: "All Souls' Day", type: 'special_non_working' },
  '2027-11-30': { date: '2027-11-30', name: 'Bonifacio Day', type: 'regular' },
  '2027-12-08': { date: '2027-12-08', name: 'Feast of the Immaculate Conception', type: 'special_non_working' },
  '2027-12-24': { date: '2027-12-24', name: 'Christmas Eve', type: 'special_non_working' },
  '2027-12-25': { date: '2027-12-25', name: 'Christmas Day', type: 'regular' },
  '2027-12-30': { date: '2027-12-30', name: 'Rizal Day', type: 'regular' },
  '2027-12-31': { date: '2027-12-31', name: 'Last Day of the Year', type: 'special_non_working' },
};

/**
 * Checks if a given date string (YYYY-MM-DD) or Date object is a non-working Philippine holiday.
 */
export function isPhilippineHoliday(date: Date | string): HolidayItem | null {
  const dStr = typeof date === 'string' ? date.split('T')[0] : formatDateToYMD(date);
  return PH_NON_WORKING_HOLIDAYS[dStr] || null;
}

/**
 * Checks if a given day is non-working for microfinance collection:
 * - Sundays (day 0) are non-collection rest days.
 * - Official non-working Philippine holidays are non-collection days.
 */
export function isNonWorkingDay(date: Date): boolean {
  // Sunday is 0
  if (date.getDay() === 0) return true;
  const holiday = isPhilippineHoliday(date);
  return holiday !== null;
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
export function formatDateToYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Moves forward to the next valid working collection day if the target date falls on
 * a Sunday or a non-working Philippine holiday.
 */
export function rollToNextWorkingDay(date: Date): Date {
  const rolled = new Date(date.getTime());
  while (isNonWorkingDay(rolled)) {
    rolled.setDate(rolled.getDate() + 1);
  }
  return rolled;
}

export interface ScheduledInstallmentItem {
  installmentNo: number;
  dueDate: Date;
  dateStr: string; // Long formatted string, e.g. "November 23, 2026"
  shortDateStr: string; // e.g. "Nov 23, 2026"
  isHolidayAdjusted?: boolean;
  holidayNote?: string;
  originalDateStr?: string;
}

/**
 * Generates official collection dates following exact business rules:
 *
 * 1. Base date is the approval/disbursement date (e.g. November 16, 2026).
 * 2. FIRST INSTALLMENT IS NEVER COLLECTED ON THE REGISTRATION/APPROVAL DAY:
 *    - Daily: Starts tomorrow (next working day).
 *    - Weekly: Anchor is the same day of the week next week (e.g. approved Mon Nov 16 -> 1st payment Mon Nov 23).
 *              If a weekly installment falls on a holiday (e.g. Bonifacio Day Mon Nov 30), it rolls to the next
 *              working day (Tue Dec 1). NO DOMINO EFFECT: The following installment remains anchored on its original
 *              Monday (Mon Dec 7).
 *    - Monthly: Based on the calendar day each month. If that day falls on a holiday/Sunday, it moves to the next
 *               working day, but subsequent months remain anchored to the base day of the month.
 *    - Semi-Monthly: 15-day anchors (e.g. 15th and 30th / 1st and 16th), rolled forward if a holiday/Sunday.
 */
export function generateCollectionScheduleDates(
  approvalDate: Date,
  termMonths: number,
  frequency: 'Daily' | 'Weekly' | 'Semi-Monthly' | 'Monthly' | string = 'Weekly',
  maxInstallments?: number
): ScheduledInstallmentItem[] {
  const normFreq = (frequency || 'Weekly').toLowerCase();
  const results: ScheduledInstallmentItem[] = [];

  const baseYear = approvalDate.getFullYear();
  const baseMonth = approvalDate.getMonth();
  const baseDay = approvalDate.getDate();

  if (normFreq.includes('daily')) {
    // 26 working collection days per month approx
    const totalDays = maxInstallments || (termMonths * 26);
    let checkDate = new Date(baseYear, baseMonth, baseDay + 1); // starts tomorrow

    while (results.length < totalDays) {
      if (!isNonWorkingDay(checkDate)) {
        const dCopy = new Date(checkDate.getTime());
        results.push({
          installmentNo: results.length + 1,
          dueDate: dCopy,
          dateStr: dCopy.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
          shortDateStr: dCopy.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
        });
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }
  } else if (normFreq.includes('weekly')) {
    // Weekly collection anchored to same day of the week (e.g. every Monday)
    // 4.33 weeks per month or 12 weeks for 3 months
    const totalWeeks = maxInstallments || Math.round(termMonths * 4.33) || 12;

    for (let w = 1; w <= totalWeeks; w++) {
      // Anchor date is exactly w * 7 days after approval date (preserves day of week anchor)
      const anchorDate = new Date(baseYear, baseMonth, baseDay + (w * 7));
      const holidayInfo = isPhilippineHoliday(anchorDate);
      const isSunday = anchorDate.getDay() === 0;

      const adjustedDate = rollToNextWorkingDay(anchorDate);
      const wasAdjusted = adjustedDate.getTime() !== anchorDate.getTime();

      let holidayNote: string | undefined;
      if (wasAdjusted) {
        if (holidayInfo) {
          holidayNote = `Adjusted from ${anchorDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} (${holidayInfo.name})`;
        } else if (isSunday) {
          holidayNote = `Adjusted from Sunday ${anchorDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`;
        }
      }

      results.push({
        installmentNo: w,
        dueDate: adjustedDate,
        dateStr: adjustedDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
        shortDateStr: adjustedDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
        isHolidayAdjusted: wasAdjusted,
        holidayNote,
        originalDateStr: wasAdjusted
          ? anchorDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
          : undefined,
      });
    }
  } else if (normFreq.includes('monthly')) {
    // Monthly collection anchored to the calendar day
    const totalMonths = maxInstallments || termMonths;

    for (let m = 1; m <= totalMonths; m++) {
      // Anchor date is base day m months later
      const anchorDate = new Date(baseYear, baseMonth + m, baseDay);
      const holidayInfo = isPhilippineHoliday(anchorDate);
      const isSunday = anchorDate.getDay() === 0;

      const adjustedDate = rollToNextWorkingDay(anchorDate);
      const wasAdjusted = adjustedDate.getTime() !== anchorDate.getTime();

      let holidayNote: string | undefined;
      if (wasAdjusted) {
        if (holidayInfo) {
          holidayNote = `Adjusted from ${anchorDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} (${holidayInfo.name})`;
        } else if (isSunday) {
          holidayNote = `Adjusted from Sunday ${anchorDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`;
        }
      }

      results.push({
        installmentNo: m,
        dueDate: adjustedDate,
        dateStr: adjustedDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
        shortDateStr: adjustedDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
        isHolidayAdjusted: wasAdjusted,
        holidayNote,
        originalDateStr: wasAdjusted
          ? anchorDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
          : undefined,
      });
    }
  } else {
    // Semi-Monthly: twice a month (every 15 days)
    const totalInstallments = maxInstallments || (termMonths * 2);

    for (let s = 1; s <= totalInstallments; s++) {
      const anchorDate = new Date(baseYear, baseMonth, baseDay + (s * 15));
      const holidayInfo = isPhilippineHoliday(anchorDate);
      const isSunday = anchorDate.getDay() === 0;

      const adjustedDate = rollToNextWorkingDay(anchorDate);
      const wasAdjusted = adjustedDate.getTime() !== anchorDate.getTime();

      let holidayNote: string | undefined;
      if (wasAdjusted) {
        if (holidayInfo) {
          holidayNote = `Adjusted from ${anchorDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} (${holidayInfo.name})`;
        } else if (isSunday) {
          holidayNote = `Adjusted from Sunday ${anchorDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`;
        }
      }

      results.push({
        installmentNo: s,
        dueDate: adjustedDate,
        dateStr: adjustedDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }),
        shortDateStr: adjustedDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
        isHolidayAdjusted: wasAdjusted,
        holidayNote,
        originalDateStr: wasAdjusted
          ? anchorDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
          : undefined,
      });
    }
  }

  return results;
}

