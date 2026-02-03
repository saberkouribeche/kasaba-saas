export const ROLES = {
    ADMIN: 'admin',
    EMPLOYEE: 'employee',
    RESTAURANT: 'restaurant',
    SUPPLIER: 'supplier',
    USER: 'client' // legacy User/Client
};

export const PERMISSIONS = {
    // Admin Actions
    ACCESS_ADMIN_PANEL: 'access_admin_panel',
    MANAGE_USERS: 'manage_users',
    MANAGE_FINANCE: 'manage_finance',
    MANAGE_SETTINGS: 'manage_settings',

    // Employee Actions
    ACCESS_POS: 'access_pos',
    MANAGE_CLIENTS: 'manage_clients',
    MANAGE_SUPPLIERS: 'manage_suppliers',

    // Restaurant Actions
    PLACE_ORDERS: 'place_orders',
    VIEW_OWN_ORDERS: 'view_own_orders',
};

export const ROLE_CAPABILITIES = {
    [ROLES.ADMIN]: [
        PERMISSIONS.ACCESS_ADMIN_PANEL,
        PERMISSIONS.MANAGE_USERS,
        PERMISSIONS.MANAGE_FINANCE,
        PERMISSIONS.MANAGE_SETTINGS,
        PERMISSIONS.ACCESS_POS,
        PERMISSIONS.MANAGE_CLIENTS,
        PERMISSIONS.MANAGE_SUPPLIERS,
        PERMISSIONS.PLACE_ORDERS, // Admin can act as anyone
        PERMISSIONS.VIEW_OWN_ORDERS
    ],
    [ROLES.EMPLOYEE]: [
        PERMISSIONS.ACCESS_ADMIN_PANEL, // Limited access
        PERMISSIONS.ACCESS_POS,
        PERMISSIONS.MANAGE_CLIENTS,
        PERMISSIONS.MANAGE_SUPPLIERS,
    ],
    [ROLES.RESTAURANT]: [
        PERMISSIONS.PLACE_ORDERS,
        PERMISSIONS.VIEW_OWN_ORDERS
    ],
    [ROLES.SUPPLIER]: [
        // Suppliers generally don't log in to this portal yet, but defined for future
    ]
};
