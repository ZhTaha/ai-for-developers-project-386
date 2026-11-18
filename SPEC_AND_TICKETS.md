# Specification and Tickets for Calendar Booking Application

## Specification Summary

Based on the TypeSpec contract (`typespec/main.tsp`) and generated OpenAPI (`typespec/generated/openapi.json`), the application provides:

### API Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/api/event-types` | GET | List all event types |
| `/api/event-types` | POST | Create new event type |
| `/api/event-types/{id}` | DELETE | Remove event type |
| `/api/availability` | GET | Get working hours configuration |
| `/api/availability` | PUT | Update working hours |
| `/api/slots` | GET | List available slots for a date and event type |
| `/api/bookings` | GET | List all bookings |
| `/api/bookings` | POST | Create a new booking |
| `/api/bookings/{id}` | DELETE | Cancel a booking |

### Models

- **EventType**: id, name, description, durationMinutes
- **Availability**: weekdays[], startTime, endTime, timeZone
- **Booking**: id, slotStart, durationMinutes, eventTypeId, guestName, guestEmail, comment
- **Slot**: start, end, booked

### Key Rules
1. **14-day booking window**: From current date in Owner's timezone, inclusive
2. **Working hours**: 09:00-18:00 in Owner's IANA timezone (configurable)
3. **15-minute slot grid**: All start times on 15-minute boundaries
4. **No overlapping intervals**: Adjacent allowed (end = start of next)
5. **Slot duration**: Matches selected EventType.durationMinutes
6. **Owner role**: Creates event types, configures availability, views all bookings
7. **Guest role**: Books slots without authentication, provides name+email

## Tickets

### Ticket 1: Contract Chain - List Event Types
- **Status**: ✅ Ready (implementation exists)
- **Description**: Test the full contract chain: TypeSpec → OpenAPI → Generated SDK → Server → API Response
- **Dependencies**: None (base contract)
- **Checks**:
  - TypeSpec compilation: `mise run contract`
  - OpenAPI generation: verified via `typespec/generated/openapi.json`
  - SDK availability: `GET /generated-api.js` returns `CalendarApiClient` class
  - API response: `GET /api/event-types` returns array with id, name, description, durationMinutes
  - Browser page: `/` contains link to `/book`, `/book` contains SDK script reference
- **Blocking**: None (first ticket)
- **Acceptance**: All checks pass with `mise run check`

### Ticket 2: Contract Chain - Create Event Type
- **Status**: ✅ Ready
- **Description**: Create event type through full chain, verify type persistence and SDK update
- **Dependencies**: Ticket 1 (event types list must work first)
- **Checks**:
  - POST /api/event-types creates new type with required fields
  - Validation rejects invalid data (empty name, negative duration)
  - Generated SDK includes `createEventType` method
  - Response matches EventType schema (id, name, description, durationMinutes required)
- **Blocking**: Ticket 1

### Ticket 3: Contract Chain - Availability Management
- **Status**: ✅ Ready
- **Description**: Owner configures working hours and timezone, slots reflect changes
- **Dependencies**: Ticket 1 (event types available)
- **Checks**:
  - PUT /api/availability updates weekdays, startTime, endTime, timeZone
  - Validation rejects invalid timezones and startTime >= endTime
  - Slot availability changes reflect new working hours
  - Off-day (weekend) slots return empty list
- **Blocking**: Ticket 1

### Ticket 4: Contract Chain - Slot Lookup
- **Status**: ✅ Ready
- **Description**: Query available slots for a date and event type, verify window and grid rules
- **Dependencies**: Ticket 1, 2 (event types exist), Ticket 3 (availability configured)
- **Checks**:
  - GET /api/slots?date=YYYY-MM-DD&eventTypeId= returns slots array
  - Slots only within 14-day window (outside returns 409)
  - Slots only on 15-minute grid (off-grid returns 400)
  - Slots only on configured working days (weekend returns empty)
  - Slots only within working hours (before 09:00 or after 18:00 returns 409/empty)
  - Last slot may extend beyond 18:00 if duration carries over
- **Blocking**: Ticket 1, 3

### Ticket 5: Contract Chain - Create Booking (Guest)
- **Status**: ✅ Ready
- **Description**: Guest books a slot, validates all rules (grid, window, availability, conflict)
- **Dependencies**: Ticket 1, 2, 3, 4 (event types, availability, slots exist)
- **Checks**:
  - POST /api/bookings with valid data returns 201
  - Booking includes durationMinutes from selected event type
  - Off-grid slotStart returns 400
  - Outside 14-day window returns 409
  - Outside working hours returns 409
  - Conflicting slot returns 409
  - Adjacent slot (end = start) returns 201
  - Overlapping slot returns 409
  - Booking stored with guestName, guestEmail, slotStart, eventTypeId
- **Blocking**: Ticket 1, 3, 4

### Ticket 6: Contract Chain - List Bookings
- **Status**: ✅ Ready
- **Description**: Owner views all bookings, verify booking data structure
- **Dependencies**: Ticket 1
- **Checks**:
  - GET /api/bookings returns array of booking objects
  - Each booking has: id, slotStart, eventTypeId, guestName, guestEmail, comment, durationMinutes
  - Bookings created in Ticket 5 appear in list

### Ticket 7: Contract Chain - Cancel Booking
- **Status**: ✅ Ready
- **Description**: Owner cancels a booking, slot becomes available again
- **Dependencies**: Ticket 6
- **Checks**:
  - DELETE /api/bookings/{id} returns 204
  - Slot previously booked becomes available in subsequent slot queries
  - Owner booking list no longer includes cancelled booking

### Ticket 8: Browser E2E - Guest Booking Flow
- **Status**: ✅ Ready
- **Description**: Full browser flow: guest views event types, selects slot, books, confirms
- **Dependencies**: Ticket 1, 5 (server running, bookable slots exist)
- **Checks**:
  - Page loads at `/` with "Записать" link
  - Navigate to `/book` page
  - Guest sees event type options with names/descriptions
  - Calendar shows slots within 14-day window
  - Selecting a slot enables confirm button
  - Filling name/email and clicking "Записаться" shows confirmation
  - After reload, selected slot is disabled
- **Blocking**: Ticket 1, 5

### Ticket 9: Regression - Booking Conflict Rule
- **Status**: ✅ Ready
- **Description**: Verify non-overlapping interval rule with mutation test
- **Dependencies**: Ticket 5 (booking creation works)
- **Checks**:
  - `node scripts/verify-booking-rule.js` detects if overlap rule is broken
  - Mutation testing replaces overlap check with `return true`
  - Tests should detect the mutation and fail (indicating rule is tested)
  - Core rule: `return !intervals.some((iv) => overlaps(...))` remains intact

### Ticket 10: Release Please Setup
- **Status**: ✅ Ready
- **Description**: Configure automated release notes and version bumping
- **Dependencies**: All preceding tickets
- **Checks**:
  - `.release-please-config.json` configured
  - `.release-please-manifest.json` present
  - `mise run check` includes release-please verification
  - First release triggered after Ticket 1 completion

## Test Commands Summary

| Purpose | Command |
|---------|---------|
| Unit tests (calendar functions) | `node --test test/calendar.test.js` |
| Integration tests (HTTP API) | `node --test test/server.test.js` |
| E2E browser tests | `playwright test` |
| All checks | `mise run check` |
| Contract generation | `mise run contract` |
| Full generation | `mise run generate` |
| Mutation test (conflict rule) | `node scripts/verify-booking-rule.js` |

---

**Note**: All tickets are vertically sliced through the full stack: contract (TypeSpec/OpenAPI) → generated SDK → server implementation → HTTP API → interface/browser. Dependencies flow naturally: Ticket 1 is foundation, subsequent tickets build upon it.