import {setGlobalOptions} from "firebase-functions";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue, Timestamp} from "firebase-admin/firestore";
import {defineSecret} from "firebase-functions/params";
import * as nodemailer from "nodemailer";

initializeApp();
const db = getFirestore();

export {autoFillDay} from "./autoFill";

setGlobalOptions({maxInstances: 10});

// Secrets — set via: firebase functions:secrets:set GMAIL_EMAIL / GMAIL_APP_PASSWORD
const gmailEmail = defineSecret("GMAIL_EMAIL");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

// The URL users are directed to when they receive an invite
const SIGNUP_URL = "https://trippin-project-20a74.web.app";

interface InviteRequest {
  email: string;
  tripId: string;
  tripName: string;
  role: string;
}

/**
 * Callable function: sends an invite email to a non-registered user
 * and stores the invite in Firestore so we can auto-add them on signup.
 */
export const sendInviteEmail = onCall(
  {secrets: [gmailEmail, gmailAppPassword]},
  async (request) => {
    // Must be authenticated
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in to send invites.");
    }

    const {email, tripId, tripName, role} = request.data as InviteRequest;

    if (!email || !tripId || !tripName || !role) {
      throw new HttpsError("invalid-argument", "Missing required fields.");
    }

    const actorUid = request.auth.uid;

    // Verify the actor has invite_member permission on this trip
    const tripSnap = await db.doc(`trips/${tripId}`).get();
    if (!tripSnap.exists) {
      throw new HttpsError("not-found", "Trip not found.");
    }
    const tripData = tripSnap.data()!;
    const actorRole = tripData.permissions?.[actorUid];
    if (tripData.userId !== actorUid && !actorRole) {
      throw new HttpsError("permission-denied", "You are not a member of this trip.");
    }

    // Get inviter name for the email
    const actorSnap = await db.doc(`users/${actorUid}`).get();
    const actorData = actorSnap.data();
    const inviterName = actorData
      ? `${actorData.firstName} ${actorData.lastName}`.trim()
      : "A Trippin user";

    // Check if there's already a pending invite for this email + trip
    const existingInvites = await db.collection("invites")
      .where("email", "==", email.toLowerCase())
      .where("tripId", "==", tripId)
      .where("status", "==", "pending")
      .get();

    if (!existingInvites.empty) {
      throw new HttpsError("already-exists", "An invite has already been sent to this email for this trip.");
    }

    // Store the invite in Firestore
    const inviteRef = await db.collection("invites").add({
      email: email.toLowerCase(),
      tripId,
      tripName,
      role,
      invitedBy: actorUid,
      inviterName,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    // Send the email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailEmail.value(),
        pass: gmailAppPassword.value(),
      },
    });

    const mailOptions = {
      from: `"Trippin" <${gmailEmail.value()}>`,
      to: email,
      subject: `${inviterName} invited you to join "${tripName}" on Trippin!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
          <h1 style="color: #15803d; font-size: 28px; margin-bottom: 8px;">Trippin</h1>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">Plan trips together, effortlessly.</p>

          <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <p style="color: #374151; font-size: 16px; margin: 0 0 12px;">
              <strong>${inviterName}</strong> has invited you to collaborate on the trip
              <strong>"${tripName}"</strong> as a <strong>${role}</strong>.
            </p>
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              Trippin is a collaborative trip planning app where friends can organize itineraries,
              vote on activities, split costs, and keep everything in one place.
            </p>
          </div>

          <a href="${SIGNUP_URL}" target="_blank"
             style="display: inline-block; background: #15803d; color: white; text-decoration: none;
                    padding: 12px 32px; border-radius: 10px; font-weight: 600; font-size: 15px;">
            Sign up &amp; join the trip
          </a>

          <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
            Just sign up with this email address (<strong>${email}</strong>) and you'll be
            automatically added to the trip.
          </p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (err) {
      // Clean up the invite doc if email fails
      await inviteRef.delete();
      console.error("Failed to send invite email:", err);
      throw new HttpsError("internal", "Failed to send the invite email. Please try again.");
    }

    return {success: true, inviteId: inviteRef.id};
  }
);

// Note: invite acceptance is handled client-side (see inviteService.ts).
// The client reads pending invites, updates the trip doc (self-enrollment),
// and marks the invite as accepted — all via Firestore rules.

/**
 * Runs every 30 minutes and deletes selection session documents whose
 * lastActive timestamp is older than 1 hour. This catches orphaned docs
 * left behind when a browser tab closes without triggering React cleanup.
 */
export const cleanupStaleSessions = onSchedule("every 30 minutes", async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);

  const stale = await db.collectionGroup("selections")
    .where("lastActive", "<", cutoff)
    .get();

  if (stale.empty) return;

  const batch = db.batch();
  for (const doc of stale.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();

  console.log(`Cleaned up ${stale.size} stale selection session(s).`);
});
