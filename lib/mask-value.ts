/**
 * Masks financial values for staff users
 * @param value - The value to mask (number or string)
 * @param isStaff - Whether the current user is staff
 * @returns Masked value as "****" for staff, original formatted value for admin
 */
export function maskValue(value: number | string | undefined | null, isStaff: boolean): string {
  if (isStaff) {
    return '****'
  }
  
  if (value === undefined || value === null) {
    return '0'
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) {
    return '0'
  }
  
  return numValue.toLocaleString()
}

/**
 * Masks financial values with currency for staff users
 * @param value - The value to mask (number or string)
 * @param isStaff - Whether the current user is staff
 * @param currency - Currency symbol (default: 'BDT')
 * @returns Masked value as "**** BDT" for staff, formatted value for admin
 */
export function maskCurrency(value: number | string | undefined | null, isStaff: boolean, currency: string = 'BDT'): string {
  if (isStaff) {
    return `**** ${currency}`
  }
  
  if (value === undefined || value === null) {
    return `0 ${currency}`
  }
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) {
    return `0 ${currency}`
  }
  
  return `${numValue.toLocaleString()} ${currency}`
}
