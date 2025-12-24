import React from 'react';

interface ChartData {
  label: string;
  value: number;
}

interface BarChartProps {
  data: ChartData[];
  title: string;
  formatValue: (value: number) => string;
}

const BarChart: React.FC<BarChartProps> = ({ data, title, formatValue }) => {
  const chartHeight = 250;
  const chartWidth = 500;
  const barMargin = 5;
  const barWidth = data.length > 0 ? (chartWidth - (data.length - 1) * barMargin) / data.length : 0;
  
  const maxValue = Math.max(...data.map(d => d.value), 0);
  
  // To prevent division by zero if all values are 0
  const effectiveMaxValue = maxValue === 0 ? 1 : maxValue;

  return (
    <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
      <h3 className="text-lg font-semibold text-card-foreground mb-4">{title}</h3>
      {data.length > 0 ? (
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="auto" aria-labelledby="title" role="img">
          <title id="title">{title}</title>
          {data.map((d, i) => {
            const barHeight = (d.value / effectiveMaxValue) * (chartHeight - 30); // Leave space for labels
            const x = i * (barWidth + barMargin);
            const y = chartHeight - barHeight - 20; // Y starts from top, leave space for x-axis labels
            return (
              <g key={d.label} className="group">
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="var(--color-primary)"
                  className="transition-opacity opacity-80 group-hover:opacity-100"
                />
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--color-primary)"
                  className="opacity-0 group-hover:opacity-100 transition-opacity font-semibold"
                >
                  {formatValue(d.value)}
                </text>
                 <text
                  x={x + barWidth / 2}
                  y={chartHeight - 5}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--color-muted-foreground)"
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
         <div className="h-[250px] flex items-center justify-center">
            <p className="text-muted-foreground">Không có dữ liệu để hiển thị.</p>
        </div>
      )}
    </div>
  );
};

export default BarChart;
