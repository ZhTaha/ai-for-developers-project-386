// API-контракт «Календаря звонков» (Design First)
// Схема описывает REST API, реализуемый в src/server.js.
// Компиляция и генерация клиента: npx @typespec/compiler compile ./typespec

import "@typespec/http";
import "@typespec/rest";

using Http;
using Rest;

/** Тип встречи, созданный владельцем */
model EventType {
  /** Идентификатор */
  id: string;
  /** Название, например «Звонок по проекту» */
  name: string;
  /** Описание встречи */
  description?: string;
  /** Длительность в минутах: 15 | 30 | 60 */
  durationMinutes: int32;
}

/** Расписание доступности владельца */
model Availability {
  /** Дни недели (1 = понедельник ... 7 = воскресенье) */
  weekdays: int32[];
  /** Начало рабочего дня, «HH:MM» */
  startTime: string;
  /** Конец рабочего дня, «HH:MM» */
  endTime: string;
}

/** Бронь на слот */
model Booking {
  id: string;
  /** ISO-начало слота: «2026-11-20T10:00» */
  slotStart: string;
  eventTypeId: string;
  guestName: string;
  guestEmail: string;
  comment?: string;
}

/** Свободный или занятый слот на дату */
model Slot {
  start: string;
  end: string;
  booked: boolean;
}

@route("/api")
namespace CalendarApi {
  @route("event-types")
  interface EventTypes {
    /** Список типов встреч */
    @get list(): EventType[];
    /** Создать тип встречи */
    @post create(@body body: { name: string; description?: string; durationMinutes: int32; }): EventType;
    /** Удалить тип встречи */
    @delete remove(@path id: string): void;
  }

  @route("availability")
  interface AvailabilityApi {
    /** Текущее расписание доступности */
    @get get(): Availability;
    /** Обновить расписание доступности */
    @put update(@body body: Availability): Availability;
  }

  @route("slots")
  interface Slots {
    /** Свободные/занятые слоты на дату YYYY-MM-DD */
    @get list(@query date: string): Slot[];
  }

  @route("bookings")
  interface Bookings {
    /** Все брони (для владельца) */
    @get list(): Booking[];
    /** Записаться на свободный слот (гость) */
    @post create(@body body: { slotStart: string; eventTypeId: string; guestName: string; guestEmail: string; comment?: string; }): Booking;
    /** Отменить бронь — слот освобождается */
    @delete remove(@path id: string): void;
  }
}
