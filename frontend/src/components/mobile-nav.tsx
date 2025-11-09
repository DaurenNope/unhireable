"use client"

import { useState, useEffect, useRef } from "react"
import { useLocation, Link } from "react-router-dom"
import { Menu, X, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { navigation } from "./main-nav"

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const location = useLocation()
  const pathname = location.pathname
  const sheetRef = useRef<HTMLDivElement>(null)

  // Close the sheet when route changes
  useEffect(() => {
    setOpen(false)
    setExpandedItems({})
  }, [pathname])

  const toggleItem = (name: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [name]: !prev[name]
    }))
  }

  const closeSheet = () => {
    setOpen(false)
    setExpandedItems({})
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] p-0" ref={sheetRef}>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-4">
            <h2 className="text-lg font-semibold">Menu</h2>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              onClick={closeSheet}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close menu</span>
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <nav className="space-y-0.5 p-2">
              {navigation.map((item) => (
                <div key={item.name} className="space-y-0.5">
                  <div className="relative">
                    {item.subItems ? (
                      <>
                        <button
                          onClick={() => toggleItem(item.name)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            (pathname === item.href || 
                             item.subItems?.some(si => pathname.startsWith(si.href)))
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <item.icon className="h-4 w-4 flex-shrink-0" />
                            <span>{item.name}</span>
                          </div>
                          <ChevronRight 
                            className={cn(
                              "h-4 w-4 transition-transform",
                              expandedItems[item.name] && "rotate-90"
                            )} 
                          />
                        </button>
                        {expandedItems[item.name] && (
                          <div className="ml-4 mt-0.5 space-y-0.5 border-l pl-2">
                            {item.subItems.map((subItem) => (
                              <Link
                                key={subItem.name}
                                to={subItem.href}
                                className={cn(
                                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                                  pathname === subItem.href
                                    ? "bg-accent text-accent-foreground"
                                    : "hover:bg-accent/50"
                                )}
                                onClick={closeSheet}
                              >
                                <span className="h-4 w-4 flex-shrink-0" />
                                <span>{subItem.name}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        to={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          pathname === item.href
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50"
                        )}
                        onClick={closeSheet}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span>{item.name}</span>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </nav>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
