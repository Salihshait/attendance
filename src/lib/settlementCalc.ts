// Mirrors the `final_settlement_amount` generated column in
// exit_settlements (0027_exit_extras.sql) exactly, so the HR settlement
// form can show a live total before saving. Keep these two in sync if the
// formula ever changes.

export interface SettlementInputs {
  pendingSalary: number;
  leaveEncashment: number;
  bonus: number;
  otherAdjustments: number;
  noticePay: number;
  deductions: number;
}

export function calculateFinalSettlement(input: SettlementInputs): number {
  return (
    input.pendingSalary +
    input.leaveEncashment +
    input.bonus +
    input.otherAdjustments -
    input.noticePay -
    input.deductions
  );
}
