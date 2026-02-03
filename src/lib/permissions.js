import { ROLES, ROLE_CAPABILITIES } from "@/constants/roles";

/**
 * Check if a user has a specific role
 * @param {Object} user - The user object from AuthContext
 * @param {string} role - The role to check against (from ROLES constant)
 * @returns {boolean}
 */
export function hasRole(user, role) {
    if (!user || !user.role) return false;
    return user.role === role;
}

/**
 * Check if a user has permission to perform an action
 * @param {Object} user - The user object
 * @param {string} permission - The permission string (from PERMISSIONS constant)
 * @returns {boolean}
 */
export function can(user, permission) {
    if (!user || !user.role) return false;

    // SuperAdmin Override
    if (user.email === 'admin@kasaba.com' || user.role === ROLES.ADMIN) return true;

    const capabilities = ROLE_CAPABILITIES[user.role];
    if (!capabilities) return false;

    return capabilities.includes(permission);
}

/**
 * Check if user is strictly an employee
 */
export function isEmployee(user) {
    return hasRole(user, ROLES.EMPLOYEE);
}

/**
 * Check if user is strictly an admin
 */
export function isAdmin(user) {
    return hasRole(user, ROLES.ADMIN) || user?.email === 'admin@kasaba.com';
}
