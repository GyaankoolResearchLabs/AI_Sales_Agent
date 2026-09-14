import { useIntegrations, useConnectIntegration, useDisconnectIntegration } from '../../api/misc';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import PageLoader from '../../components/PageLoader';
import { useToast } from '../../stores/ToastContext';
import { extractErrorMessage } from '../../api/http';

const CATEGORY_LABEL: Record<string, string> = {
  email: 'Email',
  calendar: 'Calendar',
  whatsapp: 'WhatsApp',
  telephony: 'Telephony',
  crm_import: 'CRM Import',
};

const PROVIDER_LABEL: Record<string, string> = {
  gmail: 'Gmail',
  outlook: 'Outlook',
  smtp: 'SMTP',
  google_calendar: 'Google Calendar',
  outlook_calendar: 'Outlook Calendar',
  whatsapp: 'WhatsApp Business',
  twilio: 'Twilio',
  vonage: 'Vonage',
  salesforce: 'Salesforce',
  hubspot: 'HubSpot',
  pipedrive: 'Pipedrive',
};

export default function SettingsIntegrations() {
  const { data, isLoading } = useIntegrations();
  const connect = useConnectIntegration();
  const disconnect = useDisconnectIntegration();
  const toast = useToast();

  if (isLoading) return <PageLoader />;

  const grouped = (data ?? []).reduce<Record<string, typeof data>>((acc, i) => {
    (acc[i.category] ??= []).push(i);
    return acc;
  }, {});

  return (
    <div className="max-w-2xl space-y-5">
      {Object.entries(grouped).map(([category, integrations]) => (
        <div key={category} className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">{CATEGORY_LABEL[category] ?? category}</h2>
          <div className="divide-y divide-gray-100">
            {integrations!.map((i) => (
              <div key={i.provider} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{PROVIDER_LABEL[i.provider] ?? i.provider}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Badge tone={i.status === 'connected' ? 'green' : i.status === 'error' ? 'red' : 'gray'}>
                      {i.status === 'connected' ? 'Connected' : i.status === 'error' ? 'Error' : 'Not connected'}
                    </Badge>
                    <Badge tone={i.environment === 'production' ? 'blue' : 'amber'}>{i.environment}</Badge>
                    {!i.hasProductionCredentials && i.environment === 'development' && (
                      <span className="text-xs text-gray-400">— add API credentials in .env to enable production mode</span>
                    )}
                  </div>
                </div>
                {i.status === 'connected' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      await disconnect.mutateAsync(i.provider);
                      toast.show('Disconnected', 'info');
                    }}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await connect.mutateAsync(i.provider);
                        toast.show(`${PROVIDER_LABEL[i.provider] ?? i.provider} connected (${i.hasProductionCredentials ? 'production' : 'development'} mode)`, 'success');
                      } catch (err) {
                        toast.show(extractErrorMessage(err), 'error');
                      }
                    }}
                    loading={connect.isPending}
                  >
                    Connect
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
