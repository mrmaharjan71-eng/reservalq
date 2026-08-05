# Editable room specifications & services

Owners and managers get an in-app editor for room categories and individual rooms, instead of the current read-only rate table.

## What changes on the Rooms page

1. **Room categories (specifications & services)** — the existing "Rate plan" panel becomes editable:
   - Edit name, description, base rate (NPR), and max occupancy inline.
   - Manage the services/amenities list per category: add a service, remove a service (chips with an x).
   - "Add category" form to create a new room category (code, name, description, rate, occupancy, services).
2. **Individual rooms** — each room card gains an "Edit" action for its own details: room number, floor, category, active/inactive, and a free-text notes field for room-specific specification (e.g. "corner unit, garden view").
3. Every save writes an audit-log entry, shows a toast, and refreshes the room and category lists.

## Who can do what

No database changes are needed — the existing access rules already cover this:
- Owner, admin and front desk manager can create and edit categories and rooms.
- Housekeeping and maintenance keep their existing ability to change room condition only.
- Other staff continue to see the data read-only; edit controls are hidden for them.

Guest-facing screens (booking page and concierge) automatically reflect the updated specs and services, since they read the same catalogue.

## Technical notes

- `src/routes/_authenticated/rooms.tsx`: add TanStack Query mutations against `room_types` and `rooms` via the browser Supabase client, reusing `logAudit`, `Panel`, `Badge`, `inputClass`.
- Add a `userRolesQuery` (read own roles from `user_roles`) in `src/lib/hotel-data.ts` to gate the edit UI client-side; RLS remains the real enforcement.
- Amenities stay a `text[]` column; the editor sends the whole array on save.
- Validate with zod before writing: non-empty name, rate >= 0, occupancy 1-10, service labels trimmed and <= 40 chars.