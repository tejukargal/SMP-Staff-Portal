# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # TypeScript check + Vite production build (tsc -b && vite build)
npm run lint       # ESLint
npm run preview    # Preview the production build locally
```

There are no tests in this project.

## Architecture Overview

**Stack**: React 19 · TypeScript · Vite · Tailwind CSS v4 · Firebase 11 (Firestore + Auth) · jsPDF · xlsx

Path alias `@/` resolves to `src/`. Firebase config is loaded from `VITE_FIREBASE_*` environment variables (see `src/firebase/config.ts`).

### Auth & Role System

- `src/firebase/auth.ts` wraps Firebase Auth.
- `src/hooks/useAuth.ts` — the single auth hook: listens to Firebase `onAuthStateChanged`, then fetches the user role from Firestore.
- `src/hooks/useRole.ts` — thin wrapper: exposes `{ isAdmin, isViewer }`.
- Two route guards in `src/components/layout/Layout.tsx`:
  - `PrivateRoute` — requires any authenticated user.
  - `AdminRoute` — requires `role === 'admin'`; redirects viewers to `/dashboard`.

**User provisioning flow**: Admin creates a doc at `pendingUsers/{email}` (lowercased). On the new user's first login, `getUserById` (in `src/firebase/firestore.ts`) finds no `users/{uid}` doc, falls back to `pendingUsers/{email}`, copies it to `users/{uid}`, and deletes the pending doc. Subsequent logins resolve directly from `users/{uid}`.

### Firestore Collections

| Collection | Doc ID | Purpose |
|---|---|---|
| `staff` | auto | StaffRecord; ordered by `sl` field |
| `staff/{id}/leaveRecords` | auto | LeaveRecord (subcollection) |
| `staff/{id}/licPolicies` | auto | LicPolicy (subcollection) |
| `users` | Firebase UID | UserRecord with role |
| `pendingUsers` | email (lowercase) | Pre-provisioned users awaiting first login |
| `sanctionedPosts` | `{dept}_{designation}` | Authorised headcount per dept+designation |
| `vacancyEvents` | auto | VacancyEvent (vacancy/fill history) |

All Firestore CRUD is in `src/firebase/firestore.ts`. IndexedDB offline persistence is enabled there.

**Firestore rules** (`firestore.rules`): all authenticated users can read; only admins can write. `users/{uid}` is self-readable and self-creatable.

### Data Flow

- `useStaff` hook (`src/hooks/useStaff.ts`) fetches `getAllStaff()` once on mount and exposes `{ staff, loading, error, refetch }`. Most pages use this hook rather than calling Firestore directly.
- Pages that need both staff and other collections (e.g. `VacancyRegister`, `Dashboard`) call additional Firestore helpers inside their own `useEffect`/`useCallback`.

### Salary Calculation Logic (`src/utils/salaryUtils.ts`)

```
DA amount  = round(basicPay × daPercent / 100)
HRA amount = round(basicPay × hraPercent / 100)
Gross      = basicPay + DA + HRA
Net        = Gross − NPS − PT − otherDed
```

DA and HRA are stored as *percentages* on `StaffRecord` (`da`, `hra` fields). `SalaryBill` page lets users override any cell before printing/exporting; recalculation is performed inline on `handleCellChange`.

### Date of Retirement (DOR) — `src/utils/dateUtils.ts`

Retirement age is 60. **KCSR exception**: if the staff member was born on the 1st of a month, the retirement date is the last day of the *preceding* month at age 60 (not the last day of the birth month).

```ts
computeDOR(dob: string): string  // returns ISO 'yyyy-MM-dd'
```

### Vacancy Register & Promotion Cascade

When a vacancy is filled via `appointmentType === 'PROMOTION'`, `fillVacancyEvent` (in `firestore.ts`) automatically creates a new `VACANT` `vacancyEvent` for the designation the promoted staff vacated (`vacancyReason: 'PROMOTION_CHAIN'`). The original event is updated with a `cascadeEventId` pointer.

Vacancy stats on the Dashboard and VacancyRegister are computed at runtime: `sanctioned − inService` (count of IN SERVICE staff for that dept/designation). The `sanctionedPosts` collection is the source of truth for sanctioned headcount.

### Pages & Routes

| Route | Component | Access |
|---|---|---|
| `/dashboard` | `Dashboard` | All authenticated |
| `/staff` | `StaffList` | All authenticated |
| `/staff/:id` | `StaffProfile` | All authenticated |
| `/salary` | `SalaryBill` | All authenticated |
| `/reports` | `Reports` | All authenticated |
| `/leave-records` | `LeaveRecords` | All authenticated |
| `/lic-policies` | `LicPolicies` | All authenticated |
| `/staff/new`, `/staff/:id/edit` | `StaffForm` | Admin only |
| `/settings` | `Settings` | Admin only |
| `/vacancy-register` | `VacancyRegister` | Admin only |

### Reports & Exports

`Reports` page (`src/pages/Reports.tsx`) offers 7 report tabs: Staff List, Retired Staff, Service Register, Seniority List, By Designation, Contact Directory, DOR List. Each supports filter by dept/type/status/designation/category. Export options: Excel (xlsx), PDF (jsPDF + autotable via `src/utils/reportsPdf.ts`), browser print.

`SalaryBill` exports to Excel via `exportSalaryBillToExcel` and prints via `window.print()`. The print-only `SalaryBillPrint` component is hidden on screen with `no-print` CSS.

### Enums & Constants (`src/constants/enums.ts`)

Central source for `DESIGNATIONS`, `DEPARTMENTS`, `STATUSES`, `PAY_SCALES`, `MONTHS`, `DEPT_COLORS`, and label maps for vacancy reasons and appointment types. Always import from here rather than defining inline.

### UI Components (`src/components/ui/`)

Thin, unstyled-to-styled wrappers: `Button`, `Input`, `Select`, `Modal`, `Toast`, `Badge`, `Table`, `Spinner`. `Toast` exposes a `useToast()` hook — call `showToast('success' | 'error', message)`.

### Settings Page

Admin-only. Manages user list (view roles, promote/demote, add new users via `pendingUsers`). Contains a destructive "Delete All Staff" action gated by a hardcoded passkey (`giri1977`) — use caution.
