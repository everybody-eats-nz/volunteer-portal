"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface GradeDistribution {
  GREEN: number;
  YELLOW: number;
  PINK: number;
}

interface VolunteerGradePieChartProps {
  data: GradeDistribution;
}

const COLORS = {
  GREEN: "#22c55e", // green-500
  YELLOW: "#eab308", // yellow-500
  PINK: "#ec4899", // pink-500
};

export function VolunteerGradePieChart({ data }: VolunteerGradePieChartProps) {
  if (!data || (data.GREEN === 0 && data.YELLOW === 0 && data.PINK === 0)) {
    return (
      <div className="h-80 flex items-center justify-center text-muted-foreground">
        No volunteer grade data available
      </div>
    );
  }

  const chartData = [
    { name: "Green", value: data.GREEN, color: COLORS.GREEN },
    { name: "Yellow", value: data.YELLOW, color: COLORS.YELLOW },
    { name: "Pink", value: data.PINK, color: COLORS.PINK },
  ].filter((item) => item.value > 0);

  const total = data.GREEN + data.YELLOW + data.PINK;

  const renderLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        className="font-semibold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold" style={{ color: COLORS.GREEN }}>
            {data.GREEN}
          </div>
          <div className="text-xs text-muted-foreground">
            Green ({total > 0 ? Math.round((data.GREEN / total) * 100) : 0}%)
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold" style={{ color: COLORS.YELLOW }}>
            {data.YELLOW}
          </div>
          <div className="text-xs text-muted-foreground">
            Yellow ({total > 0 ? Math.round((data.YELLOW / total) * 100) : 0}%)
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold" style={{ color: COLORS.PINK }}>
            {data.PINK}
          </div>
          <div className="text-xs text-muted-foreground">
            Pink ({total > 0 ? Math.round((data.PINK / total) * 100) : 0}%)
          </div>
        </div>
      </div>
    </div>
  );
}
