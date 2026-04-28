"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { FAQ } from "@/types"

interface FaqAccordionProps {
  items: FAQ[]
}

export default function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <div className="divide-y">
      {items.map((item, index) => (
        <div key={item.id} className="py-4 px-6">
          <button
            className="flex w-full justify-between items-center text-left"
            onClick={() => toggleAccordion(index)}
            aria-expanded={openIndex === index}
          >
            <span className="font-medium">{item.question}</span>
            <ChevronDown
              className={`h-5 w-5 transition-transform ${openIndex === index ? "transform rotate-180" : ""}`}
            />
          </button>
          <div
            className={`mt-2 text-muted-foreground text-sm overflow-hidden transition-all ${
              openIndex === index ? "max-h-96" : "max-h-0"
            }`}
          >
            <p className="py-2">{item.answer}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
