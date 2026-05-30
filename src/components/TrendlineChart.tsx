import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { useMediaQuery } from '@/hooks/use-mobile';

Chart.register(...registerables);

interface TrendlineChartProps {
  data: {
    months: string[];
    overall: number[];
    demand: number[];
    supply: number[];
    culture: number[];
  };
}

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

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.months.map(month => {
          const date = new Date(month + '-01');
          return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        }),
        datasets: [
          {
            label: 'Overall FWI',
            data: data.overall,
            borderColor: '#7C3AED',
            backgroundColor: 'rgba(124, 58, 237, 0.08)',
            borderWidth: isMobile ? 2.5 : 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#7C3AED',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: isMobile ? 1.5 : 2,
            pointRadius: mainPt,
            pointHoverRadius: mainHover,
          },
          {
            label: 'Demand',
            data: data.demand,
            borderColor: '#3B82F6',
            backgroundColor: 'transparent',
            borderWidth: isMobile ? 1.5 : 2,
            fill: false,
            tension: 0.35,
            pointBackgroundColor: '#3B82F6',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 1,
            pointRadius: subPt,
            pointHoverRadius: subHover,
          },
          {
            label: 'Supply',
            data: data.supply,
            borderColor: '#8B5CF6',
            backgroundColor: 'transparent',
            borderWidth: isMobile ? 1.5 : 2,
            fill: false,
            tension: 0.35,
            pointBackgroundColor: '#8B5CF6',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 1,
            pointRadius: subPt,
            pointHoverRadius: subHover,
            borderDash: [4, 4],
          },
          {
            label: 'Culture',
            data: data.culture,
            borderColor: '#10B981',
            backgroundColor: 'transparent',
            borderWidth: isMobile ? 1.5 : 2,
            fill: false,
            tension: 0.35,
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
                const monthIndex = context[0].dataIndex;
                const date = new Date(data.months[monthIndex] + '-01');
                return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              },
              label: (context) => `  ${context.dataset.label}: ${context.parsed.y.toFixed(1)}`
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: true,
              color: 'rgba(148, 163, 184, 0.08)',
            },
            ticks: {
              font: { size: isMobile ? 10 : 11, family: 'Inter' },
              color: '#94a3b8',
              maxRotation: isMobile ? 45 : 0,
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
            beginAtZero: false,
            min: 20,
            max: 90,
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
