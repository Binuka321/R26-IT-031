/**
 * Permission utility for Post-Flood Rescue & Ration Distribution System
 * Centralizes role-based access logic for both navigation and UI actions.
 */

export type UserRole = 'admin' | 'disaster_officer' | 'camp_coordinator' | 'rescue_team' | 'user';

export const Permissions = {
  // Page access check
  canAccessPage: (role: string, page: string): boolean => {
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
  canManageCamps: (role: string) => ['admin', 'disaster_officer', 'camp_coordinator'].includes(role.toLowerCase()),
  canManageSafeZones: (role: string) => ['admin', 'disaster_officer'].includes(role.toLowerCase()),
  canManageResources: (role: string) => ['admin', 'disaster_officer', 'camp_coordinator'].includes(role.toLowerCase()),
  canManageDistributions: (role: string) => ['admin', 'disaster_officer', 'camp_coordinator'].includes(role.toLowerCase()),
  canDeleteData: (role: string) => ['admin'].includes(role.toLowerCase()),
  
  // Advanced features
  canRecalculatePriorities: (role: string) => ['admin', 'disaster_officer'].includes(role.toLowerCase()),
  canPlanRoutes: (role: string) => ['admin', 'disaster_officer'].includes(role.toLowerCase()),
  canViewInternalReports: (role: string) => ['admin', 'disaster_officer'].includes(role.toLowerCase()),
  
  // Helpers
  isAdmin: (role: string) => role.toLowerCase() === 'admin',
  isStaff: (role: string) => ['admin', 'disaster_officer', 'camp_coordinator', 'rescue_team'].includes(role.toLowerCase()),
  isPublicUser: (role: string) => role.toLowerCase() === 'user'
};
