import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Student Ledger PDF
export function exportStudentLedger(student: any, payments: any[]) {
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
  
  // Payment Table
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
  })
  
  // Summary
  const totalRent = payments.reduce((sum, p) => sum + p.rentAmount, 0)
  const totalPaid = payments.reduce((sum, p) => sum + p.paidAmount, 0)
  const totalDue = payments.reduce((sum, p) => sum + p.dueAmount, 0)
  
  const finalY = (doc as any).lastAutoTable?.finalY || 55
  doc.setFontSize(10)
  doc.text(`Total Rent: ${totalRent.toLocaleString()} BDT`, 14, finalY + 10)
  doc.text(`Total Paid: ${totalPaid.toLocaleString()} BDT`, 14, finalY + 16)
  doc.text(`Total Due: ${totalDue.toLocaleString()} BDT`, 14, finalY + 22)
  
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
  doc.text(`Total Paid: ${statement.totalPaid.toLocaleString()} BDT`, 14, finalY + 10)
  doc.text(`Security Deposit: ${statement.securityDeposit.toLocaleString()} BDT`, 14, finalY + 16)
  doc.text(`Total Refundable: ${(statement.totalPaid + statement.securityDeposit).toLocaleString()} BDT`, 14, finalY + 22)
  
  doc.save(`checkout-statement-${statement.student.studentId}.pdf`)
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
        new Date(p.createdAt).toLocaleDateString(),
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
