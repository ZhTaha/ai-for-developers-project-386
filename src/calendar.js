// Логика вычисления слотов на основе расписания доступности и броней.
// Чистые функции — легко тестируются отдельно от сервера.

const WEEK_MINUTES = 7 * 24 * 60;

function parseHHMM(value) {
  const [h, m] = String(value).split(':').map(Number);
  return h * 60 + m;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function minutesToHHMM(total) {
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}

/** ISO «2026-11-20T10:00» -> { date: '2026-11-20', time: '10:00' } */
function parseSlotStart(slotStart) {
  const [date, time] = String(slotStart).split('T');
  return { date, time };
}

/** ISO «2026-11-20T10:00» -> Date (UTC) */
function slotToUTCDate(slotStart) {
  const { date, time } = parseSlotStart(slotStart);
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi));
}

/** Date (UTC) -> ISO «YYYY-MM-DDTHH:MM» */
function utcDateToSlot(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** ISO дата «YYYY-MM-DD» -> день недели ISO (1 = понедельник ... 7 = воскресенье) */
function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = вс
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Вычисляет слоты на дату.
 * @param {object} availability { weekdays: number[], startTime, endTime }
 * @param {string} date «YYYY-MM-DD»
 * @param {Array<{slotStart: string, durationMinutes: number}>} bookings занятые слоты
 * @param {Array<{id: string, durationMinutes: number}>} eventTypes типы встреч
 * @param {number} [slotMinutes] длительность слота (по умолчанию 30)
 * @returns {Array<{start: string, end: string, booked: boolean}>}
 */
function slotsForDate(availability, date, bookings, eventTypes, slotMinutes = 30) {
  const weekday = weekdayOf(date);
  if (!availability.weekdays.includes(weekday)) return [];

  const startMin = parseHHMM(availability.startTime);
  const endMin = parseHHMM(availability.endTime);
  if (endMin <= startMin) return [];

  const busy = new Set(
    bookings.map((b) => parseSlotStart(b.slotStart).date === date && parseSlotStart(b.slotStart).time)
  );

  const slots = [];
  for (let t = startMin; t + slotMinutes <= endMin; t += slotMinutes) {
    const time = minutesToHHMM(t);
    const end = minutesToHHMM(Math.min(t + slotMinutes, endMin));
    slots.push({
      start: `${date}T${time}`,
      end: `${date}T${end}`,
      booked: busy.has(time),
    });
  }
  return slots;
}

/** Проверка, что слот свободен и внутри расписания */
function isSlotBookable(availability, slotStart, bookings, slotMinutes = 30) {
  const { date, time } = parseSlotStart(slotStart);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return false;

  const all = slotsForDate(availability, date, bookings, [], slotMinutes);
  const slot = all.find((s) => s.start === slotStart);
  return Boolean(slot && !slot.booked);
}

module.exports = {
  slotsForDate,
  isSlotBookable,
  weekdayOf,
  slotToUTCDate,
  utcDateToSlot,
  parseSlotStart,
};
