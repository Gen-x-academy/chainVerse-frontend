import type { TeamMember } from "@/types"
interface TeamMemberCardProps {
  member: TeamMember
}

export default function TeamMemberCard({ member }: TeamMemberCardProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold mb-4"
        style={{ backgroundColor: member.bgColor, color: "#ffffff" }}
      >
        {member.initials}
      </div>
      <h3 className="font-semibold text-lg">{member.name}</h3>
      <p className="text-sm text-muted-foreground mb-2">{member.title}</p>
      <p className="text-sm text-muted-foreground">{member.bio}</p>
    </div>
  )
}
