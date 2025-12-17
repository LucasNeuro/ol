import { cn } from "@/lib/utils"

export function CircularProgress({ value = 0, size = 80, strokeWidth = 8, className }) {
  const percentage = Math.min(Math.max(value, 0), 100)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference
  
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Círculo de fundo */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200"
        />
        {/* Círculo de progresso */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-orange-500 transition-all duration-300 ease-out"
        />
      </svg>
      {/* Porcentagem no centro */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-semibold text-gray-900">
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  )
}





