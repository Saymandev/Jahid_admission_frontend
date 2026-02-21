'use client'

import { eachDayOfInterval, endOfMonth, format, isSameDay, parseISO, startOfMonth } from 'date-fns'
import { useState } from 'react'

interface Payment {
  month: string
  rentAmount: number
  paidAmount: number
  dueAmount: number
  advanceAmount: number
  advanceApplied?: number
  advanceGenerated?: number
  paymentMethod?: string
  paymentDate?: string
  records?: any[]
  status: 'paid' | 'partial' | 'unpaid'
}

interface PaymentCalendarProps {
  payments: Payment[]
  student: any
  monthlyRent: number
  totalAdvance?: number
  selectedMonth?: Date
  onMonthSelect?: (month: string) => void // Callback when a month is clicked
}

export function PaymentCalendar({ payments, student, monthlyRent, totalAdvance = 0, selectedMonth: initialMonth, onMonthSelect }: PaymentCalendarProps) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || new Date())

  const paymentMap = new Map()
  payments.forEach((p) => {
    const date = parseISO(p.month + '-01')
    paymentMap.set(format(date, 'yyyy-MM'), p)
  })

  // Calculate which future months will be covered by advance
  const futureMonthsWithAdvance = new Map<string, number>()
  if (totalAdvance > 0) {
    let remainingAdvance = totalAdvance
    const currentDate = new Date()
    const currentMonth = format(currentDate, 'yyyy-MM')
    
    // Check future months (up to 12 months ahead)
    for (let i = 1; i <= 12; i++) {
      const futureDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1)
      const futureMonth = format(futureDate, 'yyyy-MM')
      const payment = paymentMap.get(futureMonth)
      
      // If month has no payment or has due, advance can cover it
      if (!payment || payment.dueAmount > 0) {
        const dueAmount = payment ? payment.dueAmount : monthlyRent
        if (dueAmount > 0 && remainingAdvance > 0) {
          const advanceToCover = Math.min(remainingAdvance, dueAmount)
          futureMonthsWithAdvance.set(futureMonth, advanceToCover)
          remainingAdvance -= advanceToCover
          if (remainingAdvance <= 0) break
        }
      }
    }
  }

  const monthStart = startOfMonth(selectedMonth)
  const monthEnd = endOfMonth(selectedMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const getPaymentColor = (payment: Payment | undefined, willBeCoveredByAdvance?: boolean) => {
    if (payment?.status === 'paid') {
      // If paid with advance, use a different shade
      if (payment.advanceApplied && payment.advanceApplied > 0) {
        return 'bg-primary/20 text-primary border-primary border-2'
      }
      return 'bg-success/20 text-success border-success'
    }

    // If month is covered by advance (future/unpaid), show blue
    if (willBeCoveredByAdvance) {
      return 'bg-primary/20 text-primary border-primary border-2'
    }

    if (!payment) {
      return 'bg-gray-100 text-gray-600'
    }
    
    if (payment.status === 'partial') return 'bg-warning/20 text-warning border-warning'
    return 'bg-danger/20 text-danger border-danger'
  }

  const getPaymentStatus = (payment: Payment | undefined) => {
    if (!payment) return 'No Payment'
    if (payment.status === 'paid') return 'Paid'
    if (payment.status === 'partial') return 'Partial'
    return 'Unpaid'
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Payment Calendar</h3>
        <input
          type="month"
          value={format(selectedMonth, 'yyyy-MM')}
          onChange={(e) => setSelectedMonth(parseISO(e.target.value + '-01'))}
          className="px-3 py-2 border border-input rounded-md"
        />
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-secondary p-2">
            {day}
          </div>
        ))}
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`empty-${i}`} className="p-2" />
        ))}
        {days.map((day) => {
          const monthKey = format(day, 'yyyy-MM')
          const dateKey = format(day, 'yyyy-MM-dd')
          const monthlyPayment = paymentMap.get(monthKey)
          
          // Only show actual transactions (paid > 0) on specific days
          const dayRecords = monthlyPayment?.records?.filter((r: any) => {
            const rDate = r.paymentDate || r.createdAt
            return rDate && format(parseISO(rDate), 'yyyy-MM-dd') === dateKey && r.paidAmount > 0
          }) || []
 
          const isFirstDay = day.getDate() === 1
          const isToday = isSameDay(day, new Date())
          const willBeCoveredByAdvance = futureMonthsWithAdvance.has(monthKey)
          const advanceCoverage = isFirstDay ? (futureMonthsWithAdvance.get(monthKey) || 0) : 0
 
          return (
            <div
              key={day.toString()}
              onClick={() => {
                if (onMonthSelect) {
                  onMonthSelect(monthKey)
                }
              }}
              className={`p-2 border rounded-md cursor-pointer hover:shadow-md transition-shadow min-h-[90px] relative ${
                getPaymentColor(monthlyPayment, willBeCoveredByAdvance)
              } ${isToday ? 'ring-2 ring-primary bg-primary/5' : ''}`}
              title={`${format(day, 'MMM dd, yyyy')}${isFirstDay ? ` - Monthly Rent: ${monthlyRent} BDT` : ''}`}
            >
              <div className="text-[10px] font-bold text-secondary/70 mb-1">
                {format(day, 'd')}
              </div>
              
              {isFirstDay && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold leading-tight uppercase opacity-60">Rent</div>
                  <div className="text-xs font-bold leading-none">{monthlyRent.toLocaleString()}</div>
                  {monthlyPayment && monthlyPayment.dueAmount > 0 && (
                    <div className="text-[9px] font-bold text-danger leading-none mt-1">
                      Due: {monthlyPayment.dueAmount.toLocaleString()}
                    </div>
                  )}
                  {willBeCoveredByAdvance && (
                    <div className="mt-1 p-1 bg-primary border-2 border-primary-foreground/20 rounded text-[9px] font-bold text-primary-foreground leading-tight shadow-sm animate-pulse">
                      <div className="uppercase text-[7px] mb-0.5 opacity-80">Paid in Advance</div>
                      {advanceCoverage.toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4 p-4 bg-card border border-border rounded-md">
        <h4 className="font-semibold mb-3">Legend</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-success/20 border border-success rounded"></div>
            <span>Paid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary/20 border-2 border-primary rounded"></div>
            <span>Paid (Advance)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-warning/20 border border-warning rounded"></div>
            <span>Partial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-danger/20 border border-danger rounded"></div>
            <span>Unpaid</span>
          </div>
          {totalAdvance > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-primary/20 border-2 border-primary rounded"></div>
              <span>Future (Advance)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
