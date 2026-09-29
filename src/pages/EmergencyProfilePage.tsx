
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { Link } from "react-router-dom";
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
  "A+", "A-",
  "B+", "B-",
  "AB+", "AB-",
  "O+", "O-",
];

const PRIVACY_OPTIONS: {
  key: keyof EmergencyPrivacy;
  label: string;
}[] = [
  { key: "showPhoto", label: "Profile photo" },
  { key: "showDateOfBirth", label: "Date of birth" },
  { key: "showBloodGroup", label: "Blood group" },
  { key: "showAllergies", label: "Allergies" },
  {
    key: "showMedicalConditions",
    label: "Medical conditions",
  },
  { key: "showMedications", label: "Medications" },
  {
    key: "showEmergencyContacts",
    label: "Emergency contact phone numbers",
  },
  {
    key: "showEmergencyInstructions",
    label: "Emergency instructions",
  },
];

function textToList(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
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

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 " +
  "bg-white p-3 text-slate-900 " +
  "focus:border-blue-600 focus:outline-none";

export default function EmergencyProfilePage() {
  const { user } = useAuth();

  const successRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [existingProfile, setExistingProfile] =
    useState<EmergencyProfile | null>(null);

  const [fullName, setFullName] = useState(
    user?.displayName || ""
  );

  const [dateOfBirth, setDateOfBirth] =
    useState("");

  const [bloodGroup, setBloodGroup] =
    useState<BloodGroup>("Unknown");

  const [allergies, setAllergies] =
    useState("");

  const [medicalConditions, setMedicalConditions] =
    useState("");

  const [medications, setMedications] =
    useState("");

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
    if (!user) return;

    let cancelled = false;

    async function loadProfile() {
      try {
        const profile =
          await getEmergencyProfile(user!.uid);

        if (cancelled) return;

        if (profile) {
          setExistingProfile(profile);
          setFullName(profile.fullName);
          setDateOfBirth(profile.dateOfBirth);
          setBloodGroup(profile.bloodGroup);

          setAllergies(
            profile.allergies.join("\n")
          );

          setMedicalConditions(
            profile.medicalConditions.join("\n")
          );

          setMedications(
            profile.medications.join("\n")
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

          setPrivacy(profile.privacy);
          setConsentGiven(profile.consentGiven);
        } else {
          setExistingProfile(null);
          setFullName(user!.displayName || "");
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
    if (success && successRef.current) {
      successRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      successRef.current.focus({
        preventScroll: true,
      });
    }
  }, [success]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function addContact() {
    clearMessages();

    if (contacts.length >= 10) {
      setError(
        "You can register up to 10 emergency contacts."
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
  ) {
    clearMessages();

    setContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? { ...contact, [field]: value }
          : contact
      )
    );
  }

  function removeContact(id: string) {
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
        return remaining.map(
          (contact, index) => ({
            ...contact,
            isPrimary: index === 0,
          })
        );
      }

      return remaining;
    });
  }

  function setPrimaryContact(id: string) {
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
  ) {
    clearMessages();

    setPrivacy((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!user || saving) return;

    clearMessages();

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (
      dateOfBirth &&
      dateOfBirth >
        new Date().toISOString().slice(0, 10)
    ) {
      setError(
        "Date of birth cannot be in the future."
      );
      return;
    }

    if (
      contacts.length < 1 ||
      contacts.length > 10
    ) {
      setError(
        "Register between 1 and 10 emergency contacts."
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
        setError(
          "Enter the name and phone number " +
          "for every emergency contact."
        );
        return;
      }

      const email = (contact.email || "").trim();

      if (
        !email ||
        email.length > 254 ||
        !emailPattern.test(email)
      ) {
        setError(
          `Enter a valid email address for ${contact.name}.`
        );
        return;
      }
    }

    if (
      contacts.filter(
        (contact) => contact.isPrimary
      ).length !== 1
    ) {
      setError(
        "Select exactly one primary emergency contact."
      );
      return;
    }

    if (!consentGiven) {
      setError(
        "Please acknowledge the consent statement."
      );
      return;
    }

    setSaving(true);

    try {
      const now = new Date().toISOString();

      const profile: EmergencyProfile = {
        ownerId: user.uid,
        fullName: fullName.trim(),

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
            email:
              (contact.email || "")
                .trim()
                .toLowerCase(),
          })
        ),

        emergencyInstructions:
          emergencyInstructions.trim(),

        privacy,
        consentGiven: true,

        consentUpdatedAt:
          existingProfile?.consentGiven &&
          existingProfile.consentUpdatedAt
            ? existingProfile.consentUpdatedAt
            : now,

        createdAt:
          existingProfile?.createdAt || now,

        updatedAt: now,
      };

      await saveEmergencyProfile(profile);

      setExistingProfile(profile);

      setSuccess(
        "Your emergency profile and contact " +
        "email addresses have been saved."
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <p role="status" className="text-slate-600">
          Loading your emergency profile...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/dashboard"
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          ← Back to Dashboard
        </Link>

        <header className="mb-8 mt-6">
          <h1 className="text-3xl font-bold text-slate-900">
            My Emergency Profile
          </h1>

          <p className="mt-2 text-slate-600">
            Manage your medical information and
            emergency notification contacts.
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
              Emergency profile saved
            </h2>

            <p className="mt-2 text-sm text-green-800">
              {success}
            </p>

            <Link
              to="/my-qr"
              className="mt-4 inline-flex rounded-lg bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800"
            >
              Continue to My QR →
            </Link>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Personal information
            </h2>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">
                  Full name *
                </span>

                <input
                  type="text"
                  required
                  maxLength={120}
                  value={fullName}
                  onChange={(event) => {
                    clearMessages();
                    setFullName(event.target.value);
                  }}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">
                  Date of birth
                </span>

                <input
                  type="date"
                  value={dateOfBirth}
                  max={new Date()
                    .toISOString()
                    .slice(0, 10)}
                  onChange={(event) => {
                    clearMessages();
                    setDateOfBirth(event.target.value);
                  }}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">
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

                <p className="mt-2 text-xs text-slate-500">
                  Choose Unknown unless your blood
                  group has been medically confirmed.
                </p>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Medical information
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Enter one item per line.
            </p>

            <div className="mt-5 space-y-5">
              {[
                {
                  label: "Allergies",
                  value: allergies,
                  setter: setAllergies,
                },
                {
                  label: "Medical conditions",
                  value: medicalConditions,
                  setter: setMedicalConditions,
                },
                {
                  label: "Current medications",
                  value: medications,
                  setter: setMedications,
                },
              ].map((field) => (
                <label
                  key={field.label}
                  className="block"
                >
                  <span className="text-sm font-medium">
                    {field.label}
                  </span>

                  <textarea
                    rows={3}
                    value={field.value}
                    onChange={(event) => {
                      clearMessages();
                      field.setter(event.target.value);
                    }}
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">
                Emergency contacts
              </h2>

              <button
                type="button"
                onClick={addContact}
                disabled={contacts.length >= 10}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                + Add contact
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Register people who have agreed to
              receive emergency notifications.
              Their email addresses remain private.
              Up to 10 contacts are supported.
            </p>

            {contacts.length === 0 && (
              <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                Add at least one emergency contact.
              </p>
            )}

            <div className="mt-5 space-y-5">
              {contacts.map((contact, index) => (
                <div
                  key={contact.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <h3 className="mb-4 font-semibold text-slate-900">
                    Contact {index + 1}
                  </h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium">
                        Full name *
                      </span>

                      <input
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
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium">
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
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium">
                        Phone number *
                      </span>

                      <input
                        type="tel"
                        required
                        maxLength={20}
                        value={contact.phone}
                        onChange={(event) =>
                          updateContact(
                            contact.id,
                            "phone",
                            event.target.value
                          )
                        }
                        placeholder="+91..."
                        className={inputClass}
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium">
                        Email address *
                      </span>

                      <input
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
                        placeholder="contact@example.com"
                        className={inputClass}
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-800">
                      <input
                        type="radio"
                        name="primaryContact"
                        checked={contact.isPrimary}
                        onChange={() =>
                          setPrimaryContact(contact.id)
                        }
                      />

                      Primary contact
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        removeContact(contact.id)
                      }
                      className="text-sm font-medium text-red-700 hover:underline"
                    >
                      Remove contact
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Emergency instructions
            </h2>

            <textarea
              rows={4}
              maxLength={2000}
              value={emergencyInstructions}
              onChange={(event) => {
                clearMessages();
                setEmergencyInstructions(
                  event.target.value
                );
              }}
              placeholder="Important instructions for emergency responders"
              className={inputClass}
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">
              Public QR privacy
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Choose which details may appear when
              someone scans your active QR.
              Emergency-contact email addresses
              are never displayed publicly.
            </p>

            <div className="mt-5 space-y-4">
              {PRIVACY_OPTIONS.map(
                ({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-3"
                  >
                    <input
                      type="checkbox"
                      checked={privacy[key]}
                      onChange={(event) =>
                        updatePrivacy(
                          key,
                          event.target.checked
                        )
                      }
                    />

                    <span className="text-sm text-slate-800">
                      {label}
                    </span>
                  </label>
                )
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
            <h2 className="text-lg font-bold text-blue-950">
              Consent and acknowledgement
            </h2>

            <label className="mt-4 flex items-start gap-3">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(event) => {
                  clearMessages();
                  setConsentGiven(
                    event.target.checked
                  );
                }}
                className="mt-1"
              />

              <span className="text-sm leading-6 text-blue-950">
                I confirm that this information is
                accurate to the best of my knowledge.
                I consent to storing it in my
                HealthPassport Emergency QR profile.
                I have obtained permission from my
                emergency contacts to register their
                details and receive emergency emails.
                I understand that my selected public
                privacy settings determine which
                details may appear on my active QR.
              </span>
            </label>
          </section>

          <div className="flex flex-col gap-4 pb-8">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-blue-700 px-6 py-4 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving your profile..."
                : existingProfile
                  ? "Update Emergency Profile"
                  : "Create Emergency Profile"}
            </button>

            <Link
              to="/dashboard"
              className="text-center text-sm font-medium text-slate-600 hover:underline"
            >
              Back to Dashboard
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}