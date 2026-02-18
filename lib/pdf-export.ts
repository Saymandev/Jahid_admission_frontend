import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Student Ledger PDF
export function exportStudentLedger(student: any, payments: any[], extraPayments: any[] = []) {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(18)
  doc.text('Student Ledger', 14, 20)

  // Student Info
  doc.setFontSize(12)
  doc.text(`Student: ${student.name || student.studentName || 'N/A'}`, 14, 30)
  doc.text(`ID: ${student.studentId || student._id || 'N/A'}`, 14, 36)
  doc.text(`Room: ${student.roomId?.name || 'N/A'} ${student.bedNumber ? `(Bed ${student.bedNumber})` : ''}`, 14, 42)
  doc.text(`Monthly Rent: ${(student.monthlyRent || 0).toLocaleString()} BDT`, 14, 48)

  // Payment Table (Rent & Advance)
  const tableData = payments.map((p: any) => [
    p.month,
    p.rentAmount.toLocaleString(),
    p.paidAmount.toLocaleString(),
    p.dueAmount.toLocaleString(),
    p.advanceAmount.toLocaleString(),
    p.status,
  ])

  autoTable(doc, {
    head: [['Month', 'Rent', 'Paid', 'Due', 'Advance', 'Status']],
    body: tableData,
    startY: 55,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185] }
  })

  let finalY = (doc as any).lastAutoTable?.finalY || 55

  // Extra Payments Table (Security, Union Fees, etc.)
  if (extraPayments && extraPayments.length > 0) {
    doc.setFontSize(14)
    doc.text('Other Payments (Security, Fees, etc.)', 14, finalY + 15)
    
    const extraTableData = extraPayments.map((p: any) => [
      new Date(p.paymentDate || p.createdAt).toLocaleDateString(),
      p.type.charAt(0).toUpperCase() + p.type.slice(1).replace('_', ' '),
      p.paidAmount.toLocaleString(),
      p.paymentMethod.toUpperCase(),
      p.notes || '-',
    ])

    autoTable(doc, {
      head: [['Date', 'Type', 'Amount', 'Method', 'Notes']],
      body: extraTableData,
      startY: finalY + 20,
      theme: 'grid',
      headStyles: { fillColor: [46, 204, 113] }
    })
    
    finalY = (doc as any).lastAutoTable?.finalY || finalY + 20
  }

  // Summary: Calculate ONLY cash-in (excluding internal adjustments to avoid double counting)
  const totalRent = payments.reduce((sum, p) => sum + (p.rentAmount || 0), 0)
  
  // Total applied to rent (including adjustments)
  const totalPaidRent = payments.reduce((sum, p) => sum + (p.paidAmount || 0), 0)
  // Total applied to others (excluding refunds)
  const totalExtra = extraPayments.reduce((sum, p) => {
    if (p.type === 'refund') return sum;
    return sum + (p.paidAmount || 0);
  }, 0)

  // Calculate Total Refunded
  const totalRefunded = extraPayments.reduce((sum, p) => {
    if (p.type === 'refund') return sum + (p.paidAmount || 0);
    return sum;
  }, 0)

  // Sum only non-adjustment records from monthly payments for the "Cash Received" summary
  const totalPaidRentCash = payments.reduce((sum, p) => {
    const monthCash = (p.records || []).reduce((rSum: number, r: any) => {
      if (r.type === 'adjustment' || r.paymentMethod === 'adjustment' || r.paymentMethod === 'ADJUSTMENT') return rSum;
      return rSum + (r.paidAmount || 0);
    }, 0);
    return sum + monthCash;
  }, 0);

  // Sum only non-adjustment records from extra payments for the "Cash Received" summary
  const totalExtraCash = extraPayments.reduce((sum, p) => {
    if (p.type === 'adjustment' || p.paymentMethod === 'adjustment' || p.paymentMethod === 'ADJUSTMENT') return sum;
    // Also exclude refunds from "Cash Received" purely (unless we want 'Net Cash'?) 
    // Usually 'Total Paid' implies 'Total Collected'. Refunds are separate.
    // If refund was CASH, we might want to subtract it? 
    // But currently refund is ADJUSTMENT so it's excluded anyway.
    return sum + (p.paidAmount || 0);
  }, 0);

  const totalDue = payments.reduce((sum, p) => sum + (p.dueAmount || 0), 0)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Financial Summary', 14, finalY + 15)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Total Rent Invoiced: ${totalRent.toLocaleString()} BDT`, 14, finalY + 22)
  doc.text(`Total Rent Paid: ${totalPaidRent.toLocaleString()} BDT`, 14, finalY + 28)
  doc.text(`Total Other Fees/Security: ${totalExtra.toLocaleString()} BDT`, 14, finalY + 34)
  
  if (totalRefunded > 0) {
      doc.setTextColor(231, 76, 60) // Red
      doc.text(`Total Refunded: ${totalRefunded.toLocaleString()} BDT`, 14, finalY + 40)
      doc.setTextColor(0, 0, 0) // Reset
  }
  
  doc.setFont('helvetica', 'bold')
  // The Total Paid summary now reflects the ACTUAL cash/online money received
  doc.text(`TOTAL PAID (Actual Cash In): ${(totalPaidRentCash + totalExtraCash).toLocaleString()} BDT`, 14, finalY + 48)
  
  doc.setTextColor(231, 76, 60) // Red
  doc.text(`TOTAL OUTSTANDING DUE: ${totalDue.toLocaleString()} BDT`, 14, finalY + 54)

  doc.save(`student-ledger-${student.studentId}.pdf`)
}

// Checkout Statement PDF
export function exportCheckoutStatement(statement: any) {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(18)
  doc.text('Checkout Statement', 14, 20)

  // Student Info
  doc.setFontSize(12)
  doc.text(`Student: ${statement.student.name}`, 14, 30)
  doc.text(`ID: ${statement.student.studentId}`, 14, 36)
  doc.text(`Checkout Date: ${new Date(statement.checkoutDate).toLocaleDateString()}`, 14, 42)

  // Payment Summary
  autoTable(doc, {
    head: [['Month', 'Rent', 'Paid', 'Due']],
    body: statement.payments.map((p: any) => [
      p.month,
      p.rentAmount.toLocaleString(),
      p.paidAmount.toLocaleString(),
      p.dueAmount.toLocaleString(),
    ]),
    startY: 50,
  })

  // Final Summary
  const finalY = (doc as any).lastAutoTable?.finalY || 50
  doc.setFontSize(10)

  let currentY = finalY + 12
  doc.text(`Total History Paid: ${(statement.totalPaid || 0).toLocaleString()} BDT`, 14, currentY)

  currentY += 8
  doc.text(`Security Deposit Used for Dues: ${(statement.securityDepositUsed || 0).toLocaleString()} BDT`, 14, currentY)

  currentY += 8
  doc.text(`Security Deposit Returned: ${(statement.securityDeposit || 0).toLocaleString()} BDT`, 14, currentY)

  currentY += 8
  doc.text(`Excess Advance Returned: ${(statement.advanceReturned || 0).toLocaleString()} BDT`, 14, currentY)

  currentY += 10
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`TOTAL REFUND AMOUNT: ${(statement.totalRefunded || 0).toLocaleString()} BDT`, 14, currentY)

  doc.save(`checkout-statement-${statement.student.studentId || 'unknown'}.pdf`)
}


// Admission Receipt PDF
export function exportAdmissionReceipt(admission: any, payments: any[]) {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(18)
  doc.text('Admission Receipt', 14, 20)

  // Admission Info
  doc.setFontSize(12)
  doc.text(`Admission ID: ${admission.admissionId}`, 14, 30)
  doc.text(`Student: ${admission.studentName}`, 14, 36)
  doc.text(`Course: ${admission.course}`, 14, 42)
  doc.text(`Batch: ${admission.batch}`, 14, 48)
  doc.text(`Total Fee: ${admission.totalFee.toLocaleString()} BDT`, 14, 54)

  // Payment Table
  if (payments.length > 0) {
    autoTable(doc, {
      head: [['Date', 'Amount', 'Method', 'Transaction ID']],
      body: payments.map((p: any) => [
        new Date(p.paymentDate || p.createdAt).toLocaleDateString(),
        p.paidAmount.toLocaleString(),
        p.paymentMethod,
        p.transactionId || 'N/A',
      ]),
      startY: 62,
    })
  }

  // Summary
  const finalY = payments.length > 0 ? ((doc as any).lastAutoTable?.finalY || 62) : 62
  doc.setFontSize(10)
  doc.text(`Paid: ${admission.paidAmount.toLocaleString()} BDT`, 14, finalY + 10)
  doc.text(`Due: ${admission.dueAmount.toLocaleString()} BDT`, 14, finalY + 16)
  doc.text(`Status: ${admission.status.toUpperCase()}`, 14, finalY + 22)

  doc.save(`admission-receipt-${admission.admissionId}.pdf`)
}

// Monthly Collection Report PDF
export function exportMonthlyCollectionReport(month: string, data: any[]) {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(18)
  doc.text('Monthly Collection Report', 14, 20)
  doc.setFontSize(12)
  doc.text(`Month: ${month}`, 14, 28)

  // Collection Table
  autoTable(doc, {
    head: [['Student ID', 'Name', 'Room', 'Rent', 'Paid', 'Due']],
    body: data.map((item: any) => [
      item.studentId,
      item.name,
      item.room || 'N/A',
      item.rent.toLocaleString(),
      item.paid.toLocaleString(),
      item.due.toLocaleString(),
    ]),
    startY: 35,
  })

  // Summary
  const totalRent = data.reduce((sum, item) => sum + item.rent, 0)
  const totalPaid = data.reduce((sum, item) => sum + item.paid, 0)
  const totalDue = data.reduce((sum, item) => sum + item.due, 0)

  const finalY = (doc as any).lastAutoTable?.finalY || 35
  doc.setFontSize(10)
  doc.text(`Total Rent: ${totalRent.toLocaleString()} BDT`, 14, finalY + 10)
  doc.text(`Total Collected: ${totalPaid.toLocaleString()} BDT`, 14, finalY + 16)
  doc.text(`Total Due: ${totalDue.toLocaleString()} BDT`, 14, finalY + 22)

  doc.save(`monthly-collection-${month}.pdf`)
}
