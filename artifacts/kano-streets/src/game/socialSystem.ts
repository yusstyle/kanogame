import type { RelationshipStage, SocialContact } from "./types";

export interface DialogueChoice {
  id: string;
  label: string;
  cost?: number;
  minAffection?: number;
  requiresApartment?: boolean;
}

export interface DialogueOutcome {
  speaker: string;
  response: string;
  affectionDelta: number;
  cashDelta?: number;
  newStage?: RelationshipStage;
  statusMessage: string;
}

export class SocialSystem {
  public contacts: Map<string, SocialContact> = new Map();

  constructor() {
    this.initContacts();
  }

  private initContacts() {
    const list: SocialContact[] = [
      {
        id: "amina",
        name: "Amina Lawal",
        profession: "Architectural Designer",
        district: "AIRPORT ROAD · BOMPAI",
        stage: "stranger",
        affection: 10,
        description: "Creative architect designing modern residential villas and commercial spaces in Kano. Loves Nigerian contemporary art and iced Chapman.",
      },
      {
        id: "zainab",
        name: "Zainab Bello",
        profession: "Esports Champion & Student",
        district: "AIRPORT ROAD · CYBER HUB",
        stage: "stranger",
        affection: 10,
        description: "Reigning champion of the Kano Street Drift tournament. Fast reflexes, witty sense of humor, and loves gaming tournaments.",
      },
      {
        id: "fatima",
        name: "Fatima Al-Hassan",
        profession: "Agro-Tech Entrepreneur",
        district: "RESIDENTIAL QUARTER · VILLA",
        stage: "stranger",
        affection: 10,
        description: "Managing a modern smart-farming enterprise in Kano. Thoughtful, ambitious, and passionate about northern industrial innovation.",
      },
      {
        id: "chinedu",
        name: "Chinedu Okeke",
        profession: "Merchant & Choir Member",
        district: "SABON GARI · COMPLEX",
        stage: "stranger",
        affection: 15,
        description: "Owns an electronics store in Sabon Gari and sings tenor in the St. Stephen's Anglican choir. Warm and welcoming.",
      },
      {
        id: "danladi",
        name: "Sergeant Danladi",
        profession: "NPF Highway Patrol Officer",
        district: "AIRPORT ROAD · POLICE POST",
        stage: "acquaintance",
        affection: 25,
        description: "Vigilant police patrol sergeant dedicated to keeping Kano streets safe and curbing reckless speeding.",
      },
    ];

    list.forEach((c) => this.contacts.set(c.id, c));
  }

  public getContact(id: string): SocialContact | undefined {
    return this.contacts.get(id);
  }

  public getChoices(id: string, playerCash: number, hasApartment: boolean): DialogueChoice[] {
    const c = this.contacts.get(id);
    if (!c) return [];

    const choices: DialogueChoice[] = [
      { id: "greet", label: `Greet ${c.name.split(" ")[0]} (Polite greeting)` },
      { id: "chat_city", label: "Talk about Kano city life & neighborhood" },
    ];

    if (c.stage === "stranger" || c.stage === "acquaintance") {
      choices.push({ id: "exchange_contacts", label: "Exchange phone numbers & stay in touch" });
    }

    // Hangout choices
    if (c.affection >= 25) {
      choices.push({
        id: "invite_food",
        label: "Invite for Suya dinner at Arewa Lounge (₦5,000 for two)",
        cost: 5000,
      });
      choices.push({
        id: "invite_game",
        label: "Invite to play co-op games at Cyber Hub (₦2,000)",
        cost: 2000,
      });
    }

    // Romantic date (consent-based adult relationship)
    if (c.affection >= 45 && c.stage !== "dating" && c.stage !== "partner") {
      choices.push({
        id: "ask_date",
        label: "Ask on a romantic evening date",
        minAffection: 45,
      });
    }

    // Partner / Apartment visit
    if ((c.stage === "dating" || c.stage === "partner") && c.affection >= 65) {
      choices.push({
        id: "invite_apartment",
        label: "Invite over to Unit 2B Apartment for quality time together",
        requiresApartment: true,
      });
    }

    return choices;
  }

  public interact(
    id: string,
    choiceId: string,
    playerCash: number,
    hasApartment: boolean,
  ): DialogueOutcome | null {
    const c = this.contacts.get(id);
    if (!c) return null;

    const firstName = c.name.split(" ")[0];

    switch (choiceId) {
      case "greet": {
        c.affection = Math.min(100, c.affection + 5);
        if (c.stage === "stranger" && c.affection >= 20) {
          c.stage = "acquaintance";
        }
        return {
          speaker: c.name,
          response: `${firstName}: 'Sannu! Hello! It is wonderful seeing you around Kano today.'`,
          affectionDelta: 5,
          statusMessage: `Friendly conversation with ${firstName}. Relationship: ${c.stage.toUpperCase()}`,
        };
      }

      case "chat_city": {
        c.affection = Math.min(100, c.affection + 8);
        const cityFacts = [
          `${firstName}: 'Kano is growing so fast. The new developments along Airport Road and Bompai look incredible!'`,
          `${firstName}: 'I love how vibrant our streets are — from Sabon Gari market to the quiet residential avenues.'`,
          `${firstName}: 'Have you tried the fresh Suya near the junction? The aroma fills the entire street every evening!'`,
        ];
        const quote = cityFacts[Math.floor(Math.random() * cityFacts.length)];
        return {
          speaker: c.name,
          response: quote,
          affectionDelta: 8,
          statusMessage: `Shared stories about Kano with ${firstName}. Affection +8`,
        };
      }

      case "exchange_contacts": {
        c.affection = Math.min(100, c.affection + 12);
        c.stage = "acquaintance";
        return {
          speaker: c.name,
          response: `${firstName}: 'I would love that! Here is my phone number. Text me whenever you are in the neighborhood!'`,
          affectionDelta: 12,
          newStage: "acquaintance",
          statusMessage: `Exchanged contacts with ${firstName}. Now ACQUAINTANCES!`,
        };
      }

      case "invite_food": {
        if (playerCash < 5000) {
          return {
            speaker: c.name,
            response: `${firstName}: 'That sounds delicious! Let us go once you have some cash on hand.'`,
            affectionDelta: 0,
            statusMessage: "Insufficient cash: You need ₦5,000 for dinner for two.",
          };
        }
        c.affection = Math.min(100, c.affection + 18);
        if (c.stage === "acquaintance" && c.affection >= 40) {
          c.stage = "friend";
        }
        return {
          speaker: c.name,
          response: `${firstName}: 'The Suya and Jollof were exquisite! Thank you so much for the wonderful dinner and laugh.'`,
          affectionDelta: 18,
          cashDelta: -5000,
          newStage: c.stage,
          statusMessage: `Enjoyed romantic dinner at Arewa Lounge with ${firstName}. Now FRIENDS!`,
        };
      }

      case "invite_game": {
        if (playerCash < 2000) {
          return {
            speaker: c.name,
            response: `${firstName}: 'I am always down for a match! Come back when you have entry coins.'`,
            affectionDelta: 0,
            statusMessage: "Insufficient cash: You need ₦2,000 for gaming session.",
          };
        }
        c.affection = Math.min(100, c.affection + 15);
        if (c.stage === "acquaintance" && c.affection >= 40) {
          c.stage = "friend";
        }
        return {
          speaker: c.name,
          response: `${firstName}: 'What a game! You actually have serious skills behind the controller!'`,
          affectionDelta: 15,
          cashDelta: -2000,
          newStage: c.stage,
          statusMessage: `Played thrilling multiplayer session at Cyber Hub with ${firstName}.`,
        };
      }

      case "ask_date": {
        if (c.affection < 40) {
          return {
            speaker: c.name,
            response: `${firstName}: 'You are very kind, but let us get to know each other a bit better first.'`,
            affectionDelta: 2,
            statusMessage: `${firstName} wants to build friendship first. Keep chatting!`,
          };
        }
        c.stage = "dating";
        c.affection = Math.min(100, c.affection + 25);
        return {
          speaker: c.name,
          response: `${firstName}: 'I have been hoping you would ask! Yes, I would love to go on a date with you!'`,
          affectionDelta: 25,
          newStage: "dating",
          statusMessage: `Consent confirmed! You and ${firstName} are now DATING! ❤️`,
        };
      }

      case "invite_apartment": {
        if (!hasApartment) {
          return {
            speaker: c.name,
            response: `${firstName}: 'I would love to visit your place! Let me know once you lease Unit 2B at Airport View.'`,
            affectionDelta: 0,
            statusMessage: "You need to lease Unit 2B Apartment first (₦75,000/mo at rental desk).",
          };
        }
        c.stage = "partner";
        c.affection = 100;
        return {
          speaker: c.name,
          response: `${firstName}: 'Your apartment in Airport View is beautiful. I feel so safe and happy with you. I am proud to be your partner.'`,
          affectionDelta: 20,
          newStage: "partner",
          statusMessage: `Intimate evening at Unit 2B. ${firstName} is now your PARTNER! 💍`,
        };
      }

      default:
        return null;
    }
  }
}
