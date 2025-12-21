-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    url TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create recipients table
CREATE TABLE IF NOT EXISTS recipients (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- Add triggers for updated_at
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recipients_updated_at BEFORE UPDATE ON recipients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();