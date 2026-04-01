# Name

- The app is called Trippin'.

# Users

- Users are people who want to schedule vacations or trips live in collaboration their friend groups.

# Value proposition

An efficient way to collaborate with friends to organize, plan, schedule and finalize trips with friends.

# Key features

Simple mobile-friendly one-screen design with the app name at the top, and below it:
  - large countdown timer, defaulting to 10 minutes, but adjustable at the start of each session,
  - a single start/pause buttonm
  - the team members, shuffled at the start of each session, with the first name highlighted
Simple operations:
  - Tap a name to skip or include that team member in the rotation.
  - Tap start to start the timer, tap again to pause it.
  - When one minute is left, timer beeps and starts flashing.
  - When time is up, timer sounds an alarm, resets time, rotates to the next team member, and waits for start.
Recording-keeping:
  - At end of each turn, the app logs to the console the current time, rotation duration setting, the driver, and the navigators.

# Example scenario

Here is an example session.

- Alice, Bob, Cathy, and Dave are a team of developers.
- Alice, Cathy, and Dave meet to do mob programming for 90 minutes.
- Alice starts the app on her phone. 
- It shows a countdown timer, set to 10 minutes, a start button, and a shuffled list of team member names with checkmarks.
- The first name is highlighted. It happens to be Bob.
- Alice taps Bob's nam because he is not there. The highlight moves to Dave.
- Dave sits at the keyboard and starts the timer. He begins entering code suggested by the other team members. 
- Pizza arrives, so Dave stops the timer and grabs a slice. After a few minutes, he starts the timer to continue his turn.
- A beep at 9 minutes warns the team is almost time to rotate.
- Whem time goes to zero, an alarm sounds. Dave stops. The highlight moves to Cathy
- Cathy taps the start button to begin her turn.

# Coding notes

- Use setInterval() to implement the timer.
- Use AudioContext to play sounds.
- Define and import a MockAudioContext class for unit testing sounds. 

# Testing notes
- Define unit tests for skipping team members in the rotation.
- Define unit tests for when Start and Stop should appear.
- Define unit tests for when sounds should happen.
