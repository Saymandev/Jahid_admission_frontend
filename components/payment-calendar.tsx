'use client'

import { eachDayOfInterval, endOfMonth, format, isSameDay, isSameMonth, parseISO, startOfMonth } from 'date-fns'
import { useState } from 'react'

interface Payment {
  month: string
  rentAmount: number
  paidAmount: number
  dueAmount: number
  advanceAmount: number
  advanceApplied?: number
  paymentMethod?: string
  paymentDate?: string
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

  const getPaymentColor = (payment: Payment | undefined) => {
    if (!payment) return 'bg-gray-100 text-gray-600'
    if (payment.status === 'paid') {
      // If paid with advance, use a different shade
      if (payment.advanceApplied && payment.advanceApplied > 0) {
        return 'bg-primary/20 text-primary border-primary border-2'
      }
      return 'bg-success/20 text-success border-success'
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
          const dayKey = format(day, 'yyyy-MM')
          const payment = paymentMap.get(dayKey)
          const isCurrentMonth = isSameMonth(day, selectedMonth)
          const isToday = isSameDay(day, new Date())

          if (!isCurrentMonth) {
            return <div key={day.toString()} className="p-2" />
          }

          const monthKey = format(day, 'yyyy-MM')
          const isUnpaid = !payment || payment.status === 'unpaid' || payment.dueAmount > 0
          const willBeCoveredByAdvance = futureMonthsWithAdvance.has(monthKey)
          const advanceCoverage = futureMonthsWithAdvance.get(monthKey) || 0

          return (
            <div
              key={day.toString()}
              onClick={() => {
                if (onMonthSelect) {
                  onMonthSelect(monthKey)
                }
              }}
              className={`p-2 border rounded-md cursor-pointer hover:shadow-md transition-shadow relative ${getPaymentColor(
                payment
              )} ${willBeCoveredByAdvance && !payment ? 'bg-primary/10 border-primary/40 border-dashed' : ''} ${isToday ? 'ring-2 ring-primary' : ''} ${isUnpaid ? 'hover:ring-2 hover:ring-primary' : ''}`}
              title={`${format(day, 'MMM dd, yyyy')} - ${getPaymentStatus(payment)}${payment?.advanceApplied && payment.advanceApplied > 0 ? ' (Paid with Advance)' : ''}${willBeCoveredByAdvance ? ` (Will be covered by ${advanceCoverage.toLocaleString()} BDT advance)` : ''}${isUnpaid ? ' (Click to record payment)' : ''}`}
            >
              <div className="text-xs font-medium flex items-center gap-1">
                {format(day, 'd')}
                {payment?.advanceApplied && payment.advanceApplied > 0 && (
                  <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {willBeCoveredByAdvance && !payment && (
                  <svg className="w-3 h-3 text-primary animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              {payment && (
                <div className="text-xs mt-1">
                  <div>Paid: {payment.paidAmount.toLocaleString()}</div>
                  {payment.advanceApplied && payment.advanceApplied > 0 && (
                    <div className="text-primary font-semibold text-[10px] mt-0.5">
                      ⚡ Advance: {payment.advanceApplied.toLocaleString()}
                    </div>
                  )}
                  {payment.dueAmount > 0 && (
                    <div className="text-danger">Due: {payment.dueAmount.toLocaleString()}</div>
                  )}
                </div>
              )}
              {willBeCoveredByAdvance && !payment && (
                <div className="text-xs mt-1 text-primary font-semibold">
                  ⚡ Advance: {advanceCoverage.toLocaleString()}
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
              <div className="w-4 h-4 bg-primary/10 border border-primary/40 border-dashed rounded"></div>
              <span>Future (Advance)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
