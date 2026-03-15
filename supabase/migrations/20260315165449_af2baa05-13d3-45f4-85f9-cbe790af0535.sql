
-- 1. Add display_order column
ALTER TABLE public.park_crowd_forecasts ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

-- 2. Set display_order for existing Yosemite rows
UPDATE public.park_crowd_forecasts SET display_order = 1 WHERE park_id = 'yosemite' AND location_name = 'Yosemite Valley';
UPDATE public.park_crowd_forecasts SET display_order = 2 WHERE park_id = 'yosemite' AND location_name = 'Glacier Point';

-- 3. Delete all Tunnel View rows
DELETE FROM public.park_crowd_forecasts WHERE park_id = 'yosemite' AND location_name = 'Tunnel View';

-- 4. Insert Glacier Point weekend summer (missing)
INSERT INTO public.park_crowd_forecasts (park_id, location_name, season, day_type, quiet_start, quiet_end, building_time, peak_start, peak_end, evening_quiet, notes, display_order)
VALUES ('yosemite', 'Glacier Point', 'summer', 'weekend', '6:00 AM', '8:30 AM', '9:00 AM', '10:30 AM', '3:30 PM', '5:00 PM', 'Weekend lot fills earlier. Arrive before 8 AM.', 2);

-- 5. Insert Tuolumne Meadows rows for all seasons
INSERT INTO public.park_crowd_forecasts (park_id, location_name, season, day_type, quiet_start, quiet_end, building_time, peak_start, peak_end, evening_quiet, notes, display_order)
VALUES
('yosemite', 'Tuolumne Meadows', 'summer', 'weekday', '6:00 AM', '9:00 AM', '9:30 AM', '11:00 AM', '3:00 PM', '5:30 PM', 'High-country crowds lighter than Valley. Tioga Road can back up at trailheads.', 3),
('yosemite', 'Tuolumne Meadows', 'summer', 'weekend', '5:30 AM', '8:30 AM', '9:00 AM', '10:30 AM', '3:30 PM', '5:00 PM', 'Weekend trailhead parking fills by 9 AM. Start early for Cathedral Lakes.', 3),
('yosemite', 'Tuolumne Meadows', 'fall', 'weekday', '7:00 AM', '9:30 AM', '10:00 AM', '11:30 AM', '2:30 PM', '4:30 PM', 'Tioga Road closes mid-November. Check status before driving up.', 3),
('yosemite', 'Tuolumne Meadows', 'fall', 'weekend', '6:30 AM', '9:00 AM', '9:30 AM', '11:00 AM', '3:00 PM', '4:30 PM', 'Fall colors draw weekend crowds. Arrive early for Lembert Dome.', 3),
('yosemite', 'Tuolumne Meadows', 'winter', 'weekday', '12:00 AM', '12:00 AM', '12:00 AM', '12:00 AM', '12:00 AM', '12:00 AM', 'Tioga Road is closed for winter. Access only via backcountry skiing.', 3),
('yosemite', 'Tuolumne Meadows', 'winter', 'weekend', '12:00 AM', '12:00 AM', '12:00 AM', '12:00 AM', '12:00 AM', '12:00 AM', 'Tioga Road is closed for winter. Access only via backcountry skiing.', 3),
('yosemite', 'Tuolumne Meadows', 'spring', 'weekday', '6:30 AM', '9:30 AM', '10:00 AM', '11:30 AM', '3:00 PM', '5:00 PM', 'Tioga Road reopens late May (weather permitting). Snow possible.', 3),
('yosemite', 'Tuolumne Meadows', 'spring', 'weekend', '6:00 AM', '9:00 AM', '9:30 AM', '11:00 AM', '3:30 PM', '5:00 PM', 'Opening weekends are busy. Check Tioga Road status before heading up.', 3);
