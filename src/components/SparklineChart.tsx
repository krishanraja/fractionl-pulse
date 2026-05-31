import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface SparklineChartProps {
  data: number[];
  months: string[];
  color: string;
  /** Optional shared y-domain so multiple sparklines are comparable on one scale. */
  yMin?: number;
  yMax?: number;
}

const SparklineChart = ({ data, months, color, yMin, yMax }: SparklineChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const colorMap: Record<string, string> = {
    'primary': '#6C40FF',
    'accent': '#3B82F6', 
    'secondary': '#8B5CF6'
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          data: data,
          borderColor: colorMap[color] || '#6C40FF',
          backgroundColor: `${colorMap[color] || '#6C40FF'}20`,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            displayColors: false,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#000',
            bodyColor: '#000',
            borderColor: colorMap[color] || '#6C40FF',
            borderWidth: 1,
            cornerRadius: 8,
            caretPadding: 8,
            callbacks: {
              title: (context) => {
                const date = new Date(context[0].label + '-01');
                return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
              },
              label: (context) => `Score: ${context.parsed.y}`
            }
          }
        },
        scales: {
          x: {
            display: false,
            grid: {
              display: false
            }
          },
          y: {
            display: false,
            grid: {
              display: false
            },
            // When a shared domain is supplied, all sparklines render on the same
            // scale so their heights are directly comparable (a flat-but-high
            // series no longer looks as dramatic as a volatile low one).
            min: yMin,
            max: yMax,
          }
        },
        elements: {
          point: {
            hoverRadius: 4
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
  }, [data, months, color, yMin, yMax]);

  return <canvas ref={canvasRef} className="sparkline" />;
};

export default SparklineChart;