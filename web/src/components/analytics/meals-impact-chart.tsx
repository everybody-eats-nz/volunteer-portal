"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MealsTrendData {
  date: string;
  location: string;
  mealsServed: number;
}

interface MealsImpactChartProps {
  data: MealsTrendData[];
}

export function MealsImpactChart({ data }: MealsImpactChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-muted-foreground">
        No meals data available for the selected period
      </div>
    );
  }

  // Group by date if there are multiple locations
  const groupedData = data.reduce((acc, item) => {
    const existing = acc.find((d) => d.date === item.date);
    if (existing) {
      existing[item.location] = item.mealsServed;
      existing.total = (existing.total || 0) + item.mealsServed;
    } else {
      acc.push({
        date: item.date,
        [item.location]: item.mealsServed,
        total: item.mealsServed,
      });
    }
    return acc;
  }, [] as Array<{ date: string; total: number; [key: string]: number | string }>);

  // Get unique locations for colors
  const locations = [...new Set(data.map((d) => d.location))];

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={groupedData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          className="text-xs"
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          className="text-xs"
          tick={{ fill: "hsl(var(--muted-foreground))" }}
          label={{
            value: "Meals Served",
            angle: -90,
            position: "insideLeft",
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
          }}
          labelStyle={{ color: "hsl(var(--foreground))" }}
        />
        <Legend />
        {locations.length === 1 ? (
          <Bar
            dataKey={locations[0]}
            name={locations[0]}
            fill="hsl(var(--chart-1))"
          />
        ) : (
          locations.map((location, index) => (
            <Bar
              key={location}
              dataKey={location}
              name={location}
              fill={`hsl(var(--chart-${(index % 5) + 1}))`}
              stackId="a"
            />
          ))
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
