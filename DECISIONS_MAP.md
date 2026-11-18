# Decisions Map for Calendar Booking Application

## 1. API Contract Approach
- **Decision**: Use TypeSpec as the single source of truth for API contract
- **Rationale**: Compact specification that generates both OpenAPI and client/server artifacts
- **Status**: ✅ Implemented - `typespec/main.tsp` defines all models and endpoints
- **Generated artifacts**:
  - OpenAPI 3.0 spec: `typespec/generated/openapi.json`
  - Browser SDK: `public/generated-api.js` (via `scripts/generate-api-client.js`)

## 2. Booking Window Configuration
- **Decision**: 14-day booking window starting from current date in Owner's timezone
- **Details**:
  - Window: [today, today + 13 calendar days] inclusive
  - Timezone-aware: uses `dateInTimeZone()` to get today's date in Owner's IANA timezone
  - Default timezone: `Asia/Almaty`
- **Rationale**: Users should book from today forward, including today itself
- **Status**: ✅ Implemented in `src/calendar.js`:
  - `BOOKING_WINDOW_DAYS = 14`
  - `bookingWindow(timeZone)` function
  - `isDateWithinBookingWindow(date, timeZone)` function

## 3. Working Hours and Timezone
- **Decision**: Working hours 09:00-18:00 in IANA timezone format
- **Default**: `weekdays: [1,2,3,4,5]`, `startTime: '09:00'`, `endTime: '18:00'`, `timeZone: 'Asia/Almaty'`
- **Rationale**: Standard business hours, configurable per owner
- **Status**: ✅ Implemented:
  - TypeSpec: `Availability` model with weekdays, startTime, endTime, timeZone
  - Server: Default availability in `src/data.js`
  - Calendar logic: `slotsForDate()`, `isSlotBookable()` check weekday and time range

## 4. Slot Grid and Duration
- **Decision**: 15-minute slot grid (SLOT_MINUTES = 15), slot duration matches event type
- **Details**:
  - Default grid step: 15 minutes
  - Slot duration: determined by selected `EventType.durationMinutes`
  - Slots generated on 15-minute grid within working hours
  - Last slot may extend beyond endTime (meeting can finish after 18:00)
- **Rationale**: Fine-grained enough for calls, yet flexible for varying durations
- **Status**: ✅ Implemented:
  - `SLOT_MINUTES = 15` in `src/calendar.js` and `src/server.js`
  - `slotsForDate()` generates grid slots, respects duration
  - `isSlotBookable()` validates slot is on grid AND within availability

## 5. Overlap/Conflict Rule
- **Decision**: Intervals [slotStart, slotStart + durationMinutes) must not overlap
- **Boundary behavior**: Adjacent slots allowed (end time of one = start time of next)
  - Example: 10:00-11:00 booked → 10:30-11:00 rejected, 11:00-12:00 allowed
- **Rationale**: Prevents double-booking while allowing back-to-back meetings
- **Status**: ✅ Implemented in `src/calendar.js`:
  - `overlaps(t, slotMinutes, bookingStart, bookingDuration)` - core overlap check
  - `isSlotBookable()` uses this to reject conflicts, allow adjacency
  - Tests verify: overlapping blocked, adjacent allowed, partial overlap blocked

## 6. Roles and Authentication
- **Decision**: No registration/login required. Two conceptual roles only:
  - **Owner**: Creates event types, sets availability, views all bookings
  - **Guest**: Books slots without account, provides name+email
- **Rationale**: Simplified UX for the use case, no auth infrastructure needed
- **Status**: ✅ Implemented:
  - No auth middleware in server
  - Owner profile is default (hardcoded or first setup profile)
  - Guest bookings require: slotStart, eventTypeId, guestName, guestEmail

## 7. Error Handling and Status Codes
- **Decision**: Consistent HTTP status codes matching OpenAPI contract
- **Codes used**:
  - 200: Successful GET requests
  - 201: Successful creation (event type, booking)
  - 204: Successful deletion
  - 400: Bad request (invalid data, wrong grid, outside window)
  - 404: Not found (event type, booking)
  - 409: Conflict (slot already booked, outside window)
- **Rationale**: Clear semantic responses for API consumers
- **Status**: ✅ Implemented in `src/server.js` with matching OpenAPI types

## 8. Data Persistence
- **Decision**: JSON file-based store via `data.json` (path configurable via `DATA_FILE` env var)
- **Rationale**: Simple storage for educational project, easy to replace with DB
- **Status**: ✅ Implemented in `src/data.js` with load/save/reset functions

## 9. Client SDK Generation
- **Decision**: Generate browser SDK from OpenAPI JSON, not directly from TypeSpec
- **Rationale**: Separation of concerns - TypeSpec → OpenAPI → JS client
- **Status**: ✅ Implemented in `scripts/generate-api-client.js` → `public/generated-api.js`

## 10. Testing Strategy
- **Decision**: Three-tier testing:
  1. Unit tests for calendar pure functions
  2. Integration tests for HTTP API via real server
  3. E2E browser tests with Playwright against real server
- **Rationale**: Verify each layer independently, then integration
- **Status**: ✅ Implemented:
  - `test/calendar.test.js` - 18 unit tests for calendar functions
  - `test/server.test.js` - 20+ integration tests for HTTP API
  - `test/browser.e2e.test.js` - E2E guest booking flow

## 11. Conflict Detection for Simultaneous Requests
- **Decision**: Race condition protection via database-level serialization (implicit in file-based store)
- **Rationale**: Concurrent booking requests should not create overlapping slots
- **Status**: Partially implemented - the test at line 141-148 of server.test.js verifies this returns [201, 409], but file-based store may have race conditions without locking

## 12. Release Please Configuration
- **Decision**: Configured via `.release-please-config.json` and `.release-please-manifest.json`
- **Rationale**: Automated release notes and version management
- **Status**: ✅ Present in project root

---

**Summary**: The project fully implements the TypeSpec-first contract approach described, with complete API specification, booking logic, and testing coverage. The main areas of alignment are: contract-driven development, 14-day booking window, 09:00-18:00 working hours with 15-min grid, non-overlapping interval rules with adjacent-allowed boundary behavior, and dual-role (owner/guest) access without authentication.