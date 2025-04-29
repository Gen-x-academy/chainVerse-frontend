import { Globe, BookOpen, Users } from "lucide-react"
import type { WhyChooseItem } from "@/types"
interface WhyChooseCardProps {
  item: WhyChooseItem
}

export default function WhyChooseCard({ item }: WhyChooseCardProps) {
  // Map icon type to the corresponding Lucide icon
  const getIcon = () => {
    switch (item.icon) {
      case "globe":
        return <Globe className="h-6 w-6 text-blue-600" />
      case "book":
        return <BookOpen className="h-6 w-6 text-blue-600" />
      case "users":
        return <Users className="h-6 w-6 text-blue-600" />
      default:
        return <Globe className="h-6 w-6 text-blue-600" />
    }
  }

  return (
    <div className="flex items-start gap-4 mb-20">
      <div className="bg-blue-100 rounded-full p-3 flex-shrink-0">{getIcon()}</div>
      <div>
        <h3 className="font-semibold mb-1">{item.title}</h3>
        <p className="text-sm text-muted-foreground">{item.description}</p>
      </div>
    </div>
  )
}
