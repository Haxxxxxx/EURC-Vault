import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const data = [
  { value: 95000 },
  { value: 96200 },
  { value: 95800 },
  { value: 97500 },
  { value: 98200 },
  { value: 97800 },
  { value: 99100 },
  { value: 100500 },
  { value: 101200 },
  { value: 102800 },
  { value: 103500 },
  { value: 105200 },
];

export function PortfolioSparkline() {
  return (
    <ResponsiveContainer width="100%" height={80}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#portfolioGradient)"
          isAnimationActive={true}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
