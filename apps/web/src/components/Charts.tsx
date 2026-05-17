import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "./ui";

export function LinePanel({ title, data, lines }: { title: string; data: object[]; lines: { key: string; color: string }[] }) {
  return <Card title={title} className="chart-card"><ResponsiveContainer width="100%" height={240}><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.18)" /><XAxis dataKey="date" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} /><Legend />{lines.map((line) => <Line key={line.key} type="monotone" dataKey={line.key} stroke={line.color} strokeWidth={2} dot={false} />)}</LineChart></ResponsiveContainer></Card>;
}

export function BarPanel({ title, data, bars, xKey }: { title: string; data: object[]; bars: { key: string; color: string }[]; xKey: string }) {
  return <Card title={title} className="chart-card"><ResponsiveContainer width="100%" height={240}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.18)" /><XAxis dataKey={xKey} stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} /><Legend />{bars.map((bar) => <Bar key={bar.key} dataKey={bar.key} fill={bar.color} radius={[8, 8, 0, 0]} />)}</BarChart></ResponsiveContainer></Card>;
}
