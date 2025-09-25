"use client";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
} from "recharts";

interface MonthData {
  month: string;
  shifts: number;
  hours: number;
}

interface ShiftTypeData {
  type: string;
  count: number;
  emoji: string;
  fill: string;
}

interface ActivityChartProps {
  data: MonthData[];
  chartConfig: {
    shifts: {
      label: string;
      color: string;
    };
  };
}

interface ShiftTypesChartProps {
  data: ShiftTypeData[];
}

export function ActivityChart({ data, chartConfig }: ActivityChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-[200px]">
      <RechartsBarChart data={data}>
        <XAxis 
          dataKey="month"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <YAxis hide />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="shifts" fill="var(--color-shifts)" radius={4} />
      </RechartsBarChart>
    </ChartContainer>
  );
}

export function ShiftTypesChart({ data }: ShiftTypesChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No completed shifts yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ChartContainer 
        config={{
          count: {
            label: "Count",
          }
        }} 
        className="h-[200px]"
      >
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="type"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent />} />
        </RechartsPieChart>
      </ChartContainer>
      
      {/* Legend */}
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: item.fill }}
            />
            <span className="text-sm font-medium">{item.emoji}</span>
            <span className="text-sm truncate flex-1">{item.type}</span>
            <span className="text-sm text-muted-foreground">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}