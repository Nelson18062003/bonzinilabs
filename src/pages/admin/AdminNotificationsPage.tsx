import { Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AdminLayout } from '@/components/admin/AdminLayout';

export function AdminNotificationsPage() {
  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground">
            Templates de messages automatiques
          </p>
        </div>

        {/* Info Card */}
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Bell className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Mode MVP</p>
                <p className="text-sm text-muted-foreground">
                  Les notifications seront configurables en production. 
                  L'intégration avec WhatsApp Business API et SendGrid sera effectuée ultérieurement.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Fonctionnalité à venir
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}