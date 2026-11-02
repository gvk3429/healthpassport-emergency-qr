// File: src/pages/EmergencyProfilePage.tsx

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

import { useAuth } from "../auth/AuthContext";
import { storage } from "../lib/firebase";

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

const MAX_CONTACTS = 10;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const MAX_INSTRUCTIONS_LENGTH = 2000;

const INPUT_CLASS =
  "mt-1.5 block w-full rounded-lg border border-slate-300 bg-white " +
  "px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 " +
  "focus:border-blue-600 focus:outline-none focus:ring-2 " +
  "focus:ring-blue-100 disabled:bg-slate-100";

const SECTION_CLASS =
  "rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

const PRIVACY_OPTIONS: {
  key: keyof EmergencyPrivacy;
  label: string;
  description: string;
}[] = [
  {
    key: "showPhoto",
    label: "Profile photo",
    description: "Allow your photo to appear on your public QR page.",
  },
  {
    key: "showHomeAddress",
    label: "Home address",
    description: "Allow anyone scanning your QR to view your address.",
  },
  {
    key: "showDateOfBirth",
    label: "Date of birth",
    description: "Display your date of birth.",
  },
  {
    key: "showBloodGroup",
    label: "Blood group",
    description: "Display your recorded blood group.",
  },
  {
    key: "showAllergies",
    label: "Allergies",
    description: "Display your recorded allergies.",
  },
  {
    key: "showMedicalConditions",
    label: "Medical conditions",
    description: "Display your recorded medical conditions.",
  },
  {
    key: "showMedications",
    label: "Medications",
    description: "Display your current medications.",
  },
  {
    key: "showEmergencyContacts",
    label: "Emergency contact phone numbers",
    description: "Allow responders to view emergency contact numbers.",
  },
  {
    key: "showEmergencyInstructions",
    label: "Emergency instructions",
    description: "Display your emergency instructions.",
  },
];

function textToList(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(value: string[] | undefined): string {
  return (value || []).join("\n");
}

function createContact(isPrimary: boolean): EmergencyContact {
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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function describeSaveError(error: unknown): {
  message: string;
  fieldId?: string;
} {
  const message = getErrorMessage(error);

  if (message.includes("Missing or insufficient permissions")) {
    return {
      fieldId: "homeAddress",
      message:
        "Firebase denied permission to save your emergency profile. " +
        "Check that the deployed Firestore rules allow the homeAddress " +
        "field and that the profile ownership conditions are satisfied.",
    };
  }

  return { message };
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
  const [medicalConditions, setMedicalConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [emergencyInstructions, setEmergencyInstructions] =
    useState("");

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  const [privacy, setPrivacy] = useState<EmergencyPrivacy>({
    ...DEFAULT_EMERGENCY_PRIVACY,
  });

  const [consentGiven, setConsentGiven] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clearMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  /*
   * Load the profile when an authenticated user is available.
   * No synchronous setState call is made for a missing user.
   */
  useEffect(() => {
    let cancelled = false;

    if (!user) {
      return () => {
        cancelled = true;
      };
    }

    async function loadProfile(): Promise<void> {
      try {
        const profile = await getEmergencyProfile(user!.uid);

        if (cancelled) return;

        if (profile) {
          setExistingProfile(profile);
          setFullName(profile.fullName || "");
          setHomeAddress(profile.homeAddress || "");
          setDateOfBirth(profile.dateOfBirth || "");
          setBloodGroup(profile.bloodGroup || "Unknown");

          setAllergies(listToText(profile.allergies));
          setMedicalConditions(listToText(profile.medicalConditions));
          setMedications(listToText(profile.medications));

          setEmergencyInstructions(
            profile.emergencyInstructions || "",
          );

          setContacts(
            (profile.emergencyContacts || []).map((contact) => ({
              ...contact,
              email: contact.email || "",
            })),
          );

          setPrivacy({
            ...DEFAULT_EMERGENCY_PRIVACY,
            ...profile.privacy,
          });

          setConsentGiven(Boolean(profile.consentGiven));
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
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError));
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
    if (!success || !successRef.current) return;

    successRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    successRef.current.focus({ preventScroll: true });
  }, [success]);

  function reportError(message: string, fieldId?: string): void {
    setError(message);
    setSuccess("");

    window.requestAnimationFrame(() => {
      const target = fieldId
        ? document.getElementById(fieldId)
        : errorRef.current;

      if (!target) return;

      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true });
      }

      if (fieldId && target instanceof HTMLElement) {
        target.classList.add(
          "!border-red-500",
          "!ring-2",
          "!ring-red-200",
        );

        window.setTimeout(() => {
          target.classList.remove(
            "!border-red-500",
            "!ring-2",
            "!ring-red-200",
          );
        }, 7000);
      }
    });
  }

  function addContact(): void {
    clearMessages();

    if (contacts.length >= MAX_CONTACTS) {
      setError(`You can register up to ${MAX_CONTACTS} emergency contacts.`);
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
    value: string,
  ): void {
    clearMessages();

    setContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? { ...contact, [field]: value }
          : contact,
      ),
    );
  }

  function removeContact(id: string): void {
    clearMessages();

    setContacts((current) => {
      const remaining = current.filter((contact) => contact.id !== id);

      if (
        remaining.length > 0 &&
        !remaining.some((contact) => contact.isPrimary)
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
      })),
    );
  }

  function updatePrivacy(
    field: keyof EmergencyPrivacy,
    value: boolean,
  ): void {
    clearMessages();

    if (field === "showHomeAddress" && value) {
      const confirmed = window.confirm(
        "Your home address is sensitive information. " +
          "If enabled, it may be visible to anyone who scans your active " +
          "Emergency QR. Do you want to show it publicly?",
      );

      if (!confirmed) return;
    }

    setPrivacy((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handlePhotoUpload(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file || !user || photoUploading) return;

    if (!existingProfile) {
      setError("Save your emergency profile before uploading a photo.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG or WebP image.");
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setError("The profile photo must be 5 MB or smaller.");
      return;
    }

    clearMessages();
    setPhotoUploading(true);

    let uploadedPath = "";

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      uploadedPath =
        `emergency-profile-photos/${user.uid}/` +
        `${Date.now()}-${safeName}`;

      const photoRef = storageRef(storage, uploadedPath);

      await uploadBytes(photoRef, file, {
        contentType: file.type,
      });

      const photoUrl = await getDownloadURL(photoRef);

      const updatedProfile: EmergencyProfile = {
        ...existingProfile,
        photoUrl,
        updatedAt: new Date().toISOString(),
      };

      await saveEmergencyProfile(updatedProfile);

      setExistingProfile(updatedProfile);
      setSuccess("Profile photo uploaded and saved successfully.");
    } catch (uploadError) {
      if (uploadedPath) {
        try {
          await deleteObject(storageRef(storage, uploadedPath));
        } catch {
          // Keep the original save/upload error visible.
        }
      }

      setError(getErrorMessage(uploadError));
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
        const oldPhotoRef = storageRef(storage, oldPhotoUrl);
        await deleteObject(oldPhotoRef);
      } catch {
        // Profile removal has succeeded; an orphaned object can be cleaned up separately.
      }

      setSuccess("Profile photo removed.");
    } catch (removeError) {
      setError(getErrorMessage(removeError));
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (!user || saving) return;

    clearMessages();

    if (!fullName.trim()) {
      reportError("Please enter your full name.", "fullName");
      return;
    }

    if (dateOfBirth && dateOfBirth > getToday()) {
      reportError(
        "Date of birth cannot be in the future.",
        "dateOfBirth",
      );
      return;
    }

    if (emergencyInstructions.length > MAX_INSTRUCTIONS_LENGTH) {
      reportError(
        `Emergency instructions must be ${MAX_INSTRUCTIONS_LENGTH} characters or fewer.`,
        "emergencyInstructions",
      );
      return;
    }

    if (contacts.length === 0 || contacts.length > MAX_CONTACTS) {
      reportError(
        `Register between 1 and ${MAX_CONTACTS} emergency contacts.`,
        "addEmergencyContact",
      );
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (let index = 0; index < contacts.length; index += 1) {
      const contact = contacts[index];

      if (!contact.name.trim()) {
        reportError(
          "Enter the name for every emergency contact.",
          `contact-name-${contact.id}`,
        );
        return;
      }

      if (!contact.phone.trim()) {
        reportError(
          "Enter the phone number for every emergency contact.",
          `contact-phone-${contact.id}`,
        );
        return;
      }

      const email = (contact.email || "").trim();

      if (
        !email ||
        email.length > 254 ||
        !emailPattern.test(email)
      ) {
        reportError(
          `Enter a valid email address for ${contact.name || `Contact ${index + 1}`}.`,
          `contact-email-${contact.id}`,
        );
        return;
      }
    }

    if (contacts.filter((contact) => contact.isPrimary).length !== 1) {
      reportError(
        "Select exactly one primary emergency contact.",
        "primaryEmergencyContact",
      );
      return;
    }

    if (!consentGiven) {
      reportError(
        "Please acknowledge the consent statement.",
        "consentGiven",
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
        photoUrl: existingProfile?.photoUrl || "",
        dateOfBirth,
        bloodGroup,
        allergies: textToList(allergies),
        medicalConditions: textToList(medicalConditions),
        medications: textToList(medications),

        emergencyContacts: contacts.map((contact) => ({
          ...contact,
          name: contact.name.trim(),
          relationship: contact.relationship.trim(),
          phone: contact.phone.trim(),
          email: (contact.email || "").trim().toLowerCase(),
        })),

        emergencyInstructions: emergencyInstructions.trim(),
        privacy,
        consentGiven: true,

        consentUpdatedAt:
          existingProfile?.consentUpdatedAt &&
          existingProfile.consentGiven
            ? existingProfile.consentUpdatedAt
            : now,

        createdAt: existingProfile?.createdAt || now,
        updatedAt: now,
      };

      await saveEmergencyProfile(profile);

      setExistingProfile(profile);
      setSuccess("Your emergency profile has been saved successfully.");
    } catch (saveError) {
      const details = describeSaveError(saveError);
      reportError(details.message, details.fieldId);
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Sign in required
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Please sign in to manage your emergency profile.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p role="status" className="text-sm text-slate-600">
          Loading your emergency profile…
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link
            to="/dashboard"
            className="text-sm font-semibold text-blue-700 hover:underline"
          >
            ← Dashboard
          </Link>

          <Link
            to="/my-qr"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            My Emergency QR →
          </Link>
        </div>

        <header className="mb-5">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
            SafehealthQR
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Emergency Profile
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Keep your identification, medical information and emergency
            contacts current. Choose which details can appear on your
            public Emergency QR page.
          </p>
        </header>

        {success && (
          <div
            ref={successRef}
            tabIndex={-1}
            role="status"
            className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 outline-none"
          >
            <p className="text-sm font-semibold text-green-900">
              {success}
            </p>
            <Link
              to="/my-qr"
              className="mt-3 inline-flex rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300"
            >
              Continue to My QR →
            </Link>
          </div>
        )}

        {error && (
          <div
            ref={errorRef}
            tabIndex={-1}
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800 outline-none focus:ring-2 focus:ring-red-300"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <section className={SECTION_CLASS}>
                <h2 className="text-lg font-bold text-slate-900">
                  Personal information
                </h2>

                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                    <div className="flex items-center gap-3">
                      {existingProfile?.photoUrl ? (
                        <img
                          src={existingProfile.photoUrl}
                          alt="Emergency profile"
                          className="h-16 w-16 shrink-0 rounded-xl border border-white object-cover shadow-sm"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white text-2xl font-bold text-blue-700">
                          {fullName.trim().charAt(0).toUpperCase() || "＋"}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900">
                          Profile photo
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          JPG, PNG or WebP · Maximum 5 MB
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => photoInputRef.current?.click()}
                            disabled={photoUploading || !existingProfile}
                            className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {photoUploading
                              ? "Saving photo…"
                              : existingProfile?.photoUrl
                                ? "Change photo"
                                : "Upload photo"}
                          </button>

                          {existingProfile?.photoUrl && (
                            <button
                              type="button"
                              onClick={() => void handleRemovePhoto()}
                              disabled={photoUploading}
                              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => void handlePhotoUpload(event)}
                      disabled={photoUploading || !existingProfile}
                      className="sr-only"
                      aria-label="Upload profile photo"
                    />

                    {!existingProfile && (
                      <p className="mt-2 text-xs text-slate-500">
                        Save your profile before uploading a photo.
                      </p>
                    )}

                    <label className="mt-3 flex items-start gap-2 border-t border-blue-100 pt-3">
                      <input
                        type="checkbox"
                        checked={privacy.showPhoto}
                        onChange={(event) =>
                          updatePrivacy("showPhoto", event.target.checked)
                        }
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-xs leading-5 text-slate-700">
                        Show my photo on the public Emergency QR page.
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
                      className={INPUT_CLASS}
                      placeholder="Enter your full name"
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                        className={INPUT_CLASS}
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-semibold text-slate-800">
                        Blood group
                      </span>
                      <select
                        value={bloodGroup}
                        onChange={(event) => {
                          clearMessages();
                          setBloodGroup(event.target.value as BloodGroup);
                        }}
                        className={INPUT_CLASS}
                      >
                        {BLOOD_GROUPS.map((group) => (
                          <option key={group} value={group}>
                            {group}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-800">
                      Home address
                    </span>
                    <textarea
                      id="homeAddress"
                      rows={2}
                      maxLength={500}
                      autoComplete="street-address"
                      value={homeAddress}
                      onChange={(event) => {
                        clearMessages();
                        setHomeAddress(event.target.value);
                      }}
                      className={INPUT_CLASS}
                      placeholder="House, street, locality, city, PIN code"
                    />
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      Private by default. Public display can be controlled
                      below.
                    </span>
                  </label>
                </div>
              </section>

              <section className={SECTION_CLASS}>
                <h2 className="text-lg font-bold text-slate-900">
                  Medical information
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Enter one item per line. Leave a field blank if it does
                  not apply.
                </p>

                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-800">
                      Allergies
                    </span>
                    <textarea
                      rows={2}
                      value={allergies}
                      onChange={(event) => {
                        clearMessages();
                        setAllergies(event.target.value);
                      }}
                      className={INPUT_CLASS}
                      placeholder="e.g. peanut allergy"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-800">
                      Medical conditions
                    </span>
                    <textarea
                      rows={2}
                      value={medicalConditions}
                      onChange={(event) => {
                        clearMessages();
                        setMedicalConditions(event.target.value);
                      }}
                      className={INPUT_CLASS}
                      placeholder="e.g. asthma, diabetes"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-800">
                      Current medications
                    </span>
                    <textarea
                      rows={2}
                      value={medications}
                      onChange={(event) => {
                        clearMessages();
                        setMedications(event.target.value);
                      }}
                      className={INPUT_CLASS}
                      placeholder="Medication name and dosage"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-800">
                      Emergency instructions
                    </span>
                    <textarea
                      id="emergencyInstructions"
                      rows={3}
                      maxLength={MAX_INSTRUCTIONS_LENGTH}
                      value={emergencyInstructions}
                      onChange={(event) => {
                        clearMessages();
                        setEmergencyInstructions(event.target.value);
                      }}
                      className={INPUT_CLASS}
                      placeholder="Important instructions for a responder"
                    />
                    <span className="mt-1 block text-right text-xs text-slate-500">
                      {emergencyInstructions.length}/{MAX_INSTRUCTIONS_LENGTH}
                    </span>
                  </label>
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <section className={SECTION_CLASS}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Emergency contacts
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Add at least one contact. Each contact needs a phone
                      number and email address.
                    </p>
                  </div>

                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    {contacts.length}/{MAX_CONTACTS}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {contacts.map((contact, index) => (
                    <fieldset
                      key={contact.id}
                      className="rounded-xl border border-slate-200 p-3"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <legend className="text-sm font-bold text-slate-800">
                          Contact {index + 1}
                        </legend>

                        <button
                          type="button"
                          onClick={() => removeContact(contact.id)}
                          className="rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="space-y-3">
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-700">
                            Full name *
                          </span>
                          <input
                            id={`contact-name-${contact.id}`}
                            type="text"
                            maxLength={120}
                            value={contact.name}
                            onChange={(event) =>
                              updateContact(
                                contact.id,
                                "name",
                                event.target.value,
                              )
                            }
                            className={INPUT_CLASS}
                            placeholder="Contact name"
                          />
                        </label>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="text-xs font-semibold text-slate-700">
                              Relationship
                            </span>
                            <input
                              type="text"
                              maxLength={80}
                              value={contact.relationship}
                              onChange={(event) =>
                                updateContact(
                                  contact.id,
                                  "relationship",
                                  event.target.value,
                                )
                              }
                              className={INPUT_CLASS}
                              placeholder="e.g. Spouse"
                            />
                          </label>

                          <label className="block">
                            <span className="text-xs font-semibold text-slate-700">
                              Phone number *
                            </span>
                            <input
                              id={`contact-phone-${contact.id}`}
                              type="tel"
                              maxLength={30}
                              autoComplete="tel"
                              value={contact.phone}
                              onChange={(event) =>
                                updateContact(
                                  contact.id,
                                  "phone",
                                  event.target.value,
                                )
                              }
                              className={INPUT_CLASS}
                              placeholder="Phone number"
                            />
                          </label>
                        </div>

                        <label className="block">
                          <span className="text-xs font-semibold text-slate-700">
                            Email address *
                          </span>
                          <input
                            id={`contact-email-${contact.id}`}
                            type="email"
                            maxLength={254}
                            autoComplete="email"
                            value={contact.email || ""}
                            onChange={(event) =>
                              updateContact(
                                contact.id,
                                "email",
                                event.target.value,
                              )
                            }
                            className={INPUT_CLASS}
                            placeholder="contact@example.com"
                          />
                        </label>

                        <label className="flex items-start gap-2 border-t border-slate-100 pt-3">
                          <input
                            id={
                              contact.isPrimary
                                ? "primaryEmergencyContact"
                                : undefined
                            }
                            type="radio"
                            name="primaryEmergencyContact"
                            checked={contact.isPrimary}
                            onChange={() => setPrimaryContact(contact.id)}
                            className="mt-0.5 h-4 w-4"
                          />
                          <span className="text-xs font-medium text-slate-700">
                            Set as primary emergency contact
                          </span>
                        </label>
                      </div>
                    </fieldset>
                  ))}

                  {contacts.length === 0 && (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                      Add at least one emergency contact before saving.
                    </p>
                  )}

                  <button
                    id="addEmergencyContact"
                    type="button"
                    onClick={addContact}
                    disabled={contacts.length >= MAX_CONTACTS}
                    className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + Add emergency contact
                  </button>
                </div>
              </section>

              <section className={SECTION_CLASS}>
                <h2 className="text-lg font-bold text-slate-900">
                  Public QR privacy
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Your Emergency QR may be scanned by anyone. Enable only
                  the details you are comfortable displaying publicly.
                </p>

                <div className="mt-3 divide-y divide-slate-100">
                  {PRIVACY_OPTIONS.map((option) => (
                    <label
                      key={option.key}
                      className="flex items-start justify-between gap-3 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-800">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          {option.description}
                        </span>
                      </span>

                      <input
                        type="checkbox"
                        checked={Boolean(privacy[option.key])}
                        onChange={(event) =>
                          updatePrivacy(option.key, event.target.checked)
                        }
                        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section className={SECTION_CLASS}>
                <h2 className="text-lg font-bold text-slate-900">
                  Consent and saving
                </h2>

                <label
                  id="consentGiven"
                  className="mt-3 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                >
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(event) => {
                      clearMessages();
                      setConsentGiven(event.target.checked);
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                  />

                  <span className="text-sm leading-6 text-slate-700">
                    I confirm that the information provided is accurate
                    to the best of my knowledge. I understand that the
                    details enabled above may be visible to people who
                    scan my active Emergency QR.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={saving || photoUploading}
                  className="mt-4 w-full rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving profile…" : "Save Emergency Profile"}
                </button>

                <p className="mt-2 text-center text-xs leading-5 text-slate-500">
                  Save your profile before using it with your Emergency QR.
                </p>
              </section>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}