import { useState } from 'react';
import { 
  Plus,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Edit,
  Trash2,
  Power,
  PowerOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { notificationTemplates } from '@/data/adminMockData';
import { NotificationTemplate } from '@/types/admin';

export function AdminNotificationsPage() {
  const [templates, setTemplates] = useState(notificationTemplates);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'WHATSAPP': return <MessageSquare className="h-4 w-4" />;
      case 'EMAIL': return <Mail className="h-4 w-4" />;
      case 'SMS': return <Smartphone className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'WHATSAPP': return 'bg-green-500/10 text-green-600';
      case 'EMAIL': return 'bg-blue-500/10 text-blue-600';
      case 'SMS': return 'bg-amber-500/10 text-amber-600';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  const getTriggerLabel = (trigger: string) => {
    const labels: Record<string, string> = {
      DEPOSIT_VALIDATED: 'Dépôt validé',
      PAYMENT_COMPLETED: 'Paiement effectué',
      PROOF_AVAILABLE: 'Preuve disponible',
      DEPOSIT_REJECTED: 'Dépôt rejeté',
      PAYMENT_PROCESSING: 'Paiement en cours',
    };
    return labels[trigger] || trigger;
  };

  const toggleTemplate = (id: string) => {
    setTemplates(templates.map(t => 
      t.id === id ? { ...t, isActive: !t.isActive } : t
    ));
  };

  const handleEdit = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    setEditDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground">
            Templates de messages automatiques
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Créer un template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Nom du template</Label>
                <Input placeholder="Ex: Confirmation de dépôt" />
              </div>
              <div>
                <Label>Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Déclencheur</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un événement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEPOSIT_VALIDATED">Dépôt validé</SelectItem>
                    <SelectItem value="DEPOSIT_REJECTED">Dépôt rejeté</SelectItem>
                    <SelectItem value="PAYMENT_PROCESSING">Paiement en cours</SelectItem>
                    <SelectItem value="PAYMENT_COMPLETED">Paiement effectué</SelectItem>
                    <SelectItem value="PROOF_AVAILABLE">Preuve disponible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contenu du message</Label>
                <Textarea 
                  placeholder="Utilisez {{client_name}}, {{amount}}, {{balance}} comme variables..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variables disponibles: {"{{client_name}}"}, {"{{amount}}"}, {"{{balance}}"}, {"{{beneficiary_name}}"}, {"{{amount_rmb}}"}
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline">Annuler</Button>
                <Button>Créer</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Mode MVP</p>
              <p className="text-sm text-muted-foreground">
                Les notifications sont configurables mais l'envoi réel est simulé. 
                L'intégration avec WhatsApp Business API et SendGrid sera effectuée en production.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      <div className="space-y-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${getTypeColor(template.type)}`}>
                    {getTypeIcon(template.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">
                        {template.name}
                      </h3>
                      <Badge className={getTypeColor(template.type)}>
                        {template.type}
                      </Badge>
                      <Badge variant="secondary">
                        {getTriggerLabel(template.trigger)}
                      </Badge>
                    </div>
                    {template.subject && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Sujet: {template.subject}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {template.content}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    {template.isActive ? (
                      <Power className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <PowerOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Switch
                      checked={template.isActive}
                      onCheckedChange={() => toggleTemplate(template.id)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleEdit(template)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Modifier
                </Button>
                <Button variant="outline" size="sm">
                  <Bell className="h-4 w-4 mr-1" />
                  Tester
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive ml-auto">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Supprimer
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le template</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4 pt-4">
              <div>
                <Label>Nom du template</Label>
                <Input defaultValue={selectedTemplate.name} />
              </div>
              <div>
                <Label>Type</Label>
                <Select defaultValue={selectedTemplate.type}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedTemplate.type === 'EMAIL' && (
                <div>
                  <Label>Sujet</Label>
                  <Input defaultValue={selectedTemplate.subject} />
                </div>
              )}
              <div>
                <Label>Contenu du message</Label>
                <Textarea 
                  defaultValue={selectedTemplate.content}
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={() => setEditDialogOpen(false)}>
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
