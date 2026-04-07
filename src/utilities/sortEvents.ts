import { Event } from '../types/event';

const sortEvents = (events: Event[]): Event[] => {
    return events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
};

export default sortEvents;
