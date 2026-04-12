CREATE TABLE erg_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  time TEXT NOT NULL,
  distance INT NOT NULL DEFAULT 0,
  pace TEXT NOT NULL DEFAULT '-',
  stroke_rate INT,
  photo TEXT,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE erg_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON erg_sessions FOR ALL USING (true) WITH CHECK (true);
