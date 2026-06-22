import React, { useMemo } from "react";
import { FuelRecord, MaintenanceRecord, Motorcycle } from "../types";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";

interface LogbookStatsProps {
  fuelRecords: FuelRecord[];
  expenses: MaintenanceRecord[];
  bike: Motorcycle | undefined;
}

export const LogbookStats: React.FC<LogbookStatsProps> = ({
  fuelRecords,
  expenses,
  bike,
}) => {
  const currentFuel = useMemo(
    () =>
      fuelRecords
        .filter((f) => f.bikeId === bike?.id)
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        ),
    [fuelRecords, bike],
  );
  const currentExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.bikeId === bike?.id)
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        ),
    [expenses, bike],
  );

  if (!bike) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600 text-xs uppercase font-bold tracking-widest">
          Nejdříve přidejte motocykl pro zobrazení statistik.
        </p>
      </div>
    );
  }

  // Calculate distance for each fuel record based on mileage difference
  const distancePerRecord = useMemo(() => {
    const map = new Map<string, number>();
    currentFuel.forEach((f, i) => {
      const prev = currentFuel[i - 1];
      const dist = prev && f.mileage > prev.mileage ? f.mileage - prev.mileage : 0;
      map.set(f.id, dist);
    });
    return map;
  }, [currentFuel]);

  // 1. Monthly costs & distance
  const monthlyData = useMemo(() => {
    const dataMap: Record<
      string,
      { month: string; fuel: number; service: number; distance: number }
    > = {};

    [...currentFuel, ...currentExpenses].forEach((rec) => {
      const d = new Date(rec.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!dataMap[key]) {
        dataMap[key] = { month: key, fuel: 0, service: 0, distance: 0 };
      }
      if ("liters" in rec) {
        dataMap[key].fuel += rec.cost;
        dataMap[key].distance += distancePerRecord.get(rec.id) || 0;
      } else {
        dataMap[key].service += rec.cost;
      }
    });

    return Object.values(dataMap).sort((a, b) =>
      a.month.localeCompare(b.month),
    );
  }, [currentFuel, currentExpenses, distancePerRecord]);

  // 2. Yearly costs & distance
  const yearlyData = useMemo(() => {
    const dataMap: Record<
      string,
      { year: string; fuel: number; service: number; distance: number }
    > = {};

    [...currentFuel, ...currentExpenses].forEach((rec) => {
      const key = new Date(rec.date).getFullYear().toString();
      if (!dataMap[key]) {
        dataMap[key] = { year: key, fuel: 0, service: 0, distance: 0 };
      }
      if ("liters" in rec) {
        dataMap[key].fuel += rec.cost;
        dataMap[key].distance += distancePerRecord.get(rec.id) || 0;
      } else {
        dataMap[key].service += rec.cost;
      }
    });

    return Object.values(dataMap).sort((a, b) => a.year.localeCompare(b.year));
  }, [currentFuel, currentExpenses, distancePerRecord]);

  // 3. Fuel price timeline
  const fuelPriceData = useMemo(() => {
    return currentFuel
      .map((f) => {
        const pricePerLiter = f.liters > 0 ? f.cost / f.liters : 0;
        return {
          date: f.date,
          price: Number(pricePerLiter.toFixed(2)),
        };
      })
      .filter((d) => d.price > 0);
  }, [currentFuel]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl">
          <p className="text-white font-bold mb-2 text-xs">{label}</p>
          {payload.map((p: any, i: number) => (
            <p
              key={i}
              className="text-[10px] font-bold tracking-widest uppercase flex justify-between gap-4"
              style={{ color: p.color }}
            >
              <span>{p.name}:</span>
              <span>
                {p.value.toLocaleString()} {p.name === "Najeto" ? "km" : "Kč"}
              </span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const FuelTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl">
          <p className="text-white font-bold mb-1 text-xs">{label}</p>
          <p className="text-orange-500 text-[10px] font-bold tracking-widest uppercase flex justify-between gap-4">
            <span>Cena za litr:</span>
            <span>{payload[0].value} Kč</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 pb-10">
      {monthlyData.length > 0 && (
        <div className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6">
            Náklady po měsících
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monthlyData}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  fontSize={10}
                  tickMargin={10}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#64748b"
                  fontSize={10}
                  tickFormatter={(val) => `${val / 1000}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#10b981"
                  fontSize={10}
                  tickFormatter={(val) => `${val}km`}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "#334155", opacity: 0.4 }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: "10px", fontWeight: "bold" }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="fuel"
                  name="Benzín"
                  stackId="a"
                  fill="#ea580c"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="service"
                  name="Servis"
                  stackId="a"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="distance"
                  name="Najeto"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981", r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {yearlyData.length > 0 && (
        <div className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6">
            Náklady po rocích
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={yearlyData}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis
                  dataKey="year"
                  stroke="#64748b"
                  fontSize={10}
                  tickMargin={10}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#64748b"
                  fontSize={10}
                  tickFormatter={(val) => `${val / 1000}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#10b981"
                  fontSize={10}
                  tickFormatter={(val) => `${val}km`}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "#334155", opacity: 0.4 }}
                />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: "10px", fontWeight: "bold" }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="fuel"
                  name="Benzín"
                  stackId="a"
                  fill="#ea580c"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="service"
                  name="Servis"
                  stackId="a"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="distance"
                  name="Najeto"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981", r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {fuelPriceData.length > 0 && (
        <div className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6">
            Vývoj ceny benzínu (Kč/l)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={fuelPriceData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={10}
                  tickMargin={10}
                  tickFormatter={(val) => val.substring(5, 10)}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  domain={["dataMin - 2", "dataMax + 2"]}
                />
                <Tooltip
                  content={<FuelTooltip />}
                  cursor={{
                    stroke: "#64748b",
                    strokeWidth: 1,
                    strokeDasharray: "3 3",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  name="Cena"
                  stroke="#ea580c"
                  strokeWidth={3}
                  dot={{
                    fill: "#ea580c",
                    r: 4,
                    strokeWidth: 2,
                    stroke: "#1e293b",
                  }}
                  activeDot={{ r: 6, fill: "#fff", stroke: "#ea580c" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {monthlyData.length === 0 && yearlyData.length === 0 && (
        <div className="text-center py-20">
          <p className="text-slate-600 text-xs uppercase font-bold tracking-widest">
            Zatím žádná data pro statistiky
          </p>
        </div>
      )}
    </div>
  );
};
