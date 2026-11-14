// Хранилище данных: JSON-файл (путь задаётся переменной dataFile()).
// Достаточно для учебного проекта; интерфейс позволяет заменить на БД.

const fs = require('node:fs');
const path = require('node:path');

function dataFile() {
  return process.env.DATA_FILE || path.join(__dirname, '..', 'data.json');
}

const defaults = {
  eventTypes: [
    {
      id: 'intro-call',
      name: 'Знакомство',
      description: 'Короткий звонок для знакомства',
      durationMinutes: 30,
    },
  ],
  availability: { weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' },
  bookings: [],
};

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = { ...defaults, ...JSON.parse(fs.readFileSync(dataFile(), 'utf8')) };
  } catch {
    cache = structuredClone(defaults);
  }
  return cache;
}

function save() {
  fs.writeFileSync(dataFile(), JSON.stringify(cache, null, 2));
}

function reset() {
  cache = null;
  try {
    fs.unlinkSync(dataFile());
  } catch {
    /* файла нет — ок */
  }
}

module.exports = { load, save, reset, dataFile };
