'use client'

import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import * as React from 'react'

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const DialogContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
}>({
  open: false,
  onOpenChange: () => {},
})

// Basic Dialog Implementation (Custom)
export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const [isOpen, setIsOpen] = React.useState(open || false)
  const isControlled = open !== undefined

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) {
      setIsOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }

  const effectiveOpen = isControlled ? open : isOpen

  return (
    <DialogContext.Provider value={{ open: !!effectiveOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

export function DialogTrigger({ asChild, children, ...props }: any) {
  const { onOpenChange } = React.useContext(DialogContext)
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, {
      ...props,
      onClick: (e: React.MouseEvent) => {
        (children as React.ReactElement).props.onClick?.(e)
        onOpenChange(true)
      }
    } as any)
  }

  return (
    <button {...props} onClick={() => onOpenChange(true)}>
      {children}
    </button>
  )
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export function DialogContent({ children, className, ...props }: DialogContentProps) {
  const { open, onOpenChange } = React.useContext(DialogContext)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in-0">
      <div 
        className="fixed inset-0" 
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "relative z-50 w-full bg-background rounded-lg shadow-lg border p-6 animate-in zoom-in-95 duration-200",
          className
        )}
        {...props}
      >
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 text-center sm:text-left mb-4",
        className
      )}
      {...props}
    />
  )
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
}
