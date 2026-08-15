// This is a single-tenant demo deployment and organization_id isn't exposed
// on the auth session (see AuthProvider.tsx's loadEmployeeProfile select) —
// existing modules each hardcode this same literal locally (e.g. ORG_ID in
// LeaveRequestForm.tsx, ResignationEntryPage.tsx). The Admin module's hooks
// share one copy here instead of repeating the literal across ~10 files.
export const ORG_ID = '11111111-1111-1111-1111-111111111111';
