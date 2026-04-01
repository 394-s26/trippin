# Name

- The app is called Trippin'.

# Users

- Users are people who want to schedule vacations or trips live in collaboration their friend groups.

# Value proposition

An efficient way to collaborate with friends to organize, plan, schedule and finalize trips with friends.

# Key features

Simple mobile-friendly one-screen design with the app name on the left and user profile icon on the right at the top, and below it:
  - A vertical sequence of scheduled events, with the most recent events at the top and latest events at the bottom
  - A plus button in the bottom right that when clicked opens an event creation menu:
    - Can specify the event type (Hotel, Restaurant, Activity), name, cost, location address (optional)
    - Ensure the date and time can be selected (with timezone option)
  - Conflicting events are added to the itinerary but display red text to flag the user to update.
Simple operations:
  - Name the trip at the top
  - Add an image for the trip as a background header
  - Setting a budget for the trip
  - Click the plus icon to create a new event
  - Edit icon on existing events to modify their fields
  - Delete icon on existing events to remove events

# Example scenario

Here is an example session.

- Tanner is a Northwestern student looking to enjoy his spring break.
- Tanner creates a mental model of his trip with a budget in mind.
- Tanner opens the Trippin' app to determine the fine details of his trip.
- Trippin' shows an itinerary with event entries, a + button to add new events, edit and delete icons on existing events, a trip banner with a background image and trip name, and a button to set the total budget.
- Tanner names his trip and uploads a photo to be the header background.
- He taps the budget button and sets a total trip budget of $600.
- Tanner taps the + button to add his first event. He selects Hotel, names it "Chicago Hotel", enters $250 as the cost, and picks Thursday April 2nd at 4:00 PM CT as his checkin.
- He adds a Restaurant event named "Chicago Restaurant", adds $80, and sets the date as Wednesday April 1st at 2:00 PM.
- The itinerary reorders the events by date and time. The restaurant now appears above the hotel and sectioned by day of the week.
- Tanner notices a conflicting event entry and taps the event update icon to change its time.
- Tanner notices a duplicate restaurant entry and taps the delete icon to remove it.
- The total expenses currently sit at $330 for Tanner which is within his budget. Tanner's expenses are displayed automatically in green text, turning more red the closer the expenses get to the budget amount.
- Tanner scrolls through the finalized schedule, and he is ready for his trip.

# Coding notes

- Use Firebase Storage to handle trip banner image uploads.
- Sort events on the itinerary client-side by date and time whenever the events are updated.
- Use Firestore's onSnapshot() to sync itinerary changes across collaborators in real time.

# Testing notes

- Define unit tests for adding, editing, and deleting events.
- Define unit tests for budget calculations and per-person share splitting.
- Define unit tests for chronological reordering of events after additions or edits.
