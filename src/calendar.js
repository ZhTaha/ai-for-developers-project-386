// Логика вычисления слотов на основе расписания доступности и броней.
// Чистые функции — легко тестируются отдельно от сервера.

const DEFAULT_SLOT_MINUTES = 15;

/** Минуты от полуночи до начала брони (для slotStart «YYYY-MM-DDTHH:MM») */
function bookingMinutes(b) {
  return parseHHMM(parseSlotStart(b.slotStart).time);
}

/** Длительность брони; без durationMinutes считаем короткой (15 минут) */
function bookingDuration(b) {
  return Number.isInteger(b.durationMinutes) && b.durationMinutes > 0 ? b.durationMinutes : 15;
}

/** Пересекается ли слот [t, t + slotMinutes) с интервалом брони [bs, bs + bd) */
function overlaps(t, slotMinutes, bookingStart, bookingDuration) {
  return t < bookingStart + bookingDuration && bookingStart < t + slotMinutes;
}

/** Занятые интервалы броней в минутах от полуночи данной даты */
function busyIntervalsForDate(bookings, date) {
  return bookings
    .filter((b) => parseSlotStart(b.slotStart).date === date)
    .map((b) => ({ start: bookingMinutes(b), duration: bookingDuration(b) }));
}

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
 * Вычисляет слоты на дату (15-минутная сетка).
 * @param {object} availability { weekdays: number[], startTime, endTime }
 * @param {string} date «YYYY-MM-DD»
 * @param {Array<{slotStart: string, durationMinutes?: number}>} bookings занятые интервалы
 * @param {Array<{id: string, durationMinutes: number}>} eventTypes типы встреч
 * @param {number} [slotMinutes] шаг сетки (по умолчанию 15)
 * @returns {Array<{start: string, end: string, booked: boolean}>}
 */
function slotsForDate(availability, date, bookings, eventTypes, slotMinutes = DEFAULT_SLOT_MINUTES) {
  const weekday = weekdayOf(date);
  if (!availability.weekdays.includes(weekday)) return [];

  const startMin = parseHHMM(availability.startTime);
  const endMin = parseHHMM(availability.endTime);
  if (endMin <= startMin) return [];

  const intervals = busyIntervalsForDate(bookings, date);

  const slots = [];
  for (let t = startMin; t < endMin; t += slotMinutes) {
    const time = minutesToHHMM(t);
    // последняя встреча дня может выходить за endTime — конец слота не обрезаем жёстко
    const end = minutesToHHMM(t + slotMinutes);
    slots.push({
      start: `${date}T${time}`,
      end: `${date}T${end}`,
      booked: intervals.some((iv) => overlaps(t, slotMinutes, iv.start, iv.duration)),
    });
  }
  return slots;
}

/**
 * Проверка, что slotStart бронируем: на сетке, внутри окна доступности и без пересечения с бронями.
 * Встреча может начаться в последнем интервале окна и выйти за endTime.
 */
function isSlotBookable(availability, slotStart, bookings, slotMinutes = DEFAULT_SLOT_MINUTES) {
  const { date, time } = parseSlotStart(slotStart);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return false;

  const t = parseHHMM(time);
  if (t % slotMinutes !== 0) return false;

  const startMin = parseHHMM(availability.startTime);
  const endMin = parseHHMM(availability.endTime);
  if (!availability.weekdays.includes(weekdayOf(date))) return false;
  if (t < startMin || t >= endMin) return false;

  const intervals = busyIntervalsForDate(bookings, date);
  return !intervals.some((iv) => overlaps(t, slotMinutes, iv.start, iv.duration));
}

/** slotStart «YYYY-MM-DDTHH:MM» на сетке slotMinutes? */
function isOnGrid(slotStart, slotMinutes = DEFAULT_SLOT_MINUTES) {
  const { time } = parseSlotStart(slotStart);
  if (!/^\d{2}:\d{2}$/.test(time || '')) return false;
  return parseHHMM(time) % slotMinutes === 0;
}

module.exports = {
  slotsForDate,
  isSlotBookable,
  isOnGrid,
  weekdayOf,
  slotToUTCDate,
  utcDateToSlot,
  parseSlotStart,
};
