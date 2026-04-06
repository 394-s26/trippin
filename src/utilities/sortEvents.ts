import { Event } from '../types/event';

const sortEvents = (events: Event[]): Event[] => {
    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export default sortEvents;
