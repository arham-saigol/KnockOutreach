const DELIVERY_PRECEDENCE: Record<string, number> = {
  sending: 0,
  send_failed: 0,
  send_unknown: 0,
  sent: 1,
  delivered: 2,
  received: 3,
  rejected: 4,
  bounced: 4,
  complained: 5,
};

export function advanceDeliveryStatus(current: string, incoming: string) {
  const currentRank = DELIVERY_PRECEDENCE[current] ?? -1;
  const incomingRank = DELIVERY_PRECEDENCE[incoming] ?? -1;
  return incomingRank > currentRank ? incoming : current;
}
