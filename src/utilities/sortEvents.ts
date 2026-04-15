import { Event } from '../types/event';

const sortEvents = (events: Event[]): Event[] => {
    return events.sort((a, b) => {
        const aHasTime = a.hasTime !== false;
        const bHasTime = b.hasTime !== false;
        if (!aHasTime && bHasTime) return -1;
        if (aHasTime && !bHasTime) return 1;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
};

export default sortEvents;
