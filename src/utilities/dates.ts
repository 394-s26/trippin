export const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

export const isDateInPast = (dateString: string): boolean => {
    return new Date(dateString) < new Date();
};

export const calculateDateDifference = (startDateString: string, endDateString: string): number => {
    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);
    return (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
};
