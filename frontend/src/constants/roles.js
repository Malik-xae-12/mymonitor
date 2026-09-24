// Canonical role catalog (mirrors backend roles table ids).
export const ROLES = {
  admin: { id: 'admin', label: 'Administrator', badge: 'bg-[#eff6fc] text-[#0f6cbd] border-[#0f6cbd]/30' },
  l1: { id: 'l1', label: 'L1 Support', badge: 'bg-[#f1faf1] text-[#107c10] border-[#107c10]/30' },
  l2: { id: 'l2', label: 'L2 Support', badge: 'bg-[#fff4ce] text-[#8a6d00] border-[#f2c94c]' },
};

export const ROLE_OPTIONS = [ROLES.admin, ROLES.l1, ROLES.l2];

export function roleLabel(id) {
  return ROLES[id]?.label ?? 'No role';
}

export function roleBadgeClass(id) {
  return ROLES[id]?.badge ?? 'bg-[#f3f2f1] text-[#605e5c] border-[#d1d1d1]';
}
