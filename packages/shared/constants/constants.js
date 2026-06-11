export const ROLES = {
    ADMIN: 'admin',
    ORGANIZER: 'organizer',
    TEAM: 'team',
    PARTICIPANT: 'participant'
};

export const PUBLIC_ROLES = [ROLES.ORGANIZER, ROLES.TEAM, ROLES.PARTICIPANT];
export const ALL_ROLES = Object.values(ROLES);