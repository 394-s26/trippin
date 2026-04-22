# CS394 Agile Software Engineering — Copilot Instructions

This is a React + TypeScript web application built with Vite, using Firebase for backend
services. The tech stack and conventions below are required for all code in this repo.

---

## Tech Stack

- **Framework**: React 23 with React Compiler enabled
- **Language**: TypeScript (strict mode)
- **Build**: Vite
- **Styling**: Tailwind CSS v4
- **Testing**: Vitest + React Testing Library
- **Backend**: Firebase (Authentication + Cloud Firestore)

---

## Code Style

Formatting and linting are enforced by Prettier and ESLint — always ensure code passes
both before considering any task complete. Do not add inline style overrides.

Additional conventions:
- Use `const` by default; `let` only when reassignment is required
- Use `async/await` for all asynchronous code; wrap in `try/catch`
- Use arrow functions for components and callbacks
- Use named exports for all components and utilities
- Let TypeScript infer return types of component functions
- Use TypeScript interfaces and types in `/src/types/`; prefer `interface` for object shapes

### Expected Patterns
- All SVG icons should first be defined in `src/services/svgIcons.tsx` and imported to the relevant place they will be used.
- This site has a permissions system. For each action that a user can perform on a trip (e.g. adding an event, editing a day) that will modify the firebase data, a new permission for that action should be defined as a string in `src/config/permissions.json` and assigned to at least the owner user. If you are creating a new button in the front-end, or creating a new firestore service in `/services`, keep this in mind in your implementation.
- For all overlays, use the pre-defined classes in `src/styles/global.css` to create the overlay background and cards. Use the pre-defined sizing as well. In addition, use createPortal to ensure the overlay remains over top of all elements in the site when open.
- For all user avatar profile pictures, use the `src/components/UserAvatar.tsx` component, along with its predefined sizing.

---

## React Patterns

- All components are functional components using React hooks
- One component per file; filename matches component name (e.g., `UserCard.tsx`)
- Use React Context for shared state; avoid prop drilling beyond two levels
- Use `PropsWithChildren` when a component accepts children
- Navigation bars are required for any app with more than one route
- Keep components small and focused on a single responsibility

---

## Project Structure
```
/src
  /components    # React components, one per file
  /hooks         # Custom React hooks
  /services      # Firebase and external API calls (never in components)
  /tests         # Test cases
  /types         # TypeScript types and interfaces
  /utilities     # Shared pure functions and helpers
/docs            # API specs, user guides, architecture notes
```

All Firebase and network calls go in `/src/services/`. Components must not import
Firebase SDK directly.

---

## Firebase

- Use **Cloud Firestore** for persistent data storage
- Use **Firebase Authentication** with Google Sign-In for user auth
- Wrap Firestore calls in service modules with typed return values
- Handle loading and error states explicitly in any component that fetches data
- For cases where real-time updates are needed to be reflected in the website, use firebase's `onSnapshot` functionality

---

## Testing

- Test files live alongside the component or module they test (`*.test.tsx` / `*.test.ts`)
- Use React Testing Library; query by role, label, or text — not by test ID unless necessary
- Mock all Firebase and network calls with `vi.mock()`
- Import all functions and types explicitly by name in test files
- Tests must pass before any task is considered complete

---

## What to Avoid

- Do not use class components
- Do not call Firebase SDK directly inside React components
- Do not use `any` as a TypeScript type
- Do not use `useEffect` for data that can be derived from existing state
- Do not duplicate logic that belongs in a shared utility or hook