import type { Profile, Role } from '@/lib/database.types';

export type OnboardingStep = 'role_details' | 'done';

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export function isSkipperProfileReady(profile: Profile) {
  return profile.zones.length > 0 && profile.boat_types.length > 0 && hasText(profile.bio);
}

export function isOwnerProfileReady(profile: Profile) {
  return hasText(profile.phone);
}

export function isBrokerProfileReady(profile: Profile) {
  return hasText(profile.phone) && hasText(profile.company_name) && profile.fleet_size !== null;
}

export function isRoleProfileReady(profile: Profile) {
  if (profile.role === 'skipper') return isSkipperProfileReady(profile);
  if (profile.role === 'owner') return isOwnerProfileReady(profile);
  if (profile.role === 'broker' || profile.role === 'charter_company') return isBrokerProfileReady(profile);
  return true;
}

export function onboardingRequired(profile: Profile) {
  return profile.onboarding_step !== null && profile.onboarding_completed_at === null;
}

export function dashboardHrefForRole(role: Role) {
  if (role === 'skipper') return '/dashboard/skipper';
  if (role === 'admin') return '/dashboard/admin';
  return '/dashboard/demandeur';
}

export function missingRoleFields(profile: Profile) {
  if (profile.role === 'skipper') {
    return [
      ...(profile.zones.length === 0 ? ['Ajouter au moins une zone'] : []),
      ...(profile.boat_types.length === 0 ? ['Ajouter au moins un type de bateau'] : []),
      ...(!hasText(profile.bio) ? ['Ajouter une bio courte'] : []),
    ];
  }

  if (profile.role === 'owner') {
    return [...(!hasText(profile.phone) ? ['Ajouter un telephone'] : [])];
  }

  if (profile.role === 'broker' || profile.role === 'charter_company') {
    return [
      ...(!hasText(profile.phone) ? ['Ajouter un telephone'] : []),
      ...(!hasText(profile.company_name) ? ['Ajouter le nom de la societe'] : []),
      ...(profile.fleet_size === null ? ['Ajouter la taille de flotte'] : []),
    ];
  }

  return [];
}
