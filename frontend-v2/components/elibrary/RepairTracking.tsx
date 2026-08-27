"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Wrench, Calendar, Clock, CheckCircle, AlertCircle, Plus, Upload, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export type RepairStatus = "scheduled" | "in-progress" | "waiting-for-parts" | "completed" | "cancelled";
export type RepairPriority = "low" | "medium" | "high" | "critical";

export interface RepairLog {
  id: string;
  date: string;
  technician: string;
  notes: string;
  cost?: number;
}

export interface RepairTicket {
  id: string;
  itemId: string;
  itemTitle: string;
  issueDescription: string;
  priority: RepairPriority;
  status: RepairStatus;
  createdAt: string;
  scheduledDate?: string;
  completedDate?: string;
  estimatedCost?: number;
  actualCost?: number;
  repairLogs: RepairLog[];
  evidence: string[]; // URLs to photos/documents
}

interface RepairTrackingProps {
  tickets: RepairTicket[];
  isLoading?: boolean;
  error?: string;
  onCreateTicket: (ticket: Omit<RepairTicket, "id" | "createdAt" | "repairLogs">) => Promise<void>;
  onUpdateTicket: (id: string, updates: Partial<RepairTicket>) => Promise<void>;
}

const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  scheduled: "Scheduled",
  "in-progress": "In Progress",
  "waiting-for-parts": "Waiting for Parts",
  completed: "Completed",
  cancelled: "Cancelled",
};

const REPAIR_PRIORITY_LABELS: Record<RepairPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const STATUS_VARIANTS: Record<RepairStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  "in-progress": "bg-yellow-100 text-yellow-800",
  "waiting-for-parts": "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};

const PRIORITY_VARIANTS: Record<RepairPriority, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export function RepairTracking({
  tickets: initialTickets,
  isLoading = false,
  error = "",
  onCreateTicket,
  onUpdateTicket,
}: RepairTrackingProps) {
  const [tickets, setTickets] = useState<RepairTicket[]>(initialTickets);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [newTicket, setNewTicket] = useState({
    itemId: "",
    itemTitle: "",
    issueDescription: "",
    priority: "medium" as RepairPriority,
    status: "scheduled" as RepairStatus,
    estimatedCost: 0,
    evidence: [] as string[],
  });

  const filteredTickets = activeTab === "all" 
    ? tickets 
    : tickets.filter(t => t.status === activeTab);

  const stats = {
    total: tickets.length,
    inProgress: tickets.filter(t => t.status === "in-progress").length,
    waitingParts: tickets.filter(t => t.status === "waiting-for-parts").length,
    completed: tickets.filter(t => t.status === "completed").length,
  };

  const handleCreateTicket = async () => {
    if (!newTicket.itemTitle || !newTicket.issueDescription) return;
    
    setIsSubmitting(true);
    await onCreateTicket(newTicket);
    
    // Add to local state
    const createdTicket: RepairTicket = {
      ...newTicket,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      repairLogs: [],
    };
    
    setTickets((prev) => [...prev, createdTicket]);
    setNewTicket({
      itemId: "",
      itemTitle: "",
      issueDescription: "",
      priority: "medium",
      status: "scheduled",
      estimatedCost: 0,
      evidence: [],
    });
    setIsCreating(false);
    setIsSubmitting(false);
  };

  const handleStatusChange = async (id: string, newStatus: RepairStatus) => {
    setIsSubmitting(true);
    await onUpdateTicket(id, { status: newStatus });
    
    setTickets((prev) => 
      prev.map(t => t.id === id ? { ...t, status: newStatus } : t)
    );
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Repairs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-yellow-600">{stats.inProgress}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-orange-600">{stats.waitingParts}</p>
            <p className="text-sm text-muted-foreground">Waiting for Parts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="in-progress">In Progress</TabsTrigger>
            <TabsTrigger value="waiting-for-parts">Waiting</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
          <Button onClick={() => setIsCreating(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Repair Ticket
          </Button>
        </div>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {activeTab === "all" ? "All Repair Tickets" : `${REPAIR_STATUS_LABELS[activeTab as RepairStatus]} Tickets`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Wrench className="h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No repair tickets</h3>
                  <p className="text-sm text-gray-500 mt-1">There are no tickets in this category.</p>
                  <Button onClick={() => setIsCreating(true)} className="mt-4">
                    Create your first ticket
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Est. Cost</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{ticket.itemTitle}</p>
                              <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {ticket.issueDescription}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={PRIORITY_VARIANTS[ticket.priority]}>
                              {REPAIR_PRIORITY_LABELS[ticket.priority]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={ticket.status}
                              onValueChange={(value: RepairStatus) => handleStatusChange(ticket.id, value)}
                              disabled={isSubmitting}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(REPAIR_STATUS_LABELS).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3 mr-1" />
                              {new Date(ticket.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            {ticket.estimatedCost ? `$${ticket.estimatedCost.toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <Clock className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View details</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create New Ticket Modal/Drawer */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Create New Repair Ticket</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Item Title *</label>
                <Input
                  value={newTicket.itemTitle}
                  onChange={(e) => setNewTicket({ ...newTicket, itemTitle: e.target.value })}
                  placeholder="Enter item title"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select
                    value={newTicket.priority}
                    onValueChange={(value: RepairPriority) => setNewTicket({ ...newTicket, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REPAIR_PRIORITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Estimated Cost</label>
                  <Input
                    type="number"
                    value={newTicket.estimatedCost || ""}
                    onChange={(e) => setNewTicket({ ...newTicket, estimatedCost: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Issue Description *</label>
                <Textarea
                  value={newTicket.issueDescription}
                  onChange={(e) => setNewTicket({ ...newTicket, issueDescription: e.target.value })}
                  placeholder="Describe the issue with this item..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Evidence (Photos/Documents)</label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Input
                    type="file"
                    id="repair-evidence-upload"
                    className="hidden"
                    accept="image/*,.pdf"
                    multiple
                  />
                  <label htmlFor="repair-evidence-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center">
                      <Upload className="h-8 w-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600">Upload evidence</span>
                    </div>
                  </label>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-4">
                <Button variant="secondary" onClick={() => setIsCreating(false)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateTicket} 
                  disabled={isSubmitting || !newTicket.itemTitle || !newTicket.issueDescription}
                  className="flex-1"
                >
                  {isSubmitting ? "Creating..." : "Create Ticket"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}