-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    url TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_checked TIMESTAMP WITH TIME ZONE,
    new_quests_count INTEGER DEFAULT 0
);

-- Create recipients table
CREATE TABLE IF NOT EXISTS recipients (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quest_history table
CREATE TABLE IF NOT EXISTS quest_history (
    id SERIAL PRIMARY KEY,
    campaign_name VARCHAR(255) NOT NULL UNIQUE,
    quest_names JSONB DEFAULT '[]'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_quests INTEGER GENERATED ALWAYS AS (jsonb_array_length(quest_names)) STORED
);

-- Create scraper_runs table for tracking scraper activity
CREATE TABLE IF NOT EXISTS scraper_runs (
    id SERIAL PRIMARY KEY,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed'
    campaigns_checked INTEGER DEFAULT 0,
    total_new_quests INTEGER DEFAULT 0,
    emails_sent BOOLEAN DEFAULT false,
    error_message TEXT,
    duration_seconds INTEGER
);

-- Insert sample campaigns
INSERT INTO campaigns (name, url) VALUES
    ('WinterSupercycle', 'https://zealy.io/cw/wintersupercycle/questboard/sprints'),
    ('EndlessProtocol', 'https://zealy.io/cw/endlessprotocol/questboard/sprints'),
    ('Nobullies', 'https://zealy.io/cw/nobullies/questboard/sprints'),
    ('DarkExGlobal', 'https://zealy.io/cw/darkexglobal/questboard/sprints'),
    ('Inference', 'https://zealy.io/cw/inference/questboard/sprints')
ON CONFLICT (name) DO NOTHING;

-- Insert sample recipients
INSERT INTO recipients (email) VALUES
    ('nworahebuka360@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create function to update quest_history last_updated
CREATE OR REPLACE FUNCTION update_quest_history_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recipients_updated_at BEFORE UPDATE ON recipients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quest_history_timestamp BEFORE UPDATE ON quest_history
    FOR EACH ROW EXECUTE FUNCTION update_quest_history_timestamp();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(active);
CREATE INDEX IF NOT EXISTS idx_campaigns_last_checked ON campaigns(last_checked);
CREATE INDEX IF NOT EXISTS idx_recipients_active ON recipients(active);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_status ON scraper_runs(status);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_started_at ON scraper_runs(started_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (adjust these based on your auth requirements)
-- For now, allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users on campaigns" ON campaigns
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users on recipients" ON recipients
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users on quest_history" ON quest_history
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all operations for authenticated users on scraper_runs" ON scraper_runs
    FOR ALL USING (auth.role() = 'authenticated');