export const SHIFT_REQUEST_STATUS = {
  pending: "pending",
  open: "open",
  claimed: "claimed",
  approved: "approved",
  rejected: "rejected",
};

export function getShiftRequestStatusLabel(status) {
  switch (status) {
    case SHIFT_REQUEST_STATUS.pending:
      return "Pending Review";
    case SHIFT_REQUEST_STATUS.open:
      return "Open Shift";
    case SHIFT_REQUEST_STATUS.claimed:
      return "Claim Pending";
    case SHIFT_REQUEST_STATUS.approved:
      return "Approved";
    case SHIFT_REQUEST_STATUS.rejected:
      return "Rejected";
    default:
      return "Request";
  }
}

export function isShiftRequestActive(status) {
  return [
    SHIFT_REQUEST_STATUS.pending,
    SHIFT_REQUEST_STATUS.open,
    SHIFT_REQUEST_STATUS.claimed,
  ].includes(status);
}

export function isFutureOrToday(ymd) {
  return String(ymd || "") >= new Date().toISOString().slice(0, 10);
}
