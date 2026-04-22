// Event-specific SVG icon library for Trippin'.

import { ReactElement } from 'react';

interface IconProps {
  size?: number;
  className?: string;
}


export const FlightEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M2 22h20" />
    <path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18Z" />
  </svg>
);

export const TrainEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <rect width="16" height="16" x="4" y="3" rx="2" />
    <path d="M4 11h16" />
    <path d="M12 3v8" />
    <path d="m8 19-2 3" />
    <path d="m18 22-2-3" />
    <path d="M8 15h.01" />
    <path d="M16 15h.01" />
  </svg>
);

export const BusEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M8 6v6" />
    <path d="M15 6v6" />
    <path d="M2 12h19.6" />
    <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
    <circle cx="7" cy="18" r="2" />
    <path d="M9 18h5" />
    <circle cx="16" cy="18" r="2" />
  </svg>
);

export const CarEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" />
    <path d="M9 17h6" />
    <circle cx="17" cy="17" r="2" />
  </svg>
);

export const BoatEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M12 10.189V14" />
    <path d="M12 2v3" />
    <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" />
    <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-8.188-3.639a2 2 0 0 0-1.624 0L3 14a11.6 11.6 0 0 0 2.81 7.76" />
    <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1s1.2 1 2.5 1c2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
  </svg>
);



export const HotelEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M10 22v-6.57" />
    <path d="M12 11h.01" />
    <path d="M12 7h.01" />
    <path d="M14 15.43V22" />
    <path d="M15 16a5 5 0 0 0-6 0" />
    <path d="M16 11h.01" />
    <path d="M16 7h.01" />
    <path d="M8 11h.01" />
    <path d="M8 7h.01" />
    <rect x="4" y="2" width="16" height="20" rx="2" />
  </svg>
);

export const AirbnbEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M2 4v16" />
    <path d="M2 8h18a2 2 0 0 1 2 2v10" />
    <path d="M2 17h20" />
    <path d="M6 8v9" /> 
  </svg>
);

export const CampingEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <circle cx="4" cy="4" r="2" />
    <path d="m14 5 3-3 3 3" />
    <path d="m14 10 3-3 3 3" />
    <path d="M17 14V2" />
    <path d="M17 14H7l-5 8h20Z" />
    <path d="M8 14v8" />
    <path d="m9 14 5 8" />  
  </svg>
);





export const HikingEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" />
    <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" />
    <path d="M16 17h4" />
    <path d="M4 13h4" />
  </svg>
);


export const SwimmingEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    aria-hidden="true"
    className={className}
  >
    <path d="M18,3c-1.7,0-3,1.3-3,3s1.3,3,3,3s3-1.3,3-3S19.7,3,18,3z M18,7c-0.6,0-1-0.4-1-1s0.4-1,1-1s1,0.4,1,1S18.6,7,18,7z" />
    <path d="M4,14.4c0.4,0,0.6,0.1,1,0.4c0.5,0.4,1.1,0.9,2.2,0.9s1.8-0.5,2.2-0.9c0.3-0.3,0.5-0.4,1-0.4c0.4,0,0.6,0.1,1,0.4 c0.5,0.4,1.1,0.9,2.2,0.9c1.2,0,1.8-0.5,2.2-0.9c0.4-0.3,0.5-0.4,1-0.4c0.5,0,0.6,0.1,1,0.4c0.5,0.4,1.1,0.9,2.2,0.9 c0.6,0,1-0.4,1-1s-0.4-1-1-1c-0.5,0-0.6-0.1-1-0.4c-0.5-0.4-1.1-0.9-2.2-0.9c-1.2,0-1.8,0.5-2.2,0.9c-0.4,0.3-0.5,0.4-1,0.4 c-0.2,0-0.3,0-0.4-0.1l3.5-2.8c0.3-0.2,0.4-0.6,0.4-0.9s-0.3-0.6-0.6-0.8l-5-2c-0.3-0.1-0.7-0.1-0.9,0.1l-3,2 C7,9.5,6.9,10.1,7.2,10.6c0.3,0.5,0.9,0.6,1.4,0.3l2.6-1.7l2.9,1.2l-2.7,2.2c-0.3-0.1-0.5-0.1-0.9-0.1c-1.2,0-1.8,0.5-2.2,0.9 c-0.3,0.3-0.5,0.4-1,0.4s-0.6-0.1-1-0.4c-0.5-0.4-1.1-0.9-2.2-0.9c-0.6,0-1,0.4-1,1S3.4,14.4,4,14.4z" />
    <path d="M4,18.4c0.4,0,0.6,0.1,1,0.4c0.5,0.4,1.1,0.9,2.2,0.9s1.8-0.5,2.2-0.9c0.3-0.3,0.5-0.4,1-0.4c0.4,0,0.6,0.1,1,0.4 c0.5,0.4,1.1,0.9,2.2,0.9c1.2,0,1.8-0.5,2.2-0.9c0.4-0.3,0.5-0.4,1-0.4c0.5,0,0.6,0.1,1,0.4c0.5,0.4,1.1,0.9,2.2,0.9 c0.6,0,1-0.4,1-1s-0.4-1-1-1c-0.5,0-0.6-0.1-1-0.4c-0.5-0.4-1.1-0.9-2.2-0.9c-1.2,0-1.8,0.5-2.2,0.9c-0.4,0.3-0.5,0.4-1,0.4 c-0.4,0-0.6-0.1-1-0.4c-0.5-0.4-1.1-0.9-2.2-0.9s-1.8,0.5-2.2,0.9c-0.3,0.3-0.5,0.4-1,0.4s-0.6-0.1-1-0.4c-0.5-0.4-1.1-0.9-2.2-0.9 c-0.6,0-1,0.4-1,1S3.4,18.4,4,18.4z" />
  </svg>
);

export const RaftingEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M18 17a1 1 0 0 0-1 1v1a2 2 0 1 0 2-2z" />
    <path d="M20.97 3.61a.45.45 0 0 0-.58-.58C10.2 6.6 6.6 10.2 3.03 20.39a.45.45 0 0 0 .58.58C13.8 17.4 17.4 13.8 20.97 3.61" />
    <path d="m6.707 6.707 10.586 10.586" />
    <path d="M7 5a2 2 0 1 0-2 2h1a1 1 0 0 0 1-1z" />  
  </svg>
);

export const SurfingEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <circle cx="10" cy="3" r="2" />
    <path d="M10 7v4" />
    <path d="m8 9 2 2 2-2" />
    <path d="m5 17 14-4" />
    <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
  </svg>
);

export const SkiingEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <circle cx="14" cy="3" r="2" />
    <path d="m14 7-3 7" />
    <path d="m8 20 3-6" />
    <path d="m14 20-3-6" />
    <path d="m4 20 17-4" />
    <path d="M7 6l4 8" />
  </svg>
);

export const ShoppingEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M2.048 18.566A2 2 0 0 0 4 21h16a2 2 0 0 0 1.952-2.434l-2-9A2 2 0 0 0 18 8H6a2 2 0 0 0-1.952 1.566z"/><path d="M8 11V6a4 4 0 0 1 8 0v5"/>
  </svg>
);

export const SightseeingEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M10 10h4"/><path d="M19 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3"/><path d="M20 21a2 2 0 0 0 2-2v-3.851c0-1.39-2-2.962-2-4.829V8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2z"/><path d="M 22 16 L 2 16"/><path d="M4 21a2 2 0 0 1-2-2v-3.851c0-1.39 2-2.962 2-4.829V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2z"/><path d="M9 7V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3"/>
  </svg>
);



// TODO Put real icon
export const MuseumEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/>
    <path d="m18 15 4-4"/>
    <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>
  </svg>
);

// TODO Put real icon
export const TourEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/>
    <path d="m18 15 4-4"/>
    <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>
  </svg>
);

// TODO Put real icon
export const GameEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/>
    <path d="m18 15 4-4"/>
    <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>
  </svg>
);

// TODO Put real icon
export const ConcertEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/>
    <path d="m18 15 4-4"/>
    <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>
  </svg>
);

// TODO Put real icon
export const BeachEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/>
    <path d="m18 15 4-4"/>
    <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>
  </svg>
);

// TODO Put real icon
export const ParkEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/>
    <path d="m18 15 4-4"/>
    <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>
  </svg>
);

// TODO Put real icon
export const ZooEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/>
    <path d="m18 15 4-4"/>
    <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>
  </svg>
);

// TODO Put real icon
export const AquariumEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/>
    <path d="m18 15 4-4"/>
    <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>
  </svg>
);




export const RestaurantEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
    <path d="M7 2v20"/>
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
  </svg>
);

export const CafeEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M10 2v2"/>
    <path d="M14 2v2"/>
    <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>
    <path d="M6 2v2"/>  
  </svg>
);

export const BarEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M17 11h1a3 3 0 0 1 0 6h-1"/>
    <path d="M9 12v6"/>
    <path d="M13 12v6"/>
    <path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5Z"/>
    <path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"/>
  </svg>
);

export const ClubEventIcon = ({ size = 18, className }: IconProps): ReactElement => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M8 22h8"/>
    <path d="M7 10h10"/>
    <path d="M12 15v7"/>
    <path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/>
  </svg>
);

export const EVENT_TYPE_ICONS: Record<string, (props: IconProps) => ReactElement> = {
  Flight: FlightEventIcon,
  Train: TrainEventIcon,
  Bus: BusEventIcon,
  Car: CarEventIcon,
  Boat: BoatEventIcon,
  Hotel: HotelEventIcon,
  Airbnb: AirbnbEventIcon,
  Camping: CampingEventIcon,
  Hiking: HikingEventIcon,
  Swimming: SwimmingEventIcon,
  Rafting: RaftingEventIcon,
  Surfing: SurfingEventIcon,
  Skiing: SkiingEventIcon,
  Shopping: ShoppingEventIcon,
  Sightseeing: SightseeingEventIcon,
  Museum: MuseumEventIcon,
  Tour: TourEventIcon,
  Game: GameEventIcon,
  Concert: ConcertEventIcon,
  Beach: BeachEventIcon,
  Park: ParkEventIcon,
  Zoo: ZooEventIcon,
  Aquarium: AquariumEventIcon,
  Restaurant: RestaurantEventIcon,
  Cafe: CafeEventIcon,
  Bar: BarEventIcon,
  Club: ClubEventIcon,
};
