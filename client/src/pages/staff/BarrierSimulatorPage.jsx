import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../api/client';
import StaffNav from '../../components/StaffNav';

const AUTO_CLOSE_MS = 10_000;
const POLL_INTERVAL_MS = 2_000;

function gateLabel(g) {
  return `${g.name} - ${g.type === 'entry' ? 'Vào' : 'Ra'}`;
}

export default function BarrierSimulatorPage() {
  const [gates, setGates] = useState([]);
  const [gateId, setGateId] = useState('');
  const [open, setOpen] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const lastEventIdRef = useRef(0);

  useEffect(() => {
    api.get('/gate/list').then(({ data }) => {
      setGates(data.gates);
      if (data.gates[0]) setGateId(String(data.gates[0].id));
    });
  }, []);

  useEffect(() => {
    if (!gateId) return;

    let stopped = false;
    let intervalId = null;

    // Initialise: fetch all existing events to set the cursor WITHOUT opening the barrier.
    // Only events that arrive AFTER this point will trigger an open.
    api
      .get(`/gate/${gateId}/events`, { params: { after: 0 } })
      .then(({ data }) => {
        if (stopped) return;

        // Position cursor at the latest existing event so we skip historical ones.
        const events = data.events ?? [];
        lastEventIdRef.current = events.length > 0 ? events[events.length - 1].id : 0;

        function poll() {
          api
            .get(`/gate/${gateId}/events`, { params: { after: lastEventIdRef.current } })
            .then(({ data: d }) => {
              if (stopped) return;
              for (const event of d.events ?? []) {
                lastEventIdRef.current = event.id;
                setOpen(true);
                setLastEvent(event);
                setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
              }
            })
            .catch(() => {});
        }

        intervalId = setInterval(poll, POLL_INTERVAL_MS);
      })
      .catch(() => {
        lastEventIdRef.current = 0;
      });

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
      // Reset barrier to closed when switching gates
      setOpen(false);
      setLastEvent(null);
    };
  }, [gateId]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <StaffNav />
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
        <h1 className="text-xl font-bold">Barrier Simulator</h1>

        <select
          value={gateId}
          onChange={(e) => setGateId(e.target.value)}
          className="rounded-xl bg-slate-800 border border-slate-700 px-4 py-2.5 text-sm"
        >
          {gates.map((g) => (
            <option key={g.id} value={g.id}>
              {gateLabel(g)}
            </option>
          ))}
        </select>

        <div className="relative w-64 h-40 flex items-center justify-center">
          <div className="absolute bottom-0 w-full h-4 bg-slate-700 rounded" />
          <motion.div
            animate={{ rotate: open ? -75 : 0 }}
            transition={{ type: 'spring', stiffness: 80, damping: 12 }}
            style={{ originX: 0, originY: 1 }}
            className="absolute bottom-4 left-2 w-56 h-3 bg-ueh-orange rounded-full origin-left"
          />
          <div className="absolute bottom-4 left-2 w-4 h-4 bg-slate-500 rounded-full" />
        </div>

        <div
          className={`px-6 py-3 rounded-full font-bold text-sm ${
            open ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-800 text-slate-400'
          }`}
        >
          {open ? 'BARRIER OPEN' : 'BARRIER CLOSED'}
        </div>

        {lastEvent && (
          <div className="text-xs text-slate-400 text-center">
            {lastEvent.manual ? (
              <p>Mở thủ công bởi {lastEvent.openedBy}</p>
            ) : (
              <p>
                {lastEvent.fullName} — Phí {Number(lastEvent.fee).toLocaleString('vi-VN')} đ — Số dư còn{' '}
                {Number(lastEvent.balance).toLocaleString('vi-VN')} đ
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
