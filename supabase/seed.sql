-- Seed data for local or staging Supabase testing.
-- This script creates sample profiles and mission data only when matching Auth users already exist.
-- It is designed to be executed after creating demo accounts in the app.

-- Example demo emails used by the app for test flows:
-- skipper.demo@findaskipper.test
-- owner.demo@findaskipper.test
-- broker.demo@findaskipper.test

DO $$
DECLARE
  skipper_id uuid;
  owner_id uuid;
  broker_id uuid;
  mission_id uuid;
BEGIN
  SELECT id INTO skipper_id FROM auth.users WHERE email = 'skipper.demo@findaskipper.test' LIMIT 1;
  SELECT id INTO owner_id FROM auth.users WHERE email = 'owner.demo@findaskipper.test' LIMIT 1;
  SELECT id INTO broker_id FROM auth.users WHERE email = 'broker.demo@findaskipper.test' LIMIT 1;

  IF skipper_id IS NOT NULL THEN
    INSERT INTO public.profiles (
      id, role, full_name, phone, experience_years, zones, boat_types, permits, bio
    )
    VALUES (
      skipper_id,
      'skipper',
      'Alex Martin',
      '+33601020304',
      9,
      ARRAY['Méditerranée', 'Atlantique'],
      ARRAY['Voilier', 'Catamaran'],
      'AMSL / Yachtmaster',
      'Skipper professionnel de 9 ans, spécialisé sur les rotations en méditerranée.'
    )
    ON CONFLICT (id) DO UPDATE SET
      role = EXCLUDED.role,
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      experience_years = EXCLUDED.experience_years,
      zones = EXCLUDED.zones,
      boat_types = EXCLUDED.boat_types,
      permits = EXCLUDED.permits,
      bio = EXCLUDED.bio;
  END IF;

  IF owner_id IS NOT NULL THEN
    INSERT INTO public.profiles (
      id, role, full_name, phone, company_name, fleet_size, city
    )
    VALUES (
      owner_id,
      'owner',
      'Claire Dubois',
      '+33605060708',
      'Les Mers du Sud',
      2,
      'Nice'
    )
    ON CONFLICT (id) DO UPDATE SET
      role = EXCLUDED.role,
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      company_name = EXCLUDED.company_name,
      fleet_size = EXCLUDED.fleet_size,
      city = EXCLUDED.city;
  END IF;

  IF broker_id IS NOT NULL THEN
    INSERT INTO public.profiles (
      id, role, full_name, phone, company_name, fleet_size, city
    )
    VALUES (
      broker_id,
      'broker',
      'Julien Morel',
      '+33609080706',
      'Oceanis Charter',
      12,
      'Marseille'
    )
    ON CONFLICT (id) DO UPDATE SET
      role = EXCLUDED.role,
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      company_name = EXCLUDED.company_name,
      fleet_size = EXCLUDED.fleet_size,
      city = EXCLUDED.city;
  END IF;

  IF owner_id IS NOT NULL THEN
    INSERT INTO public.missions (
      poster_id, type, boat_type, zone, departure, destination, start_date, duration, compensation, description
    )
    VALUES (
      owner_id,
      'À la semaine',
      'Catamaran',
      'Méditerranée',
      'Nice',
      'Saint-Tropez',
      CURRENT_DATE + INTERVAL '7 days',
      '7 jours',
      '2200 €',
      'Recherche un skipper expérimenté pour une semaine de navigation avec mise à disposition d’un catamaran de 45 pieds.'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO mission_id;

    IF mission_id IS NOT NULL AND skipper_id IS NOT NULL THEN
      INSERT INTO public.applications (mission_id, skipper_id, phone, message)
      VALUES (
        mission_id,
        skipper_id,
        '+33601020304',
        'Je suis disponible pour cette semaine, j’ai de l’expérience en navigation méditerranéenne.'
      )
      ON CONFLICT (mission_id, skipper_id) DO NOTHING;
    END IF;
  END IF;
END $$;
