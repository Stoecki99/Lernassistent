// components/features/WochenChart.tsx
// Mini-Bar-Chart fuer die Lernaktivitaet der letzten 7 Tage (CSS/Tailwind).

interface DayData {
  date: string
  cardsStudied: number
  minutesStudied: number
}

interface WochenChartProps {
  data: DayData[]
}

const dayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  const day = date.getDay()
  // getDay: 0=So, 1=Mo, ...
  return dayLabels[day === 0 ? 6 : day - 1]
}

export default function WochenChart({ data }: WochenChartProps) {
  const maxCards = Math.max(...data.map((d) => d.cardsStudied), 1)

  return (
    <div className="bg-surface-card rounded-2xl shadow-card p-5">
      <h2 className="font-bold text-text-dark mb-4">Letzte 7 Tage</h2>

      <div className="flex items-end justify-between gap-2 h-32">
        {data.map((day) => {
          const heightPercent = (day.cardsStudied / maxCards) * 100
          const isToday = day.date === data[data.length - 1]?.date

          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              {/* Anzahl ueber dem Balken */}
              <span className="text-xs font-bold text-text-light">
                {day.cardsStudied > 0 ? day.cardsStudied : ""}
              </span>

              {/* Balken */}
              <div className="w-full flex items-end justify-center h-20">
                <div
                  className={`w-full max-w-[28px] rounded-t-lg transition-all duration-300 ${
                    isToday ? "bg-primary" : "bg-primary/40"
                  } ${day.cardsStudied === 0 ? "bg-gray-200 min-h-[4px]" : ""}`}
                  style={{
                    height: day.cardsStudied > 0 ? `${Math.max(heightPercent, 8)}%` : "4px",
                  }}
                />
              </div>

              {/* Tag-Label */}
              <span
                className={`text-xs font-semibold ${
                  isToday ? "text-primary-dark" : "text-text-light"
                }`}
              >
                {getDayLabel(day.date)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Zusammenfassung */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs text-text-light">
        <span>
          Gesamt: <span className="font-bold text-text">{data.reduce((s, d) => s + d.cardsStudied, 0)} Karten</span>
        </span>
        <span>
          Zeit: <span className="font-bold text-text">{data.reduce((s, d) => s + d.minutesStudied, 0)} Min.</span>
        </span>
      </div>
    </div>
  )
}
