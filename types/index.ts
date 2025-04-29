export interface TeamMember {
    id: number
    name: string
    title: string
    bio: string
    initials: string
    bgColor: string
}

export interface FAQ {
    id: number
    question: string
    answer: string
}

export interface WhyChooseItem {
    id: number
    title: string
    description: string
    icon: "globe" | "book" | "users"
}

export interface AboutContent {
    title: string
    subtitle: string
    description: string
    vision: string
    values: string
    approach: string
}
