import { LibrarianNav } from "@/components/elibrary/LibrarianNav";
import { ItemConditionReport } from "@/components/elibrary/ItemConditionReport";
import { LostItemResolution } from "@/components/elibrary/LostItemResolution";
import { RepairTracking } from "@/components/elibrary/RepairTracking";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Mock data for demonstration
const mockConditionReport = {
  itemId: "item-001",
  title: "The Great Gatsby",
  currentCondition: "damaged" as const,
  repairStatus: "scheduled" as const,
  notes: "Cover is torn. Needs repair.",
  evidence: [],
  activityHistory: [
    {
      id: "act-001",
      action: "Condition updated to Damaged",
      user: "Jane Librarian",
      timestamp: "2026-08-20T14:30:00Z",
      notes: "Item returned with torn cover.",
    },
  ],
  patronId: "patron-001",
  patronName: "John Student",
};

const mockLostItem = {
  itemTitle: "1984 by George Orwell",
  replacementCost: 29.99,
  status: "disputed" as const,
  patronName: "Alice Smith",
  activityHistory: [
    {
      id: "lost-act-001",
      action: "Item marked as lost",
      user: "Jane Librarian",
      timestamp: "2026-08-15T10:00:00Z",
      notes: "Item not returned after 30 days.",
    },
  ],
};

const mockRepairTickets = [
  {
    id: "repair-001",
    itemId: "item-001",
    itemTitle: "The Great Gatsby",
    issueDescription: "Torn front cover, spine damage",
    priority: "medium" as const,
    status: "in-progress" as const,
    createdAt: "2026-08-21T09:00:00Z",
    scheduledDate: "2026-08-25T00:00:00Z",
    estimatedCost: 15.00,
    repairLogs: [],
    evidence: [],
  },
  {
    id: "repair-002",
    itemId: "item-002",
    itemTitle: "Pride and Prejudice",
    issueDescription: "Water damage on pages 50-75",
    priority: "high" as const,
    status: "scheduled" as const,
    createdAt: "2026-08-22T11:30:00Z",
    estimatedCost: 25.00,
    repairLogs: [],
    evidence: [],
  },
];

// Configuration that meets acceptance criteria
const REQUIRES_NOTES_FOR_CONDITIONS = ["damaged", "lost", "in-repair"];
const PATRON_CONSEQUENCES = {
  good: [],
  worn: [],
  damaged: ["Patron account will be charged a damage fee of $10.00", "Borrowing privileges may be restricted until fee is paid"],
  lost: ["Patron will be charged full replacement cost of $29.99", "Borrowing privileges suspended until payment is received"],
  "in-repair": [],
};

const LOST_ITEM_REQUIRES_NOTES = ["paid", "waived", "disputed"];
const LOST_ITEM_CONSEQUENCES = {
  found: ["Patron borrowing privileges reinstated", "All fees waived"],
  paid: ["Payment marked as received", "Account in good standing"],
  replaced: ["Item replaced in catalog", "Patron account cleared"],
  waived: ["Fees waived by library administration", "Patron account cleared"],
  disputed: ["Patron account placed on hold", "Investigation initiated", "Borrowing privileges suspended"],
};

export default function LibraryReportsPage() {
  // Mock handlers
  const handleConditionSubmit = async (updates: Partial<typeof mockConditionReport>) => {
    console.log("Updating condition report:", updates);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  const handleLostItemResolve = async (status: string, notes: string) => {
    console.log("Resolving lost item:", status, notes);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  const handleCreateRepairTicket = async (ticket: any) => {
    console.log("Creating repair ticket:", ticket);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  const handleUpdateRepairTicket = async (id: string, updates: any) => {
    console.log("Updating repair ticket:", id, updates);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  // Librarian permissions - in a real app this would come from auth
  const librarianPermissions = ["catalog", "circulation", "patrons", "acquisitions", "reports", "configuration", "audits"];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <Card>
              <CardHeader>
                <CardTitle>Librarian Dashboard</CardTitle>
                <CardDescription>Library management tools</CardDescription>
              </CardHeader>
              <CardContent>
                <LibrarianNav 
                  permissions={librarianPermissions} 
                  activeHref="/library/reports"
                  className="mt-2"
                />
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="flex-1 space-y-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Reports & Item Management</h1>
              <p className="text-muted-foreground mt-2">
                Manage item conditions, track repairs, and resolve lost items.
              </p>
            </div>

            <Tabs defaultValue="condition-reports" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="condition-reports">Condition Reports</TabsTrigger>
                <TabsTrigger value="repair-tracking">Repair Tracking</TabsTrigger>
                <TabsTrigger value="lost-items">Lost Item Resolution</TabsTrigger>
              </TabsList>

              {/* Condition Reports Tab */}
              <TabsContent value="condition-reports" className="mt-6">
                <ItemConditionReport
                  report={mockConditionReport}
                  onSubmit={handleConditionSubmit}
                  requiresNotesForStatus={REQUIRES_NOTES_FOR_CONDITIONS}
                  patronConsequences={PATRON_CONSEQUENCES}
                  success="Item condition updated successfully."
                />
              </TabsContent>

              {/* Repair Tracking Tab */}
              <TabsContent value="repair-tracking" className="mt-6">
                <RepairTracking
                  tickets={mockRepairTickets}
                  onCreateTicket={handleCreateRepairTicket}
                  onUpdateTicket={handleUpdateRepairTicket}
                />
              </TabsContent>

              {/* Lost Item Resolution Tab */}
              <TabsContent value="lost-items" className="mt-6">
                <LostItemResolution
                  itemTitle={mockLostItem.itemTitle}
                  replacementCost={mockLostItem.replacementCost}
                  status={mockLostItem.status}
                  patronName={mockLostItem.patronName}
                  activityHistory={mockLostItem.activityHistory}
                  onResolve={handleLostItemResolve}
                  requiresNotesForStatus={LOST_ITEM_REQUIRES_NOTES}
                  patronConsequences={LOST_ITEM_CONSEQUENCES}
                  success="Lost item status updated successfully."
                />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </div>
  );
}