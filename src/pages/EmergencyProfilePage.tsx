// File: src/pages/EmergencyProfilePage.tsx

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
} from "react";

import { Link } from "react-router-dom";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "../lib/firebase";
import { useAuth } from "../auth/AuthContext";

import {
  getEmergencyProfile,
  saveEmergencyProfile,
} from "../repositories/emergencyProfileRepository";

import {
  DEFAULT_EMERGENCY_PRIVACY,
  type BloodGroup,
  type EmergencyContact,
  type EmergencyPrivacy,
  type EmergencyProfile,
} from "../types/emergencyProfile";

const BLOOD_GROUPS: BloodGroup[] = [
  "Unknown",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];

const MAX_INSTRUCTION_LENGTH = 2000;
const MAX_EMERGENCY_CONTACTS = 10;

const PRIVACY_OPTIONS: {
  key: keyof EmergencyPrivacy;
  label: string;
}[] = [
  {
    key: "showPhoto",
    label: "Profile photo",
  },
  {
    key: "showHomeAddress",
    label: "Home address",
  },
  {
    key: "showDateOfBirth",
    label: "Date of birth",
  },
  {
    key: "showBloodGroup",
    label: "Blood group",
  },
  {
    key: "showAllergies",
    label: "Allergies",
  },
  {
    key: "showMedicalConditions",
    label: "Medical conditions",
  },
  {
    key: "showMedications",
    label: "Medications",
  },
  {
    key: "showEmergencyContacts",
    label: "Emergency contact phone numbers",
  },
  {
    key: "showEmergencyInstructions",
    label: "Emergency instructions",
  },
];

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 " +
  "bg-white px-4 py-3 text-base text-slate-900 " +
  "placeholder:text-slate-400 " +
  "focus:border-blue-600 focus:outline-none " +
  "focus:ring-2 focus:ring-blue-100";

const sectionClass =
  "rounded-2xl border border-slate-200 " +
  "bg-white p-5 shadow-sm sm:p-7";

function textToList(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(value: string[]): string {
  return value.join("\n");
}

function createContact(
  isPrimary: boolean
): EmergencyContact {
  return {
    id: crypto.randomUUID(),
    name: "",
    relationship: "",
    phone: "",
    email: "",
    isPrimary,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function getToday(): string {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(
    2,
    "0"
  );
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function EmergencyProfilePage() {
  const { user } = useAuth();

  const successRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [existingProfile, setExistingProfile] =
    useState<EmergencyProfile | null>(null);

  const [fullName, setFullName] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  const [bloodGroup, setBloodGroup] =
    useState<BloodGroup>("Unknown");

  const [allergies, setAllergies] = useState("");
  const [medicalConditions, setMedicalConditions] =
    useState("");
  const [medications, setMedications] = useState("");

  const [
    emergencyInstructions,
    setEmergencyInstructions,
  ] = useState("");

  const [contacts, setContacts] =
    useState<EmergencyContact[]>([]);

  const [privacy, setPrivacy] =
    useState<EmergencyPrivacy>({
      ...DEFAULT_EMERGENCY_PRIVACY,
    });

  const [consentGiven, setConsentGiven] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
  if (!user) {
    return;
  }

    let cancelled = false;

    async function loadProfile() {
      try {
        const profile = await getEmergencyProfile(
          user!.uid
        );

        if (cancelled) {
          return;
        }

        if (profile) {
          setExistingProfile(profile);

          setFullName(profile.fullName);
          setHomeAddress(profile.homeAddress || "");
          setDateOfBirth(profile.dateOfBirth);
          setBloodGroup(profile.bloodGroup);

          setAllergies(
            listToText(profile.allergies)
          );

          setMedicalConditions(
            listToText(profile.medicalConditions)
          );

          setMedications(
            listToText(profile.medications)
          );

          setEmergencyInstructions(
            profile.emergencyInstructions
          );

          setContacts(
            profile.emergencyContacts.map(
              (contact) => ({
                ...contact,
                email: contact.email || "",
              })
            )
          );

          setPrivacy({
            ...DEFAULT_EMERGENCY_PRIVACY,
            ...profile.privacy,
          });

          setConsentGiven(profile.consentGiven);
        } else {
          setExistingProfile(null);

          setFullName(user!.displayName || "");
          setHomeAddress("");
          setDateOfBirth("");
          setBloodGroup("Unknown");

          setAllergies("");
          setMedicalConditions("");
          setMedications("");
          setEmergencyInstructions("");

          setContacts([]);

          setPrivacy({
            ...DEFAULT_EMERGENCY_PRIVACY,
          });

          setConsentGiven(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!success || !successRef.current) {
      return;
    }

    successRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    successRef.current.focus({
      preventScroll: true,
    });
  }, [success]);

  function clearMessages(): void {
    setError("");
    setSuccess("");
  }

  function reportError(message: string, fieldId?: string): void {
    setError(message);
    setSuccess("");

    window.requestAnimationFrame(() => {
      const target = fieldId
        ? document.getElementById(fieldId)
        : errorRef.current;

      if (!target) return;

      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });

      if (fieldId && target instanceof HTMLElement) {
        target.classList.add("!border-red-500", "!ring-2", "!ring-red-200");
        window.setTimeout(() => {
          target.classList.remove("!border-red-500", "!ring-2", "!ring-red-200");
        }, 7000);
      }
    });
  }

  function describeSaveError(error: unknown): { message: string; fieldId?: string } {
    const rawMessage = error instanceof Error ? error.message : "";

    if (rawMessage.includes("Missing or insufficient permissions")) {
      return {
        fieldId: "homeAddress",
        message:
          "Firebase denied the profile save. The Home address field is currently being sent by this form, but the deployed Firestore rules must explicitly allow the homeAddress field. Deploy the updated firestore.rules file. If the error remains afterward, check the signed-in account and the profile's ownerId/createdAt/updatedAt rule conditions.",
      };
    }

    return {
      message: rawMessage || "Something went wrong. Please try again.",
    };
  }

  function addContact(): void {
    clearMessages();

    if (contacts.length >= MAX_EMERGENCY_CONTACTS) {
      setError(
        `You can register up to ${MAX_EMERGENCY_CONTACTS} emergency contacts.`
      );
      return;
    }

    setContacts((current) => [
      ...current,
      createContact(current.length === 0),
    ]);
  }

  function updateContact(
    id: string,
    field: keyof EmergencyContact,
    value: string
  ): void {
    clearMessages();

    setContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              [field]: value,
            }
          : contact
      )
    );
  }

  function removeContact(id: string): void {
    clearMessages();

    setContacts((current) => {
      const remaining = current.filter(
        (contact) => contact.id !== id
      );

      if (
        remaining.length > 0 &&
        !remaining.some(
          (contact) => contact.isPrimary
        )
      ) {
        return remaining.map((contact, index) => ({
          ...contact,
          isPrimary: index === 0,
        }));
      }

      return remaining;
    });
  }

  function setPrimaryContact(id: string): void {
    clearMessages();

    setContacts((current) =>
      current.map((contact) => ({
        ...contact,
        isPrimary: contact.id === id,
      }))
    );
  }

  function updatePrivacy(
    field: keyof EmergencyPrivacy,
    value: boolean
  ): void {
    clearMessages();

    if (field === "showHomeAddress" && value) {
      const confirmed = window.confirm(
        "Your home address is sensitive information. If enabled, it may be visible to anyone who scans your active Emergency QR. Show it publicly?"
      );
      if (!confirmed) return;
    }

    setPrivacy((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handlePhotoUpload(
    event: ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !user || photoUploading) return;

    if (!existingProfile) {
      setError("Save your emergency profile first, then upload its photo.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("The profile photo must be 5 MB or smaller.");
      return;
    }

    clearMessages();
    setPhotoUploading(true);

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const photoRef = storageRef(
        storage,
        `emergency-profile-photos/${user.uid}/${Date.now()}-${safeName}`
      );

      await uploadBytes(photoRef, file, { contentType: file.type });
      const photoUrl = await getDownloadURL(photoRef);
      const now = new Date().toISOString();

      const updatedProfile: EmergencyProfile = {
        ...existingProfile,
        photoUrl,
        updatedAt: now,
      };

      await saveEmergencyProfile(updatedProfile);
      setExistingProfile(updatedProfile);
      setSuccess("Profile photo uploaded and saved successfully.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleRemovePhoto(): Promise<void> {
    if (!user || !existingProfile?.photoUrl || photoUploading) return;

    if (!window.confirm("Remove your profile photo?")) return;

    clearMessages();
    setPhotoUploading(true);

    try {
      const oldPhotoUrl = existingProfile.photoUrl;
      const updatedProfile: EmergencyProfile = {
        ...existingProfile,
        photoUrl: "",
        updatedAt: new Date().toISOString(),
      };

      await saveEmergencyProfile(updatedProfile);
      setExistingProfile(updatedProfile);

      try {
        await deleteObject(storageRef(storage, oldPhotoUrl));
      } catch {
        // The profile is already updated; an old storage object can be cleaned up separately.
      }

      setSuccess("Profile photo removed.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    if (!user || saving) {
      return;
    }

    clearMessages();

    if (!fullName.trim()) {
      reportError("Please enter your full name.", "fullName");
      return;
    }

    if (
      dateOfBirth &&
      dateOfBirth > getToday()
    ) {
      reportError(
        "Date of birth cannot be in the future.",
        "dateOfBirth"
      );
      return;
    }

    if (
      contacts.length === 0 ||
      contacts.length > MAX_EMERGENCY_CONTACTS
    ) {
      reportError(
        `Register between 1 and ${MAX_EMERGENCY_CONTACTS} emergency contacts.`,
        "addEmergencyContact"
      );
      return;
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const contact of contacts) {
      if (
        !contact.name.trim() ||
        !contact.phone.trim()
      ) {
        reportError(
          "Enter the name and phone number for every emergency contact.",
          !contact.name.trim()
            ? `contact-name-${contact.id}`
            : `contact-phone-${contact.id}`
        );
        return;
      }

      const email = (contact.email || "")
        .trim();

      if (
        !email ||
        email.length > 254 ||
        !emailPattern.test(email)
      ) {
        reportError(
          `Enter a valid email address for ${contact.name || `Contact ${contacts.indexOf(contact) + 1}`}.`,
          `contact-email-${contact.id}`
        );
        return;
      }
    }

    const primaryContacts = contacts.filter(
      (contact) => contact.isPrimary
    );

    if (primaryContacts.length !== 1) {
      reportError(
        "Select exactly one primary emergency contact.",
        "primaryEmergencyContact"
      );
      return;
    }

    if (!consentGiven) {
      reportError(
        "Please acknowledge the consent statement.",
        "consentGiven"
      );
      return;
    }

    setSaving(true);

    try {
      const now = new Date().toISOString();

      const profile: EmergencyProfile = {
        ownerId: user.uid,

        fullName: fullName.trim(),
        homeAddress: homeAddress.trim(),

        photoUrl:
          existingProfile?.photoUrl || "",

        dateOfBirth,
        bloodGroup,

        allergies: textToList(allergies),

        medicalConditions:
          textToList(medicalConditions),

        medications: textToList(medications),

        emergencyContacts: contacts.map(
          (contact) => ({
            ...contact,
            name: contact.name.trim(),
            relationship:
              contact.relationship.trim(),
            phone: contact.phone.trim(),
            email: (contact.email || "")
              .trim()
              .toLowerCase(),
          })
        ),

        emergencyInstructions:
          emergencyInstructions.trim(),

        privacy,

        consentGiven: true,

        consentUpdatedAt:
          existingProfile?.consentUpdatedAt &&
          existingProfile.consentGiven
            ? existingProfile.consentUpdatedAt
            : now,

        createdAt:
          existingProfile?.createdAt || now,

        updatedAt: now,
      };

      await saveEmergencyProfile(profile);

      setExistingProfile(profile);

      setSuccess(
        "Your emergency profile has been saved successfully."
      );
    } catch (err) {
      const details = describeSaveError(err);
      reportError(details.message, details.fieldId);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p
          role="status"
          className="text-slate-600"
        >
          Loading your emergency profile...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Link
          to="/dashboard"
          className="inline-flex items-center text-sm font-semibold text-blue-700 hover:underline"
        >
          ← Back to Dashboard
        </Link>

        <header className="mb-8 mt-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            HealthPassport Emergency QR
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            My Emergency Profile
          </h1>

          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Keep your essential medical information
            and emergency contacts up to date so
            someone can find the information they need
            when helping you.
          </p>
        </header>

        {success && (
          <div
            ref={successRef}
            tabIndex={-1}
            role="status"
            className="mb-6 rounded-xl border border-green-200 bg-green-50 p-5 outline-none"
          >
            <h2 className="font-bold text-green-900">
              Profile saved successfully
            </h2>

            <p className="mt-2 text-sm leading-6 text-green-800">
              {success}
            </p>

            <Link
              to="/my-qr"
              className="mt-4 inline-flex items-center justify-center rounded-lg border border-green-800 bg-green-700 px-5 py-3 font-semibold !text-white shadow-sm transition-colors duration-150 hover:border-green-900 hover:bg-green-800 hover:!text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-200 active:bg-green-900"
              style={{ color: "#ffffff", backgroundColor: "#15803d" }}
            >
              <span style={{ color: "#ffffff" }}>Continue to My QR →</span>
            </Link>
          </div>
        )}

        {error && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800 outline-none focus:ring-2 focus:ring-red-300"
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <div className="min-w-0 space-y-5">
          {/* Personal information */}

          <section className={sectionClass}>
            <h2 className="text-xl font-bold text-slate-900">
              Personal Information
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Provide the basic information that may
              help someone identify you during an
              emergency.
            </p>

            <div className="mt-6 space-y-5">
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  {existingProfile?.photoUrl ? (
                    <img
                      src={existingProfile.photoUrl}
                      alt="Emergency profile"
                      className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-md"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-3xl font-bold text-blue-700 shadow-sm">
                      {fullName.trim().charAt(0).toUpperCase() || "＋"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900">Profile photo</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      Add a clear photo so someone can identify you during an emergency.
                      JPG, PNG or WebP recommended; maximum 5 MB.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={photoUploading || !user}
                        className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50"
                      >
                        {photoUploading ? "Working…" : existingProfile?.photoUrl ? "Change photo" : "Upload photo"}
                      </button>
                      {existingProfile?.photoUrl && (
                        <button
                          type="button"
                          onClick={() => void handleRemovePhoto()}
                          disabled={photoUploading}
                          className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Remove photo
                        </button>
                      )}
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(event) => void handlePhotoUpload(event)}
                        disabled={photoUploading || !user}
                        className="sr-only"
                        aria-label="Upload profile photo"
                      />
                    </div>
                    {!existingProfile && (
                      <p className="mt-2 text-xs text-slate-500">
                        Save your emergency profile before uploading a photo.
                      </p>
                    )}
                    {photoUploading && (
                      <p role="status" className="mt-2 text-sm font-medium text-blue-700">
                        Saving profile photo…
                      </p>
                    )}
                  </div>
                </div>
                <label className="mt-4 flex items-start gap-3 rounded-xl bg-white/80 p-3">
                  <input
                    type="checkbox"
                    checked={privacy.showPhoto}
                    onChange={(event) => updatePrivacy("showPhoto", event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">
                    <span className="block font-semibold">Show my photo on the public Emergency QR page</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Your photo is stored in your profile. It is shown publicly only when this option is enabled.
                    </span>
                  </span>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  Full name *
                </span>

                <input
                  id="fullName"
                  type="text"
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => {
                    clearMessages();
                    setFullName(event.target.value);
                  }}
                  className={inputClass}
                  placeholder="Enter your full name"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  Date of birth
                </span>

                <input
                  id="dateOfBirth"
                  type="date"
                  max={getToday()}
                  value={dateOfBirth}
                  onChange={(event) => {
                    clearMessages();
                    setDateOfBirth(event.target.value);
                  }}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  Home address
                </span>
                <textarea
                  id="homeAddress"
                  rows={3}
                  maxLength={500}
                  autoComplete="street-address"
                  value={homeAddress}
                  onChange={(event) => {
                    clearMessages();
                    setHomeAddress(event.target.value);
                  }}
                  className={inputClass}
                  placeholder="House/flat, street, locality, city, state and PIN code"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Private by default. You can choose whether to show it on your public Emergency QR.
                </p>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  Blood group
                </span>

                <select
                  value={bloodGroup}
                  onChange={(event) => {
                    clearMessages();

                    setBloodGroup(
                      event.target.value as BloodGroup
                    );
                  }}
                  className={inputClass}
                >
                  {BLOOD_GROUPS.map((group) => (
                    <option
                      key={group}
                      value={group}
                    >
                      {group}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Select Unknown if your blood group
                  has not been confirmed.
                </p>
              </label>
            </div>
          </section>

          
{/* Medical information */}

          <section className={sectionClass}>
            <h2 className="text-xl font-bold text-slate-900">
              Medical Information
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Enter important information that could
              help a responder understand your medical
              needs.
            </p>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  Allergies
                </span>

                <textarea
                  rows={3}
                  value={allergies}
                  onChange={(event) => {
                    clearMessages();
                    setAllergies(event.target.value);
                  }}
                  className={inputClass}
                  placeholder={
                    "Enter known allergies, one per line"
                  }
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  Medical conditions
                </span>

                <textarea
                  rows={3}
                  value={medicalConditions}
                  onChange={(event) => {
                    clearMessages();

                    setMedicalConditions(
                      event.target.value
                    );
                  }}
                  className={inputClass}
                  placeholder={
                    "Enter relevant medical conditions, one per line"
                  }
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  Current medications
                </span>

                <textarea
                  rows={3}
                  value={medications}
                  onChange={(event) => {
                    clearMessages();
                    setMedications(event.target.value);
                  }}
                  className={inputClass}
                  placeholder={
                    "Enter current medications, one per line"
                  }
                />
              </label>
            </div>
          </section>

          


          
            </div>
            <div className="min-w-0 space-y-5">
{/* Emergency contacts */}

          <section className={sectionClass}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Emergency Contacts
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Add trusted people who can be contacted
                  if an emergency occurs.
                </p>
              </div>

              <button
                id="addEmergencyContact"
                type="button"
                onClick={addContact}
                disabled={
                  contacts.length >=
                  MAX_EMERGENCY_CONTACTS
                }
                className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Add Contact
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Register 1–10 contacts. Each contact
              requires a name, phone number, and email
              address. Email addresses are used for
              notifications and are not intended for
              public display.
            </p>

            {contacts.length === 0 && (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <p className="font-medium text-slate-800">
                  No emergency contacts added
                </p>

                <p className="mt-2 text-sm text-slate-600">
                  Add at least one trusted contact.
                </p>

                <button
                  type="button"
                  onClick={addContact}
                  className="mt-4 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
                >
                  Add First Contact
                </button>
              </div>
            )}

            <div className="mt-5 space-y-5">
              {contacts.map((contact, index) => (
                <article
                  key={contact.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
                >
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <h3 className="font-bold text-slate-900">
                      Contact {index + 1}
                    </h3>

                    <button
                      type="button"
                      onClick={() =>
                        removeContact(contact.id)
                      }
                      className="text-sm font-semibold text-red-700 hover:underline"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">
                        Full name *
                      </span>

                      <input
                        id={`contact-name-${contact.id}`}
                        type="text"
                        required
                        maxLength={120}
                        value={contact.name}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "name",
                            event.target.value
                          )
                        }
                        className={inputClass}
                        placeholder="Contact name"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">
                        Relationship
                      </span>

                      <input
                        type="text"
                        maxLength={60}
                        value={contact.relationship}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "relationship",
                            event.target.value
                          )
                        }
                        className={inputClass}
                        placeholder="e.g. Spouse, Parent"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">
                        Phone number *
                      </span>

                      <input
                        id={`contact-phone-${contact.id}`}
                        type="tel"
                        required
                        maxLength={20}
                        autoComplete="off"
                        value={contact.phone}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "phone",
                            event.target.value
                          )
                        }
                        className={inputClass}
                        placeholder="+91..."
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">
                        Email address *
                      </span>

                      <input
                        id={`contact-email-${contact.id}`}
                        type="email"
                        required
                        maxLength={254}
                        autoComplete="off"
                        value={contact.email || ""}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "email",
                            event.target.value
                          )
                        }
                        className={inputClass}
                        placeholder="contact@example.com"
                      />
                    </label>
                  </div>

                  <label className="mt-5 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    <input
                      id="primaryEmergencyContact"
                      type="radio"
                      name="primaryEmergencyContact"
                      checked={contact.isPrimary}
                      onChange={() =>
                        setPrimaryContact(contact.id)
                      }
                      className="h-4 w-4"
                    />

                    <span className="text-sm font-medium text-slate-800">
                      Set as primary emergency contact
                    </span>
                  </label>
                </article>
              ))}
            </div>
          </section>

          
{/* Emergency instructions */}

          <section className="rounded-2xl border-2 border-blue-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  Emergency Instructions
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Tell a person helping you what they
                  should know or do during an emergency.
                </p>
              </div>

              <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
                Important
              </span>
            </div>

            <label
              htmlFor="emergencyInstructions"
              className="mt-6 block text-base font-semibold text-slate-900"
            >
              What should someone know to help you?
            </label>

            <textarea
              id="emergencyInstructions"
              name="emergencyInstructions"
              rows={10}
              maxLength={MAX_INSTRUCTION_LENGTH}
              value={emergencyInstructions}
              onChange={(event) => {
                clearMessages();

                setEmergencyInstructions(
                  event.target.value
                );
              }}
              placeholder={
                "Example:\n\n" +
                "If I am unconscious or unable to " +
                "communicate, please call emergency " +
                "medical services immediately.\n\n" +
                "Important precautions:\n" +
                "Known medical risks:\n" +
                "Other instructions for the responder:"
              }
              aria-describedby="emergency-instructions-help emergency-instructions-count"
              className={"mt-3 block min-h-[280px] w-full " +
                "resize-y rounded-xl border-2 " +
                "border-slate-300 bg-white p-5 " +
                "text-base leading-7 text-slate-900 " +
                "placeholder:text-slate-400 " +
                "focus:border-blue-600 focus:outline-none " +
                "focus:ring-4 focus:ring-blue-100 " +
                "sm:min-h-[320px] sm:p-6 sm:text-lg"
              }
            />

            <div
              id="emergency-instructions-help"
              className="mt-4 rounded-xl bg-blue-50 p-4 sm:p-5"
            >
              <h3 className="font-bold text-blue-950">
                Tips for writing clear instructions
              </h3>

              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-blue-950">
                <li>
                  Explain what someone should do if
                  you cannot communicate.
                </li>

                <li>
                  Mention important precautions and
                  relevant medical information.
                </li>

                <li>
                  Keep your instructions clear,
                  accurate, and easy to understand.
                </li>

                <li>
                  Do not include passwords, banking
                  information, or other unnecessary
                  sensitive details.
                </li>
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs leading-5 text-slate-500">
                Your instructions are saved with your
                emergency profile.
              </p>

              <p
                id="emergency-instructions-count"
                aria-live="polite"
                className={
                  "text-sm font-semibold " +
                  (emergencyInstructions.length >=
                  MAX_INSTRUCTION_LENGTH
                    ? "text-amber-700"
                    : "text-slate-600")
                }
              >
                {emergencyInstructions.length}/
                {MAX_INSTRUCTION_LENGTH} characters
              </p>
            </div>
          </section>

          
            </div>
          </div>
        <section className={sectionClass}>
          <h2 className="text-xl font-bold text-slate-900">
            Public QR Privacy
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Choose which information may be shown to someone who scans your active emergency QR.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PRIVACY_OPTIONS.map(({ key, label }) => (
              <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={privacy[key]}
                  onChange={(event) => updatePrivacy(key, event.target.checked)}
                  className="h-4 w-4 shrink-0"
                />
                <span className="text-sm leading-5 text-slate-800">{label}</span>
              </label>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Home address is private by default. Emergency contact email addresses are never shown publicly.
          </p>
        </section>

{/* Consent */}

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-7">
            <h2 className="text-xl font-bold text-blue-950">
              Consent and Acknowledgement
            </h2>

            <label className="mt-5 flex cursor-pointer items-start gap-3">
              <input
                id="consentGiven"
                type="checkbox"
                checked={consentGiven}
                onChange={(event) => {
                  clearMessages();

                  setConsentGiven(
                    event.target.checked
                  );
                }}
                className="mt-1 h-4 w-4"
              />

              <span className="text-sm leading-6 text-blue-950">
                I confirm that the information I
                provide is accurate to the best of my
                knowledge. I consent to its storage in
                my HealthPassport Emergency QR profile.
                I have permission from my emergency
                contacts to register their details and
                receive emergency notifications. I
                understand that the information selected
                through my privacy settings may be
                displayed on my public emergency QR.
              </span>
            </label>
          </section>

          
{/* Save actions */}

          <div className="space-y-4 pb-10">
            <button
              type="submit"
              disabled={saving || !user}
              className="w-full rounded-xl bg-blue-700 px-6 py-4 text-base font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving Emergency Profile..."
                : existingProfile
                  ? "Update Emergency Profile"
                  : "Save Emergency Profile"}
            </button>

            <Link
              to="/dashboard"
              className="block text-center text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancel and Return to Dashboard
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}