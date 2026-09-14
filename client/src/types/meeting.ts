export interface Meeting {
  _id: string;
  title: string;
  deal?: string;
  contact?: string;
  attendees: string[];
  startTime: string;
  endTime: string;
  location?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  provider: string;
}
