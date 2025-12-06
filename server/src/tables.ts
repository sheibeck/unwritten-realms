export type Users = {
    id: string;
    google_id: string;
    last_login: number;
};

export type Characters = {
    id: string;
    owner_id: string;
    class: string;
    stats_json: string; // TODO: define structured stats
};

export type Sessions = {
    account_id: string;
    device_id: string;
    last_seen: number;
};

export type NarrativeEvents = {
    id: string;
    character_id: string;
    text: string;
    intent_json: string;
    timestamp: number;
};
