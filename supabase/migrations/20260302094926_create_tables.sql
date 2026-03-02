CREATE TABLE workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  phase_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE exercise_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  set_number INT NOT NULL,
  weight NUMERIC NOT NULL,
  reps INT NOT NULL
);

ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON workouts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON exercise_logs FOR ALL USING (true) WITH CHECK (true);
