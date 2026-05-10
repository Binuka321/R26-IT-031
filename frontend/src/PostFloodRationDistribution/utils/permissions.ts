/**
 * Permission utility for Post-Flood Rescue & Ration Distribution System
 * Centralizes role-based access logic for both navigation and UI actions.
 */

export type UserRole = 'admin' | 'disaster_officer' | 'camp_coordinator' | 'rescue_team' | 'user';

export const Permissions = {
  // Page access check
  canAccessPage: (role: string, page: string): boolean => {
    if (!role) return false;
    const r = role.toLowerCase() as UserRole;
    
    const roleMap: Record<UserRole, string[]> = {
      admin: ['dashboard', 'map', 'safe-zones', 'camps', 'camp-priority', 'item-priority', 'resources', 'route-planning', 'distributions', 'reports', 'notifications', 'need-reports'],
      disaster_officer: ['dashboard', 'map', 'safe-zones', 'camps', 'camp-priority', 'item-priority', 'resources', 'route-planning', 'distributions', 'reports', 'notifications', 'need-reports'],
      camp_coordinator: ['dashboard', 'map', 'safe-zones', 'camps', 'resources', 'distributions', 'notifications', 'need-reports'],
      rescue_team: ['dashboard', 'map', 'safe-zones', 'camps', 'distributions', 'notifications', 'need-reports'],
      user: ['user-home', 'map', 'safe-zones', 'camps', 'notifications', 'need-reports']
    };

    return (roleMap[r] || roleMap['user']).includes(page);
  },

  // Management actions
  canManageCamps: (role: string) => role ? ['admin', 'disaster_officer', 'camp_coordinator'].includes(role.toLowerCase()) : false,
  canManageSafeZones: (role: string) => role ? ['admin', 'disaster_officer'].includes(role.toLowerCase()) : false,
  canManageResources: (role: string) => role ? ['admin', 'disaster_officer', 'camp_coordinator'].includes(role.toLowerCase()) : false,
  canManageDistributions: (role: string) => role ? ['admin', 'disaster_officer', 'camp_coordinator'].includes(role.toLowerCase()) : false,
  canDeleteData: (role: string) => role ? ['admin'].includes(role.toLowerCase()) : false,
  
  // Advanced features
  canRecalculatePriorities: (role: string) => role ? ['admin', 'disaster_officer'].includes(role.toLowerCase()) : false,
  canPlanRoutes: (role: string) => role ? ['admin', 'disaster_officer'].includes(role.toLowerCase()) : false,
  canViewInternalReports: (role: string) => role ? ['admin', 'disaster_officer'].includes(role.toLowerCase()) : false,
  
  // Helpers
  isAdmin: (role: string) => role ? role.toLowerCase() === 'admin' : false,
  isStaff: (role: string) => role ? ['admin', 'disaster_officer', 'camp_coordinator', 'rescue_team'].includes(role.toLowerCase()) : false,
  isPublicUser: (role: string) => role ? role.toLowerCase() === 'user' : false
};
