
-- Insert crowd forecast rows for Grand Canyon (South Rim) and Grand Teton (Jenny Lake)

INSERT INTO public.park_crowd_forecasts (park_id, location_name, season, day_type, quiet_start, quiet_end, building_time, peak_start, peak_end, evening_quiet, notes, display_order)
VALUES
-- Grand Canyon — South Rim — Spring
('grand_canyon', 'South Rim', 'spring', 'weekday', '6:00 AM', '8:30 AM', '9:00 AM', '10:00 AM', '3:00 PM', '5:30 PM', 'Spring is peak season on the South Rim. Arrive before 8:30 AM to secure parking near the visitor center.', 1),
('grand_canyon', 'South Rim', 'spring', 'weekend', '5:30 AM', '8:00 AM', '8:30 AM', '9:30 AM', '3:30 PM', '5:30 PM', 'Weekend crowds build fast in spring. Arrive by 8 AM or use the shuttle from Tusayan.', 1),

-- Grand Canyon — South Rim — Summer
('grand_canyon', 'South Rim', 'summer', 'weekday', '6:00 AM', '8:30 AM', '9:00 AM', '10:00 AM', '3:00 PM', '6:00 PM', 'Inner canyon hits 115°F in summer. Hike below the rim only before 7 AM. Rangers enforce turnaround points.', 1),
('grand_canyon', 'South Rim', 'summer', 'weekend', '5:30 AM', '8:00 AM', '8:30 AM', '9:30 AM', '3:30 PM', '6:00 PM', 'Busiest season on the rim. Arrive before 8 AM. Avoid inner canyon hiking after 10 AM on weekends.', 1),

-- Grand Canyon — South Rim — Fall
('grand_canyon', 'South Rim', 'fall', 'weekday', '6:30 AM', '9:00 AM', '9:30 AM', '11:00 AM', '3:00 PM', '5:00 PM', 'Fall is ideal for inner canyon hiking — temps drop to 70–85°F in October. North Rim closes October 15.', 1),
('grand_canyon', 'South Rim', 'fall', 'weekend', '6:00 AM', '8:30 AM', '9:00 AM', '10:30 AM', '3:30 PM', '5:00 PM', 'Rim-to-Rim window closes mid-October. Fall weekends still busy — arrive before 8:30 AM.', 1),

-- Grand Canyon — South Rim — Winter
('grand_canyon', 'South Rim', 'winter', 'weekday', '7:00 AM', '10:00 AM', '10:30 AM', '12:00 PM', '2:30 PM', '4:00 PM', 'South Rim is open year-round and uncrowded in winter. Bright Angel ices over Dec–Feb — bring microspikes.', 1),
('grand_canyon', 'South Rim', 'winter', 'weekend', '7:00 AM', '9:30 AM', '10:00 AM', '11:30 AM', '2:30 PM', '4:00 PM', 'Winter weekends are quiet by canyon standards. Snow on the red rock is rare and spectacular. North Rim is closed.', 1),

-- Grand Teton — Jenny Lake — Spring
('grand_teton', 'Jenny Lake', 'spring', 'weekday', '6:00 AM', '9:00 AM', '9:30 AM', '11:00 AM', '3:00 PM', '5:30 PM', 'Teton Park Road opens April 1. High trails snow-covered into June. Oxbow Bend at dawn for bears and wildlife.', 1),
('grand_teton', 'Jenny Lake', 'spring', 'weekend', '5:30 AM', '8:30 AM', '9:00 AM', '10:30 AM', '3:30 PM', '5:30 PM', 'Spring weekends draw wildlife watchers. Jenny Lake lot fills by mid-morning — arrive before 8:30 AM.', 1),

-- Grand Teton — Jenny Lake — Summer
('grand_teton', 'Jenny Lake', 'summer', 'weekday', '6:00 AM', '7:30 AM', '8:00 AM', '9:00 AM', '3:00 PM', '5:30 PM', 'Jenny Lake lot fills by 8 AM on summer weekdays. String Lake is the best overflow. Start Cascade Canyon by 7 AM.', 1),
('grand_teton', 'Jenny Lake', 'summer', 'weekend', '5:00 AM', '7:00 AM', '7:30 AM', '8:30 AM', '3:30 PM', '5:30 PM', 'Jenny Lake fills by 8 AM on summer weekends. Arrive before sunrise or use String Lake overflow. Afternoon storms by 2 PM above 9,000 ft.', 1),

-- Grand Teton — Jenny Lake — Fall
('grand_teton', 'Jenny Lake', 'fall', 'weekday', '6:30 AM', '9:00 AM', '9:30 AM', '11:00 AM', '3:00 PM', '5:00 PM', 'Elk rut peaks mid-September at Oxbow Bend. Teton Park Road closes November 1. Fall crowds lighter than summer.', 1),
('grand_teton', 'Jenny Lake', 'fall', 'weekend', '6:00 AM', '8:30 AM', '9:00 AM', '10:30 AM', '3:30 PM', '5:00 PM', 'Aspen color peaks late September. Fall weekends busy with wildlife watchers — arrive before 8:30 AM.', 1),

-- Grand Teton — Jenny Lake — Winter (road closed)
('grand_teton', 'Jenny Lake', 'winter', 'weekday', '12:00 AM', '12:00 AM', '12:00 AM', '12:00 AM', '12:00 AM', '12:00 AM', 'Teton Park Road closes November 1. Jenny Lake is inaccessible by car. Snowshoeing at Taggart Lake is the winter alternative.', 1),
('grand_teton', 'Jenny Lake', 'winter', 'weekend', '12:00 AM', '12:00 AM', '12:00 AM', '12:00 AM', '12:00 AM', '12:00 AM', 'Teton Park Road closes November 1. Jenny Lake is inaccessible by car. Jackson Hole ski resort opens late November.', 1);
