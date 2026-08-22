// Types manuels correspondant au schéma de supabase/schema.sql.
// Une fois la Supabase CLI installée, vous pourrez les régénérer automatiquement avec :
//   npx supabase gen types typescript --project-id <votre-project-id> > lib/database.types.ts
// En attendant, ce fichier suffit à typer proprement l'application.

export type Role = 'skipper' | 'owner' | 'broker' | 'charter_company' | 'admin';
export type MissionType = 'À la journée' | 'À la semaine' | 'Saisonnier' | 'Convoyage' | 'Autre';
export type MissionStatus = 'open' | 'in_discussion' | 'filled' | 'completed';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;

  // Champs "demandeur" (owner / broker / charter_company)
  company_name: string | null;
  fleet_size: number | null;
  city: string | null;

  // Champs "skipper"
  experience_years: number | null;
  zones: string[];
  boat_types: string[];
  languages: string[];
  permits: string | null;
  certifications: { name: string; file_url?: string; verified: boolean }[];
  bio: string | null;
  gallery_urls: string[];
  hourly_rate: string | null;
  availability_note: string | null;
  identity_verified: boolean;

  created_at: string;
}

export interface Mission {
  id: string;
  poster_id: string;
  status: MissionStatus;
  type: MissionType;
  boat_type: string;
  zone: string;
  departure: string;
  destination: string | null;
  start_date: string;
  duration: string | null;
  compensation: string | null;
  description: string | null;
  applicants_count: number;
  is_featured: boolean;
  posted_at: string;
}

export interface Application {
  id: string;
  mission_id: string;
  skipper_id: string;
  status: ApplicationStatus;
  phone: string | null;
  message: string | null;
  applied_at: string;
  profiles?: Pick<Profile, 'id' | 'full_name'>;
  missions?: Mission;
}

export interface Conversation {
  id: string;
  mission_id: string;
  demandeur_id: string;
  skipper_id: string;
  created_at: string;
  missions?: Pick<Mission, 'departure' | 'destination'>;
  demandeur?: Pick<Profile, 'full_name'>;
  skipper?: Pick<Profile, 'full_name'>;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  skipper_id: string | null;
  mission_id: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  mission_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

// Générique large utilisé par createBrowserClient / createServerClient.
// Remplacez par les types générés par la CLI Supabase quand vous l'installerez.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
