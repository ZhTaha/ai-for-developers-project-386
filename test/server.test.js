// Интеграционные тесты API. Запуск: node --test test/

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { start } = require('../src/server');
const store = require('../src/data');

let baseUrl;

beforeEach(async () => {
  // изолированное хранилище для каждого теста
  process.env.DATA_FILE = path.join(os.tmpdir(), `calendar-test-${Date.now()}-${Math.random()}.json`);
  store.reset();
  const server = await start(0);
  baseUrl = `http://localhost:${server.address().port}`;
  return async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  };
});

test('GET /api/event-types возвращает тип по умолчанию', async () => {
  const res = await fetch(`${baseUrl}/api/event-types`);
  assert.equal(res.status, 200);
  const types = await res.json();
  assert.ok(types.some((t) => t.name === 'Знакомство'));
});

test('POST /api/event-types создаёт тип встречи', async () => {
  const res = await fetch(`${baseUrl}/api/event-types`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Звонок по проекту', durationMinutes: 60 }),
  });
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.name, 'Звонок по проекту');
  assert.equal(created.durationMinutes, 60);
});

test('POST /api/event-types валидирует входные данные', async () => {
  const res = await fetch(`${baseUrl}/api/event-types`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '', durationMinutes: -5 }),
  });
  assert.equal(res.status, 400);
});

test('GET /api/slots считает слоты по расписанию и дню недели', async () => {
  // 2026-11-16 — понедельник, 09:00–18:00, сетка 15 мин => 36 слотов
  const res = await fetch(`${baseUrl}/api/slots?date=2026-11-16`);
  assert.equal(res.status, 200);
  const slots = await res.json();
  assert.equal(slots.length, 36);
  assert.equal(slots[0].start, '2026-11-16T09:00');
  assert.equal(slots[0].booked, false);
});

test('GET /api/slots возвращает пустой список в нерабочий день', async () => {
  // 2026-11-15 — воскресенье
  const res = await fetch(`${baseUrl}/api/slots?date=2026-11-15`);
  const slots = await res.json();
  assert.equal(slots.length, 0);
});

test('GET /api/slots отклоняет неверную дату', async () => {
  const res = await fetch(`${baseUrl}/api/slots?date=неверно`);
  assert.equal(res.status, 400);
});

test('старая бронь без durationMinutes читается как 15-минутная', async (t) => {
  // подсадим файл хранилища со «старой» бронью без durationMinutes
  const fs = require('node:fs');
  const oldDb = {
    eventTypes: [{ id: 'old-type', name: 'Старый тип', durationMinutes: 60 }],
    availability: { weekdays: [1], startTime: '09:00', endTime: '18:00' },
    bookings: [
      { id: 'old-booking', slotStart: '2026-11-16T10:00', eventTypeId: 'old-type', guestName: 'Старый гость', guestEmail: 'old@example.com' },
    ],
  };
  fs.writeFileSync(process.env.DATA_FILE, JSON.stringify(oldDb));

  const res = await fetch(`${baseUrl}/api/bookings`);
  assert.equal(res.status, 200);
  const bookings = await res.json();
  const old = bookings.find((b) => b.id === 'old-booking');
  assert.equal(old.durationMinutes, 15);
});

test('60-минутная бронь блокирует все пересекающиеся 15-минутные слоты', async () => {
  const types = await (await fetch(`${baseUrl}/api/event-types`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Час', durationMinutes: 60 }),
  })).json();
  const res = await fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slotStart: '2026-11-16T10:00', eventTypeId: types.id, guestName: 'Гость', guestEmail: 'g@example.com' }),
  });
  assert.equal(res.status, 201);
  const booking = await res.json();
  assert.equal(booking.durationMinutes, 60);

  const slots = await (await fetch(`${baseUrl}/api/slots?date=2026-11-16`)).json();
  const busy = slots.filter((s) => s.booked).map((s) => s.start);
  assert.deepEqual(busy, ['2026-11-16T10:00', '2026-11-16T10:15', '2026-11-16T10:30', '2026-11-16T10:45']);
  // примыкающий вплотную слот свободен
  assert.equal(slots.find((s) => s.start === '2026-11-16T11:00').booked, false);
});

test('отмена брони освобождает все её слоты', async () => {
  const types = await (await fetch(`${baseUrl}/api/event-types`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Час', durationMinutes: 60 }),
  })).json();
  const booking = await (
    await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotStart: '2026-11-16T10:00', eventTypeId: types.id, guestName: 'Г', guestEmail: 'g@example.com' }),
    })
  ).json();

  const del = await fetch(`${baseUrl}/api/bookings/${booking.id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);

  const slots = await (await fetch(`${baseUrl}/api/slots?date=2026-11-16`)).json();
  assert.equal(slots.every((s) => !s.booked), true);
});

test('slotStart вне 15-минутной сетки отклоняется с 400', async () => {
  const types = await (await fetch(`${baseUrl}/api/event-types`)).json();
  const res = await fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slotStart: '2026-11-16T10:10', eventTypeId: types[0].id, guestName: 'Г', guestEmail: 'g@example.com' }),
  });
  assert.equal(res.status, 400);
});

test('встреча может начинаться в последнем интервале окна (выход за endTime)', async () => {
  const types = await (await fetch(`${baseUrl}/api/event-types`)).json();
  const res = await fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slotStart: '2026-11-16T17:45', eventTypeId: types[0].id, guestName: 'Г', guestEmail: 'g@example.com' }),
  });
  assert.equal(res.status, 201);
});

test('гость может записаться на свободный слот', async () => {
  const types = await (await fetch(`${baseUrl}/api/event-types`)).json();
  const res = await fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slotStart: '2026-11-16T10:00',
      eventTypeId: types[0].id,
      guestName: 'Гость',
      guestEmail: 'guest@example.com',
    }),
  });
  assert.equal(res.status, 201);
  const booking = await res.json();
  assert.equal(booking.guestName, 'Гость');

  // слот стал занятым
  const slots = await (await fetch(`${baseUrl}/api/slots?date=2026-11-16`)).json();
  const slot = slots.find((s) => s.start === '2026-11-16T10:00');
  assert.equal(slot.booked, true);
});

test('повторное бронирование того же слота запрещено (409)', async () => {
  const types = await (await fetch(`${baseUrl}/api/event-types`)).json();
  const body = JSON.stringify({
    slotStart: '2026-11-16T10:00',
    eventTypeId: types[0].id,
    guestName: 'Первый',
    guestEmail: 'a@example.com',
  });
  await fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const res = await fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slotStart: '2026-11-16T10:00',
      eventTypeId: types[0].id,
      guestName: 'Второй',
      guestEmail: 'b@example.com',
    }),
  });
  assert.equal(res.status, 409);
});

test('нельзя бронировать слот вне расписания', async () => {
  const types = await (await fetch(`${baseUrl}/api/event-types`)).json();
  const res = await fetch(`${baseUrl}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slotStart: '2026-11-16T07:00', // раньше 09:00
      eventTypeId: types[0].id,
      guestName: 'Гость',
      guestEmail: 'g@example.com',
    }),
  });
  assert.equal(res.status, 409);
});

test('владелец видит брони и может отменить — слот освобождается', async () => {
  const types = await (await fetch(`${baseUrl}/api/event-types`)).json();
  const booking = await (
    await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotStart: '2026-11-16T11:00',
        eventTypeId: types[0].id,
        guestName: 'Гость',
        guestEmail: 'g@example.com',
      }),
    })
  ).json();

  const list = await (await fetch(`${baseUrl}/api/bookings`)).json();
  assert.equal(list.length, 1);

  const del = await fetch(`${baseUrl}/api/bookings/${booking.id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);

  const slots = await (await fetch(`${baseUrl}/api/slots?date=2026-11-16`)).json();
  assert.equal(slots.find((s) => s.start === '2026-11-16T11:00').booked, false);
});

test('PUT /api/availability обновляет расписание', async () => {
  const res = await fetch(`${baseUrl}/api/availability`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ weekdays: [6], startTime: '12:00', endTime: '14:00' }),
  });
  assert.equal(res.status, 200);

  // суббота 2026-11-14, 12:00–14:00 => 8 слотов по 15 минут
  const slots = await (await fetch(`${baseUrl}/api/slots?date=2026-11-14`)).json();
  assert.equal(slots.length, 8);
});

test('статический фронтенд отдаётся на /', async () => {
  const res = await fetch(baseUrl);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Календарь звонков/);
});
