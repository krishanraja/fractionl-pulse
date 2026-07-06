import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { useMediaQuery } from '@/hooks/use-mobile';

Chart.register(...registerables);

interface TrendlineChartProps {
  data: {
    months: string[];
    /** Full ISO dates for a real time axis; falls back to months if absent. */
    dates?: string[];
    /** Per-point pipeline confidence (0-1) for honest low-confidence styling. */
    confidence?: number[];
    overall: number[];
    demand: number[];
    supply: (number | null)[];
    culture: number[];
  };
}

const LOW_CONFIDENCE = 0.6;

const TrendlineChart = ({ data }: TrendlineChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const isMobile = useMediaQuery("(max-width: 640px)");

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const mainPt = isMobile ? 3 : 5;
    const subPt = isMobile ? 2 : 3;
    const mainHover = isMobile ? 5 : 7;
    const subHover = isMobile ? 4 : 5;

    // Real ISO dates so irregular reading cadence (daily vs weekly) is drawn to scale
    // on a time axis, instead of forcing every point to equal width and mislabelling
    // daily data as months.
    const iso = data.dates && data.dates.length === data.overall.length
      ? data.dates
      : data.months.map(m => `${m}-01`);
    const conf = data.confidence ?? [];
    const isLowConf = (i: number) => conf.length === iso.length && conf[i] < LOW_CONFIDENCE;
    // {x: ISO date, y} points for the time scale. Typed as any[] because Chart.js's default
    // point type expects a numeric x, while the time scale parses ISO-string x at runtime.
    const toPoints = (series: (number | null)[]): any[] =>
      iso.map((d, i) => ({ x: d, y: series[i] ?? null }));

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Overall FWI',
            data: toPoints(data.overall),
            borderColor: '#7C3AED',
            backgroundColor: 'rgba(124, 58, 237, 0.08)',
            borderWidth: isMobile ? 2.5 : 3,
            fill: true,
            tension: 0.15,
            // Hollow + smaller markers on low-confidence readings so a shaky day
            // reads as shaky rather than authoritative.
            pointBackgroundColor: (c) => (isLowConf(c.dataIndex) ? '#FFFFFF' : '#7C3AED'),
            pointBorderColor: '#7C3AED',
            pointBorderWidth: isMobile ? 1.5 : 2,
            pointRadius: (c) => (isLowConf(c.dataIndex) ? mainPt - 1.5 : mainPt),
            pointHoverRadius: mainHover,
            // Dim + dash the connecting segment when either endpoint is low-confidence.
            segment: {
              borderColor: (s) =>
                isLowConf(s.p0DataIndex) || isLowConf(s.p1DataIndex) ? 'rgba(124,58,237,0.35)' : undefined,
              borderDash: (s) =>
                isLowConf(s.p0DataIndex) || isLowConf(s.p1DataIndex) ? [4, 4] : undefined,
            },
          },
          {
            label: 'Hiring activity',
            data: toPoints(data.demand),
            borderColor: '#3B82F6',
            backgroundColor: 'transparent',
            borderWidth: isMobile ? 1.5 : 2,
            fill: false,
            tension: 0.15,
            pointBackgroundColor: '#3B82F6',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 1,
            pointRadius: subPt,
            pointHoverRadius: subHover,
          },
          {
            label: 'Talent availability',
            data: toPoints(data.supply),
            borderColor: '#8B5CF6',
            backgroundColor: 'transparent',
            borderWidth: isMobile ? 1.5 : 2,
            fill: false,
            tension: 0.15,
            // Never bridge a gap: an unmeasured day stays a break in the line, not a
            // straight slide between two distant readings.
            spanGaps: false,
            pointBackgroundColor: '#8B5CF6',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 1,
            pointRadius: subPt,
            pointHoverRadius: subHover,
            borderDash: [4, 4],
          },
          {
            label: 'Market buzz',
            data: toPoints(data.culture),
            borderColor: '#10B981',
            backgroundColor: 'transparent',
            borderWidth: isMobile ? 1.5 : 2,
            fill: false,
            tension: 0.15,
            pointBackgroundColor: '#10B981',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 1,
            pointRadius: subPt,
            pointHoverRadius: subHover,
            borderDash: [8, 4],
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              padding: isMobile ? 12 : 20,
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                size: isMobile ? 11 : 12,
                family: 'Inter',
                weight: 500,
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            titleColor: '#1e293b',
            bodyColor: '#475569',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            cornerRadius: 10,
            padding: 12,
            caretPadding: 8,
            displayColors: true,
            titleFont: { size: 13, weight: 600, family: 'Inter' },
            bodyFont: { size: 12, family: 'Inter' },
            callbacks: {
              title: (context) => {
                const ts = context[0].parsed.x;
                return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
              },
              label: (context) => `  ${context.dataset.label}: ${context.parsed.y.toFixed(1)}`
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              // Never render below day granularity: a short teaser window (a few
              // recent readings that span under a day) must not fall back to an
              // hour axis (12AM/1PM/2AM), which reads as a bug on a weekly index.
              minUnit: 'day',
              tooltipFormat: 'MMM d, yyyy',
              displayFormats: { day: 'MMM d', week: 'MMM d', month: "MMM ''yy" },
            },
            grid: {
              display: true,
              color: 'rgba(148, 163, 184, 0.08)',
            },
            ticks: {
              font: { size: isMobile ? 10 : 11, family: 'Inter' },
              color: '#94a3b8',
              maxRotation: isMobile ? 45 : 0,
              autoSkip: true,
              maxTicksLimit: isMobile ? 5 : 8,
            },
            border: { display: false },
          },
          y: {
            grid: {
              display: true,
              color: 'rgba(148, 163, 184, 0.08)',
            },
            ticks: {
              font: { size: isMobile ? 10 : 11, family: 'Inter' },
              color: '#94a3b8',
              padding: 8,
            },
            border: { display: false },
            // Fixed 0-100 so the absolute level and band position read honestly
            // and every week is comparable (was clamped to 20-90, which
            // exaggerated moves and misrepresented where a score sits in its band).
            beginAtZero: true,
            min: 0,
            max: 100,
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data, isMobile]);

  return (
    <div className="h-64 sm:h-80">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default TrendlineChart;
