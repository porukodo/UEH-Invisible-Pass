import { insertGateEvent } from '../models/gateEventModel.js';

/**
 * Record a gate event (FR18/19/22) for the Barrier Simulator to pick up
 * by polling GET /api/gate/:gateId/events. `event` is merged into the
 * stored payload so polling clients can distinguish event types.
 */
export async function emitToGate(gateId, event, payload) {
  await insertGateEvent(gateId, { event, ...payload });
}
