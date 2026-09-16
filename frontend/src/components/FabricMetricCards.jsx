import React from 'react';
import { 
  Layers, 
  CheckCircle2, 
  XCircle, 
  Ban, 
  Clock,
  Sparkles,
  Loader2
} from 'lucide-react';

export default function FabricMetricCards({
  metrics = {},
  statusFilter = 'ALL',
  onStatusFilterChange,
  isFuture = false
}) {
  if (isFuture) {
    const futureCards = [
      { id: 'ALL', label: 'Total Pipelines', count: metrics.total ?? 0, icon: Layers, color: 'neutral' },
      { id: 'SCHEDULED', label: 'Scheduled to Run', count: metrics.scheduled ?? 0, icon: Sparkles, color: 'purple' },
      { id: 'NOT_SCHEDULED', label: 'Not Scheduled', count: metrics.notScheduled ?? 0, icon: Clock, color: 'neutral' }
    ];

    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 select-none">
        {futureCards.map((card) => {
          const isActive = statusFilter === card.id;
          const Icon = card.icon;

          return (
            <button
              key={card.id}
              onClick={() => onStatusFilterChange(card.id)}
              className={`p-3 rounded border text-left transition flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${
                isActive
                  ? 'bg-[#faf5ff] border-[#773adc] ring-1 ring-[#773adc]'
                  : 'bg-[#ffffff] border-[#edebe9] hover:bg-[#faf9f8] hover:border-[#d1d1d1]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded ${
                  card.color === 'purple' ? 'bg-[#f3e8ff] text-[#773adc]' : 'bg-[#f3f2f1] text-[#605e5c]'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-[#605e5c] font-medium">
                    {card.label}
                  </div>
                  <div className="text-base font-bold font-mono text-[#242424] mt-0.5">
                    {card.count}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  const cards = [
    { id: 'ALL', label: 'Total Pipelines', count: metrics.total ?? 0, icon: Layers, color: 'neutral' },
    { id: 'RUNNING', label: 'In Progress', count: metrics.running ?? 0, icon: Loader2, color: 'blue', isSpin: true },
    { id: 'SUCCEEDED', label: 'Completed', count: metrics.succeeded ?? 0, icon: CheckCircle2, color: 'green' },
    { id: 'FAILED', label: 'Failed', count: metrics.failed ?? 0, icon: XCircle, color: 'red' },
    { id: 'CANCELLED', label: 'Cancelled', count: metrics.cancelled ?? 0, icon: Ban, color: 'neutral' },
    { id: 'NO_RUNS', label: 'Not Run', count: metrics.notRun ?? 0, icon: Clock, color: 'neutral' }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 select-none">
      {cards.map((card) => {
        const isActive = statusFilter === card.id;
        const Icon = card.icon;

        let iconColor = 'text-[#605e5c] bg-[#f3f2f1]';
        let activeBorder = 'border-[#0f6cbd] ring-1 ring-[#0f6cbd] bg-[#f8fbff]';

        if (card.color === 'blue') {
          iconColor = 'text-[#0f6cbd] bg-[#eff6fc]';
          activeBorder = 'border-[#0f6cbd] ring-1 ring-[#0f6cbd] bg-[#f8fbff]';
        } else if (card.color === 'green') {
          iconColor = 'text-[#107c41] bg-[#dff6dd]';
          activeBorder = 'border-[#107c41] ring-1 ring-[#107c41] bg-[#f6fbf7]';
        } else if (card.color === 'red') {
          iconColor = 'text-[#c42b1c] bg-[#fde7e9]';
          activeBorder = 'border-[#c42b1c] ring-1 ring-[#c42b1c] bg-[#fdf8f8]';
        }

        return (
          <button
            key={card.id}
            onClick={() => onStatusFilterChange(card.id)}
            className={`p-2.5 rounded border text-left transition flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${
              isActive
                ? activeBorder
                : 'bg-[#ffffff] border-[#edebe9] hover:bg-[#faf9f8] hover:border-[#d1d1d1]'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-[#605e5c] font-normal truncate">
                {card.label}
              </div>
              <div className="text-base font-bold font-mono text-[#242424] mt-0.5">
                {card.count}
              </div>
            </div>

            <div className={`p-1.5 rounded shrink-0 ml-2 ${iconColor}`}>
              <Icon className={`w-3.5 h-3.5 ${card.isSpin && card.count > 0 ? "animate-spin" : ""}`} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
