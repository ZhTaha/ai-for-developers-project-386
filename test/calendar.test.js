// Юнит-тесты чистых функций calendar.js. Запуск: node --test test/calendar.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const calendar = require('../src/calendar');

const AVAIL = { weekdays: [1], startTime: '09:00', endTime: '18:00' }; // понедельник

test('60-минутная бронь блокирует все пересекающиеся 15-минутные слоты', () => {
  const bookings = [{ slotStart: '2026-11-16T10:00', durationMinutes: 60 }];
  const slots = calendar.slotsForDate(AVAIL, '2026-11-16', bookings, [], 15);
  const busy = slots.filter((s) => s.booked).map((s) => s.start);
  assert.deepEqual(busy, [
    '2026-11-16T10:00',
    '2026-11-16T10:15',
    '2026-11-16T10:30',
    '2026-11-16T10:45',
  ]);
  // примыкающий вплотную слот свободен
  assert.equal(slots.find((s) => s.start === '2026-11-16T11:00').booked, false);
});

test('бронь в 30 минут не блокирует примыкающий слот (касание границ — не пересечение)', () => {
  const bookings = [{ slotStart: '2026-11-16T10:15', durationMinutes: 30 }]; // [10:15, 10:45)
  const slots = calendar.slotsForDate(AVAIL, '2026-11-16', bookings, [], 15);
  assert.equal(slots.find((s) => s.start === '2026-11-16T10:00').booked, false);
  assert.equal(slots.find((s) => s.start === '2026-11-16T10:45').booked, false);
  assert.equal(slots.find((s) => s.start === '2026-11-16T10:30').booked, true);
});

test('частично пересекающийся слот занят', () => {
  const bookings = [{ slotStart: '2026-11-16T10:30', durationMinutes: 20 }]; // [10:30, 10:50)
  const slots = calendar.slotsForDate(AVAIL, '2026-11-16', bookings, [], 15);
  assert.equal(slots.find((s) => s.start === '2026-11-16T10:45').booked, true); // [10:45,11:00) пересекает
  assert.equal(slots.find((s) => s.start === '2026-11-16T11:00').booked, false);
});

test('бронь без durationMinutes считается 15-минутной', () => {
  const bookings = [{ slotStart: '2026-11-16T10:00' }];
  const slots = calendar.slotsForDate(AVAIL, '2026-11-16', bookings, [], 15);
  assert.equal(slots.find((s) => s.start === '2026-11-16T10:00').booked, true);
  assert.equal(slots.find((s) => s.start === '2026-11-16T10:15').booked, false);
});

test('чужая дата не влияет на занятость', () => {
  const bookings = [{ slotStart: '2026-11-17T10:00', durationMinutes: 60 }]; // вторник
  const slots = calendar.slotsForDate(AVAIL, '2026-11-16', bookings, [], 15);
  assert.equal(slots.every((s) => !s.booked), true);
});

test('слоты вычисляются по 15-минутной сетке: окно 09:00–18:00 даёт 36 слотов', () => {
  const slots = calendar.slotsForDate(AVAIL, '2026-11-16', [], [], 15);
  assert.equal(slots.length, 36);
  assert.equal(slots[0].start, '2026-11-16T09:00');
  assert.equal(slots[slots.length - 1].start, '2026-11-16T17:45');
});

test('isSlotBookable: слот может начинаться в последнем интервале окна (выход за endTime допустим)', () => {
  const ok = calendar.isSlotBookable(AVAIL, '2026-11-16T17:45', [], 15);
  assert.equal(ok, true);
});

test('isSlotBookable: slotStart вне окна — нельзя', () => {
  assert.equal(calendar.isSlotBookable(AVAIL, '2026-11-16T08:45', [], 15), false);
  assert.equal(calendar.isSlotBookable(AVAIL, '2026-11-16T18:00', [], 15), false);
});

test('isSlotBookable: slotStart вне 15-минутной сетки — нельзя', () => {
  assert.equal(calendar.isSlotBookable(AVAIL, '2026-11-16T10:10', [], 15), false);
});

test('isSlotBookable: пересекающаяся бронь блокирует слот', () => {
  const bookings = [{ slotStart: '2026-11-16T10:00', durationMinutes: 60 }];
  assert.equal(calendar.isSlotBookable(AVAIL, '2026-11-16T10:30', bookings, 15), false);
  assert.equal(calendar.isSlotBookable(AVAIL, '2026-11-16T11:00', bookings, 15), true);
});
