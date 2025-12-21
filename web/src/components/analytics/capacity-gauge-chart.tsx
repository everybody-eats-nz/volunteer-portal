"use client";

import { RadialBarChart, RadialBar, Legend, ResponsiveContainer } from "recharts";

interface CapacityUtilization {
  averageFillRate: number;
  underutilizedShifts: number;
  fullShifts: number;
  oversubscribed: number;
}

interface CapacityGaugeChartProps {
  data: CapacityUtilization;
}

export function CapacityGaugeChart({ data }: CapacityGaugeChartProps) {
  if (!data || data.averageFillRate === undefined) {
    return (
      <div className="h-80 flex items-center justify-center text-muted-foreground">
        No capacity data available
      </div>
    );
  }

  const fillRate = data.averageFillRate;
  const getColor = (rate: number) => {
    if (rate >= 80) return "hsl(var(--chart-1))"; // Green
    if (rate >= 50) return "hsl(var(--chart-2))"; // Yellow
    return "hsl(var(--chart-4))"; // Red
  };

  const chartData = [
    {
      name: "Fill Rate",
      value: fillRate,
      fill: getColor(fillRate),
    },
  ];

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="60%"
          outerRadius="100%"
          barSize={40}
          data={chartData}
          startAngle={180}
          endAngle={0}
        >
          <RadialBar
            background
            dataKey="value"
            cornerRadius={10}
          />
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-4xl font-bold"
          >
            {fillRate}%
          </text>
          <text
            x="50%"
            y="60%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-sm"
          >
            Average Fill Rate
          </text>
        </RadialBarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-chart-4">
            {data.underutilizedShifts}
          </div>
          <div className="text-xs text-muted-foreground">
            Underutilized (&lt;50%)
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-chart-1">
            {data.fullShifts}
          </div>
          <div className="text-xs text-muted-foreground">Full (100%)</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-chart-2">
            {data.oversubscribed}
          </div>
          <div className="text-xs text-muted-foreground">Oversubscribed</div>
        </div>
      </div>
    </div>
  );
}
