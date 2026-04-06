import permissionsConfig from './permissions.json';

export type TripAction = typeof permissionsConfig.actions[number];
export type Role = keyof typeof permissionsConfig.roles;
export const ROLE_PERMISSIONS = permissionsConfig.roles as Record<Role, TripAction[]>;
